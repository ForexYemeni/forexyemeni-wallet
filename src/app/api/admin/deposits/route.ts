import { NextRequest, NextResponse } from 'next/server'
import { userOperations, depositOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

// GET all deposits (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const deposits = await depositOperations.findMany(status ? { status } : undefined)

    return NextResponse.json({ success: true, deposits })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST update deposit status (admin)
export async function POST(request: NextRequest) {
  try {
    const { depositId, status, adminNote } = await request.json()

    if (!depositId || !status) {
      return NextResponse.json({ success: false, message: 'معرف الإيداع والحالة مطلوبان' }, { status: 400 })
    }

    const validStatuses = ['confirmed', 'rejected', 'reviewing']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, message: 'حالة غير صحيحة' }, { status: 400 })
    }

    const deposit = await depositOperations.findUnique(depositId)
    if (!deposit) {
      return NextResponse.json({ success: false, message: 'الإيداع غير موجود' }, { status: 404 })
    }

    const updatedDeposit = await depositOperations.update(depositId, {
      status,
      adminNote: adminNote || null,
    })

    if (status === 'reviewing') {
      const title = 'طلبك قيد المراجعة'
      const message = `تم بدء مراجعة إيداعك بقيمة ${deposit.amount} USDT`
      await notificationOperations.create({ userId: deposit.userId, title, message, type: 'info', read: false })
      sendPushNotification(deposit.userId, title, message, 'info').catch(() => {})
    }

    if (status === 'confirmed') {
      const user = await userOperations.findUnique({ id: deposit.userId })
      if (user) {
        // Use netAmount (after fee deduction) instead of full amount
        const creditAmount = deposit.netAmount ?? deposit.amount
        const depositFee = deposit.fee ?? 0

        const balanceBefore = user.balance
        const balanceAfter = balanceBefore + creditAmount

        await userOperations.updateBalance(deposit.userId, balanceAfter)

        await transactionOperations.create({
          userId: deposit.userId,
          type: 'deposit',
          amount: creditAmount,
          balanceBefore,
          balanceAfter,
          description: `إيداع USDT${depositFee > 0 ? ` (الرسوم: ${depositFee.toFixed(2)} USDT → حساب الإدارة)` : ''} - ${deposit.txId || deposit.id.substring(0, 8)}`,
          referenceId: deposit.id,
        })

        const title = 'تم تأكيد الإيداع'
        const feeInfo = depositFee > 0 ? ` (${depositFee.toFixed(2)} USDT رسوم)` : ''
        const message = `تم تأكيد إيداعك بقيمة ${creditAmount.toFixed(2)} USDT${feeInfo}`
        await notificationOperations.create({ userId: deposit.userId, title, message, type: 'success', read: false })
        sendPushNotification(deposit.userId, title, message, 'success').catch(() => {})

        // Credit fee to admin's account
        if (depositFee > 0) {
          try {
            const admin = await userOperations.findUnique({ email: ADMIN_EMAIL })
            if (admin) {
              const adminBalanceBefore = admin.balance
              const adminBalanceAfter = adminBalanceBefore + depositFee
              await userOperations.updateBalance(admin.id, adminBalanceAfter)

              await transactionOperations.create({
                userId: admin.id,
                type: 'fee_income',
                amount: depositFee,
                balanceBefore: adminBalanceBefore,
                balanceAfter: adminBalanceAfter,
                description: `رسوم إيداع من ${user.fullName || user.email} - إيداع #${deposit.id.substring(0, 8)}`,
                referenceId: deposit.id,
              })

              // Notify admin about fee income
              const adminTitle = 'رسوم إيداع'
              const adminMessage = `تم إضافة ${depositFee.toFixed(2)} USDT رسوم إيداع من ${user.fullName || user.email}`
              await notificationOperations.create({ userId: admin.id, title: adminTitle, message: adminMessage, type: 'success', read: false })
              sendPushNotification(admin.id, adminTitle, adminMessage, 'success').catch(() => {})
            }
          } catch (adminErr) {
            console.error('Error crediting admin fee:', adminErr)
          }
        }

        // Process referral commissions for this deposit
        try {
          const referralRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'process_commissions', depositId: deposit.id }),
          })
          const referralData = await referralRes.json()
          if (referralData.success && referralData.commissionsProcessed > 0) {
            console.log(`Referral commissions processed: ${referralData.commissionsProcessed}`)
          }
        } catch (refErr) {
          console.error('Error processing referral commissions:', refErr)
        }
      }
    }

    if (status === 'rejected') {
      const reason = adminNote ? ` (${adminNote})` : ''
      const title = 'تم رفض الإيداع'
      const message = `تم رفض إيداعك بقيمة ${deposit.amount} USDT${reason}`
      await notificationOperations.create({ userId: deposit.userId, title, message, type: 'warning', read: false })
      sendPushNotification(deposit.userId, title, message, 'warning').catch(() => {})
    }

    return NextResponse.json({ success: true, deposit: updatedDeposit })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
