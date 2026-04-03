import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, toAddress, method = 'blockchain' } = await request.json()

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

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const fee = amount * 0.001 // 0.1% fee
    const totalAmount = amount + fee

    if (user.balance < totalAmount) {
      return NextResponse.json(
        { success: false, message: `رصيدك غير كافي. المطلوب: ${totalAmount} USDT (يشمل الرسوم)` },
        { status: 400 }
      )
    }

    await db.user.update({
      where: { id: userId },
      data: {
        balance: { decrement: totalAmount },
        frozenBalance: { increment: totalAmount },
      },
    })

    const withdrawal = await db.withdrawal.create({
      data: {
        userId,
        amount,
        currency: 'USDT',
        network: 'TRC20',
        toAddress,
        method,
        fee,
        status: 'pending',
      },
    })

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
