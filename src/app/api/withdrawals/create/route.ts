import { NextRequest, NextResponse } from 'next/server'
import { userOperations, withdrawalOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp } from '@/lib/firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { sendAdminNewWithdrawalEmail, sendUserWithdrawalProcessingEmail, sendMerchantWithdrawalProcessingEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'

// GET - Check if user has a pending withdrawal
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const db = getDb()
    const pendingDocs = await db.collection('withdrawals')
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'processing'])
      .limit(1)
      .get()

    if (!pendingDocs.empty) {
      const withdrawal = pendingDocs.docs[0].data()
      return NextResponse.json({
        hasPending: true,
        withdrawal: { id: pendingDocs.docs[0].id, amount: withdrawal.amount, status: withdrawal.status, createdAt: withdrawal.createdAt }
      })
    }

    return NextResponse.json({ hasPending: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, toAddress, method = 'blockchain', network, paymentMethodId, paymentMethodName, pin } = await request.json()

    if (!userId || !amount || !toAddress) {
      return NextResponse.json(
        { success: false, message: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // PIN verification required for withdrawals
    if (!user.pinHash) {
      return NextResponse.json(
        { success: false, message: 'يرجى إعداد رمز PIN أولاً قبل إجراء السحب', needsPin: true },
        { status: 400 }
      )
    }

    // Check for existing pending withdrawal
    const db = getDb()
    const pendingWithdrawals = await db.collection('withdrawals')
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'processing'])
      .limit(1)
      .get()
    if (!pendingWithdrawals.empty) {
      return NextResponse.json(
        { success: false, message: 'لديك طلب سحب معلق بالفعل، يرجى الانتظار حتى يتم معالجته قبل تقديم طلب جديد' },
        { status: 400 }
      )
    }

    if (!pin) {
      return NextResponse.json(
        { success: false, message: 'رمز PIN مطلوب لإجراء السحب', needsPin: true },
        { status: 400 }
      )
    }

    const isPinValid = await bcrypt.compare(pin, user.pinHash)
    if (!isPinValid) {
      return NextResponse.json(
        { success: false, message: 'رمز PIN غير صحيح' },
        { status: 401 }
      )
    }

    // Fetch fee from settings
    const settingsDoc = await db.collection('systemSettings').doc('fees').get()
    const feePercentage = settingsDoc.exists ? (settingsDoc.data().withdrawalFee || 0.1) : 0.1

    const fee = amount * (feePercentage / 100)
    const netAmount = amount - fee

    // Freeze only the amount (fee is deducted from it, not added)
    if (user.balance < amount) {
      return NextResponse.json(
        { success: false, message: `رصيدك غير كافي. المطلوب: ${amount.toFixed(2)} USDT` },
        { status: 400 }
      )
    }

    await userOperations.update({ id: userId }, {
      balance: user.balance - amount,
      frozenBalance: user.frozenBalance + amount,
    })

    const withdrawal = await withdrawalOperations.create({
      userId,
      amount,
      currency: 'USDT',
      network: network || 'TRC20',
      toAddress,
      method,
      merchantId: null,
      txId: null,
      fee,
      netAmount,
      adminNote: null,
      screenshot: null,
      paymentMethodName: paymentMethodName || null,
      paymentMethodId: paymentMethodId || null,
      status: 'pending',
    })

    // ===== AUTO-APPROVE WITHDRAWAL CHECK =====
    const maintenanceDoc = await db.collection('systemSettings').doc('maintenance').get()
    const autoApproveWithdrawal = maintenanceDoc.exists ? (maintenanceDoc.data().autoApproveWithdrawal === true) : false

    if (autoApproveWithdrawal) {
      // Auto-approve: pending → approved → processing (complete)
      await withdrawalOperations.update(withdrawal.id, { status: 'approved' })
      await withdrawalOperations.update(withdrawal.id, { status: 'processing' })

      // Send notification to user
      const title = 'تم السحب'
      const message = `تم سحب ${netAmount.toFixed(2)} USDT بنجاح (تلقائي).`
      await notificationOperations.create({ userId, title, message, type: 'success', read: false })
      sendPushNotification(userId, title, message, 'success').catch(() => {})

      // Unfreeze balance
      const newFrozen = user.frozenBalance - amount
      await userOperations.updateFrozenBalance(userId, Math.max(0, newFrozen))

      // Create transaction record
      await transactionOperations.create({
        userId,
        type: 'withdrawal',
        amount: -(amount),
        balanceBefore: user.balance,
        balanceAfter: user.balance,
        description: `سحب USDT تلقائي إلى ${toAddress.substring(0, 10)}... (الرسوم: ${fee.toFixed(2)} USDT, الصافي: ${netAmount.toFixed(2)})`,
        referenceId: withdrawal.id,
      })

      // Send email
      if (user.role === 'merchant') {
        await sendMerchantWithdrawalProcessingEmail(user.email, user.fullName || user.email, netAmount, toAddress, withdrawal.id).catch(() => {})
      } else {
        await sendUserWithdrawalProcessingEmail(user.email, user.fullName || user.email, amount, netAmount, toAddress, withdrawal.id).catch(() => {})
      }

      // Credit fee to admin
      if (fee > 0) {
        try {
          const adminDocs = await db.collection('users').where('role', '==', 'admin').limit(1).get()
          if (!adminDocs.empty) {
            const adminDoc = adminDocs.docs[0]
            const admin = { id: adminDoc.id, ...adminDoc.data() } as any
            const adminBalanceBefore = admin.balance
            const adminBalanceAfter = adminBalanceBefore + fee
            await userOperations.updateBalance(admin.id, adminBalanceAfter)
            await transactionOperations.create({
              userId: admin.id,
              type: 'fee_income',
              amount: fee,
              balanceBefore: adminBalanceBefore,
              balanceAfter: adminBalanceAfter,
              description: `رسوم سحب تلقائي من ${user.fullName || user.email} - سحب #${withdrawal.id.substring(0, 8)}`,
              referenceId: withdrawal.id,
            })
          }
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: 'تم تأكيد السحب تلقائياً',
        withdrawal: { ...withdrawal, status: 'processing' },
      })
    }

    // ===== NORMAL FLOW (not auto-approved) =====

    // Notify admin(s) about new withdrawal request
    try {
      const adminDocs = await db.collection('users').where('role', '==', 'admin').get()
      for (const adminDoc of adminDocs.docs) {
        const admin = adminDoc.data() as any
        const adminId = adminDoc.id
        const title = 'طلب سحب جديد'
        const message = `طلب سحب بقيمة ${amount} USDT من ${user.fullName || user.email} (الصافي: ${netAmount.toFixed(2)} USDT)`
        await notificationOperations.create({ userId: adminId, title, message, type: 'warning', read: false })
        sendPushNotification(adminId, title, message, 'warning').catch(() => {})

        // Send email to admin
        sendAdminNewWithdrawalEmail(
          admin.email,
          user.fullName || user.email,
          user.email,
          amount,
          fee,
          netAmount,
          network || 'TRC20',
          toAddress,
          withdrawal.id
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء طلب السحب بنجاح',
      withdrawal,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
