import { NextRequest, NextResponse } from 'next/server'
import { userOperations, depositOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { getDb } from '@/lib/firebase'
import { sendAdminNewDepositEmail, sendUserDepositConfirmedEmail, sendMerchantDepositConfirmedEmail } from '@/lib/email'

// GET - Check if user has a pending deposit
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const db = getDb()
    const pendingDocs = await db.collection('deposits')
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'reviewing'])
      .limit(1)
      .get()

    if (!pendingDocs.empty) {
      const deposit = pendingDocs.docs[0].data()
      return NextResponse.json({
        hasPending: true,
        deposit: { id: pendingDocs.docs[0].id, amount: deposit.amount, status: deposit.status, createdAt: deposit.createdAt }
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
    const { userId, amount, method = 'blockchain', txId, screenshot, network } = await request.json()

    if (!userId || !amount) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم والمبلغ مطلوبان' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    if (!screenshot) {
      return NextResponse.json(
        { success: false, message: 'صورة إثبات الدفع مطلوبة' },
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

    // Check for existing pending deposit
    const db = getDb()
    const pendingDeposits = await db.collection('deposits')
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'reviewing'])
      .limit(1)
      .get()
    if (!pendingDeposits.empty) {
      return NextResponse.json(
        { success: false, message: 'لديك طلب إيداع معلق بالفعل، يرجى الانتظار حتى يتم معالجته قبل تقديم طلب جديد' },
        { status: 400 }
      )
    }

    // Fetch deposit fee from settings
    const settingsDoc = await db.collection('systemSettings').doc('fees').get()
    const depositFeePercentage = settingsDoc.exists ? (settingsDoc.data().depositFee || 0) : 0

    // Calculate fee and net amount
    const fee = amount * (depositFeePercentage / 100)
    const netAmount = amount - fee

    const deposit = await depositOperations.create({
      userId,
      amount,
      fee,
      netAmount,
      currency: 'USDT',
      network: network || 'TRC20',
      txId: txId || null,
      fromAddress: null,
      toAddress: null,
      method: method || 'blockchain',
      merchantId: null,
      merchantNote: null,
      screenshot: screenshot || null,
      status: 'pending',
    })

    // ===== AUTO-APPROVE CHECK =====
    const globalSettingsDoc = await db.collection('systemSettings').doc('global').get()
    const autoApproveDeposit = globalSettingsDoc.exists ? (globalSettingsDoc.data().autoApproveDeposit === true) : false

    if (autoApproveDeposit) {
      // Auto-confirm the deposit immediately
      await depositOperations.update(deposit.id, { status: 'confirmed' })

      // Credit user balance
      const creditAmount = netAmount
      const balanceBefore = user.balance
      const balanceAfter = balanceBefore + creditAmount
      await userOperations.updateBalance(userId, balanceAfter)

      // Create transaction record
      await transactionOperations.create({
        userId,
        type: 'deposit',
        amount: creditAmount,
        balanceBefore,
        balanceAfter,
        description: `إيداع USDT (تلقائي)${fee > 0 ? ` (الرسوم: ${fee.toFixed(2)} USDT → حساب الإدارة)` : ''} - ${txId || deposit.id.substring(0, 8)}`,
        referenceId: deposit.id,
      })

      // Notify user
      const title = 'تم تأكيد الإيداع'
      const feeInfo = fee > 0 ? ` (${fee.toFixed(2)} USDT رسوم)` : ''
      const message = `تم تأكيد إيداعك بقيمة ${creditAmount.toFixed(2)} USDT${feeInfo} تلقائياً`
      await notificationOperations.create({ userId, title, message, type: 'success', read: false })
      sendPushNotification(userId, title, message, 'success').catch(() => {})

      // Send email
      if (user.role === 'merchant') {
        await sendMerchantDepositConfirmedEmail(user.email, user.fullName || user.email, amount, creditAmount, deposit.id).catch(() => {})
      } else {
        await sendUserDepositConfirmedEmail(user.email, user.fullName || user.email, amount, fee, creditAmount, deposit.id).catch(() => {})
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
              description: `رسوم إيداع تلقائي من ${user.fullName || user.email} - إيداع #${deposit.id.substring(0, 8)}`,
              referenceId: deposit.id,
            })
          }
        } catch {}
      }

      // Process referral commissions
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/referral`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'process_commissions', depositId: deposit.id }),
        })
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'تم تأكيد الإيداع تلقائياً',
        deposit: { ...deposit, status: 'confirmed' },
      })
    }

    // ===== NORMAL FLOW (not auto-approved) =====

    // Notify admin(s) about new deposit request
    try {
      const adminDocs = await db.collection('users').where('role', '==', 'admin').get()
      for (const adminDoc of adminDocs.docs) {
        const admin = adminDoc.data() as any
        const adminId = adminDoc.id
        const title = 'طلب إيداع جديد'
        const feeInfo = depositFeePercentage > 0 ? ` (الرسوم: ${fee.toFixed(2)} USDT - الصافي: ${netAmount.toFixed(2)} USDT)` : ''
        const message = `طلب إيداع بقيمة ${amount} USDT من ${user.fullName || user.email}${feeInfo}`
        await notificationOperations.create({ userId: adminId, title, message, type: 'info', read: false })
        sendPushNotification(adminId, title, message, 'info').catch(() => {})

        // Send email to admin
        sendAdminNewDepositEmail(
          admin.email,
          user.fullName || user.email,
          user.email,
          amount,
          fee,
          netAmount,
          network || 'TRC20',
          deposit.id
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء طلب الإيداع بنجاح',
      deposit,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
