import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all deposits (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const deposits = await db.deposit.findMany({
      where,
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

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

    if (!['confirmed', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, message: 'حالة غير صحيحة' }, { status: 400 })
    }

    const deposit = await db.deposit.findUnique({ where: { id: depositId } })
    if (!deposit) {
      return NextResponse.json({ success: false, message: 'الإيداع غير موجود' }, { status: 404 })
    }

    const updatedDeposit = await db.deposit.update({
      where: { id: depositId },
      data: { status, adminNote: adminNote || null },
    })

    if (status === 'confirmed') {
      const user = await db.user.findUnique({ where: { id: deposit.userId } })
      if (user) {
        const balanceBefore = user.balance
        const balanceAfter = balanceBefore + deposit.amount

        await db.user.update({
          where: { id: deposit.userId },
          data: { balance: balanceAfter },
        })

        await db.transaction.create({
          data: {
            userId: deposit.userId,
            type: 'deposit',
            amount: deposit.amount,
            balanceBefore,
            balanceAfter,
            description: `إيداع USDT TRC20 - ${deposit.txId || deposit.id.substring(0, 8)}`,
            referenceId: deposit.id,
          },
        })

        await db.notification.create({
          data: {
            userId: deposit.userId,
            title: 'تم تأكيد الإيداع',
            message: `تم تأكيد إيداعك بقيمة ${deposit.amount} USDT`,
            type: 'success',
          },
        })
      }
    }

    return NextResponse.json({ success: true, deposit: updatedDeposit })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
