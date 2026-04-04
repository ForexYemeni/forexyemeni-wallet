import { NextRequest, NextResponse } from 'next/server'
import { userOperations, withdrawalOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp } from '@/lib/firebase'
import { sendPushNotification } from '@/lib/push-notification'

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
      const message = `تم قبول سحبك بقيمة ${withdrawal.amount} USDT. جاري معالجة الدفع.`
      await notificationOperations.create({ userId: withdrawal.userId, title, message, type: 'info' })
      sendPushNotification(withdrawal.userId, title, message, 'info').catch(() => {})
    }

    if (status === 'processing') {
      const user = await userOperations.findUnique({ id: withdrawal.userId })
      if (user) {
        const newFrozen = user.frozenBalance - (withdrawal.amount + withdrawal.fee)
        await userOperations.updateFrozenBalance(withdrawal.userId, Math.max(0, newFrozen))

        await transactionOperations.create({
          userId: withdrawal.userId,
          type: 'withdrawal',
          amount: -(withdrawal.amount + withdrawal.fee),
          balanceBefore: user.balance,
          balanceAfter: user.balance,
          description: `سحب USDT إلى ${withdrawal.toAddress.substring(0, 10)}...`,
          referenceId: withdrawal.id,
        })

        // Set pendingConfirmation on user
        await userOperations.update({ id: withdrawal.userId }, {
          pendingConfirmation: withdrawalId,
        })
      }

      const title = 'تم السحب'
      const message = `تم سحب ${withdrawal.amount} USDT بنجاح. يرجى تأكيد الاستلام.`
      await notificationOperations.create({ userId: withdrawal.userId, title, message, type: 'success' })
      sendPushNotification(withdrawal.userId, title, message, 'success').catch(() => {})
    }

    if (status === 'rejected') {
      const user = await userOperations.findUnique({ id: withdrawal.userId })
      if (user) {
        const totalRefund = withdrawal.amount + withdrawal.fee
        await userOperations.update({ id: withdrawal.userId }, {
          balance: user.balance + totalRefund,
          frozenBalance: user.frozenBalance - totalRefund,
        })
      }

      const reason = adminNote ? ` (${adminNote})` : ''
      const title = 'تم رفض السحب'
      const message = `تم رفض طلب سحبك بقيمة ${withdrawal.amount} USDT. تم إعادة المبلغ إلى رصيدك.${reason}`
      await notificationOperations.create({ userId: withdrawal.userId, title, message, type: 'warning' })
      sendPushNotification(withdrawal.userId, title, message, 'warning').catch(() => {})
    }

    return NextResponse.json({ success: true, withdrawal: updatedWithdrawal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
