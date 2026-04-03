import { NextRequest, NextResponse } from 'next/server'
import { userOperations, depositOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'

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
      await notificationOperations.create({
        userId: deposit.userId,
        title: 'طلبك قيد المراجعة',
        message: `تم بدء مراجعة إيداعك بقيمة ${deposit.amount} USDT`,
        type: 'info',
      })
    }

    if (status === 'confirmed') {
      const user = await userOperations.findUnique({ id: deposit.userId })
      if (user) {
        const balanceBefore = user.balance
        const balanceAfter = balanceBefore + deposit.amount

        await userOperations.updateBalance(deposit.userId, balanceAfter)

        await transactionOperations.create({
          userId: deposit.userId,
          type: 'deposit',
          amount: deposit.amount,
          balanceBefore,
          balanceAfter,
          description: `إيداع USDT - ${deposit.txId || deposit.id.substring(0, 8)}`,
          referenceId: deposit.id,
        })

        await notificationOperations.create({
          userId: deposit.userId,
          title: 'تم تأكيد الإيداع',
          message: `تم تأكيد إيداعك بقيمة ${deposit.amount} USDT`,
          type: 'success',
        })
      }
    }

    if (status === 'rejected') {
      const reason = adminNote ? ` (${adminNote})` : ''
      await notificationOperations.create({
        userId: deposit.userId,
        title: 'تم رفض الإيداع',
        message: `تم رفض إيداعك بقيمة ${deposit.amount} USDT${reason}`,
        type: 'warning',
      })
    }

    return NextResponse.json({ success: true, deposit: updatedDeposit })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
