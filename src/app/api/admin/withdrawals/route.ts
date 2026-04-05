import { NextRequest, NextResponse } from 'next/server'
import { userOperations, withdrawalOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp } from '@/lib/firebase'
import { sendPushNotification } from '@/lib/push-notification'
import {
  sendUserWithdrawalApprovedEmail,
  sendUserWithdrawalProcessingEmail,
  sendUserWithdrawalRejectedEmail,
  sendMerchantWithdrawalApprovedEmail,
  sendMerchantWithdrawalProcessingEmail,
  sendMerchantWithdrawalRejectedEmail,
} from '@/lib/email'

// GET all withdrawals (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const id = searchParams.get('id')

    // Support filtering by single ID
    if (id) {
      const withdrawal = await withdrawalOperations.findUnique({ id })
      if (!withdrawal) {
        return NextResponse.json({ success: true, withdrawals: [] })
      }
      return NextResponse.json({ success: true, withdrawals: [withdrawal] })
    }

    const withdrawals = await withdrawalOperations.findMany(status ? { status } : undefined)

    return NextResponse.json({ success: true, withdrawals })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST update withdrawal status (admin)
export async function POST(request: NextRequest) {
  try {
    const { withdrawalId, status, adminNote, txId, screenshot } = await request.json()

    if (!withdrawalId || !status) {
      return NextResponse.json({ success: false, message: 'معرف السحب والحالة مطلوبان' }, { status: 400 })
    }

    const validStatuses = ['approved', 'rejected', 'processing']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, message: 'حالة غير صحيحة' }, { status: 400 })
    }

    const withdrawal = await withdrawalOperations.findUnique(withdrawalId)
    if (!withdrawal) {
      return NextResponse.json({ success: false, message: 'السحب غير موجود' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      status,
      adminNote: adminNote || null,
      txId: txId || null,
    }
    if (screenshot) updateData.screenshot = screenshot

    const updatedWithdrawal = await withdrawalOperations.update(withdrawalId, updateData)

    if (status === 'approved') {
      const title = 'تم قبول السحب - قيد المراجعة'
      const netAmt = withdrawal.netAmount ?? (withdrawal.amount - withdrawal.fee)
      const message = `تم قبول سحبك بقيمة ${netAmt.toFixed(2)} USDT. جاري معالجة الدفع.`
      await notificationOperations.create({ userId: withdrawal.userId, title, message, type: 'info', read: false })
      sendPushNotification(withdrawal.userId, title, message, 'info').catch(() => {})

      // Send email to user/merchant
      const wUser = await userOperations.findUnique({ id: withdrawal.userId })
      if (wUser) {
        const sendWApproved = wUser.role === 'merchant'
          ? sendMerchantWithdrawalApprovedEmail
          : sendUserWithdrawalApprovedEmail
        sendWApproved(wUser.email, wUser.fullName || wUser.email, withdrawal.amount, netAmt, withdrawal.id)
      }
    }

    if (status === 'processing') {
      const netAmount = withdrawal.netAmount ?? (withdrawal.amount - withdrawal.fee)
      const withdrawalFee = withdrawal.fee ?? 0

      const user = await userOperations.findUnique({ id: withdrawal.userId })
      if (user) {
        // Unfreeze only the amount (not amount + fee, since fee is deducted from amount)
        const newFrozen = user.frozenBalance - withdrawal.amount
        await userOperations.updateFrozenBalance(withdrawal.userId, Math.max(0, newFrozen))

        await transactionOperations.create({
          userId: withdrawal.userId,
          type: 'withdrawal',
          amount: -(withdrawal.amount),
          balanceBefore: user.balance,
          balanceAfter: user.balance,
          description: `سحب USDT إلى ${withdrawal.toAddress.substring(0, 10)}... (الرسوم: ${withdrawalFee.toFixed(2)} USDT → حساب الإدارة, الصافي: ${netAmount.toFixed(2)})`,
          referenceId: withdrawal.id,
        })

        // Set pendingConfirmation on user
        await userOperations.update({ id: withdrawal.userId }, {
          pendingConfirmation: withdrawalId,
        })
      }

      // Send email to user/merchant
      if (user) {
        const sendWProcessing = user.role === 'merchant'
          ? sendMerchantWithdrawalProcessingEmail
          : sendUserWithdrawalProcessingEmail
        sendWProcessing(user.email, user.fullName || user.email, netAmount, withdrawal.toAddress, withdrawal.id)
      }

      // Credit fee to admin's account
      if (withdrawalFee > 0) {
        try {
          const db = getDb()
          const adminDocs = await db.collection('users').where('role', '==', 'admin').limit(1).get()
          if (!adminDocs.empty) {
            const adminDoc = adminDocs.docs[0]
            const admin = { id: adminDoc.id, ...adminDoc.data() } as any
            const adminBalanceBefore = admin.balance
            const adminBalanceAfter = adminBalanceBefore + withdrawalFee
            await userOperations.updateBalance(admin.id, adminBalanceAfter)

            await transactionOperations.create({
              userId: admin.id,
              type: 'fee_income',
              amount: withdrawalFee,
              balanceBefore: adminBalanceBefore,
              balanceAfter: adminBalanceAfter,
              description: `رسوم سحب من ${user?.fullName || withdrawal.userId.substring(0, 8)} - سحب #${withdrawal.id.substring(0, 8)}`,
              referenceId: withdrawal.id,
            })

            // Notify admin about fee income
            const adminTitle = 'رسوم سحب'
            const adminMessage = `تم إضافة ${withdrawalFee.toFixed(2)} USDT رسوم سحب من ${user?.fullName || 'مستخدم'}`
            await notificationOperations.create({ userId: admin.id, title: adminTitle, message: adminMessage, type: 'success', read: false })
            sendPushNotification(admin.id, adminTitle, adminMessage, 'success').catch(() => {})
          }
        } catch (adminErr) {
        }
      }

      const title = 'تم السحب'
      const message = `تم سحب ${netAmount.toFixed(2)} USDT بنجاح. يرجى تأكيد الاستلام.`
      await notificationOperations.create({ userId: withdrawal.userId, title, message, type: 'success', read: false })
      sendPushNotification(withdrawal.userId, title, message, 'success').catch(() => {})
    }

    if (status === 'rejected') {
      const user = await userOperations.findUnique({ id: withdrawal.userId })
      if (user) {
        // Refund only the amount (since that's what was frozen)
        await userOperations.update({ id: withdrawal.userId }, {
          balance: user.balance + withdrawal.amount,
          frozenBalance: user.frozenBalance - withdrawal.amount,
        })
      }

      const reason = adminNote ? ` (${adminNote})` : ''
      const title = 'تم رفض السحب'
      const message = `تم رفض طلب سحبك. تم إعادة المبلغ إلى رصيدك.${reason}`
      await notificationOperations.create({ userId: withdrawal.userId, title, message, type: 'warning', read: false })
      sendPushNotification(withdrawal.userId, title, message, 'warning').catch(() => {})

      // Send email to user/merchant
      if (user) {
        const sendWRejected = user.role === 'merchant'
          ? sendMerchantWithdrawalRejectedEmail
          : sendUserWithdrawalRejectedEmail
        sendWRejected(user.email, user.fullName || user.email, withdrawal.amount, adminNote || '', withdrawal.id)
      }
    }

    return NextResponse.json({ success: true, withdrawal: updatedWithdrawal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
