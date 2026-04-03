import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, method = 'blockchain', txId, screenshot } = await request.json()

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

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const deposit = await db.deposit.create({
      data: {
        userId,
        amount,
        currency: 'USDT',
        network: 'TRC20',
        txId: txId || null,
        method: method || 'blockchain',
        screenshot: screenshot || null,
        status: 'pending',
      },
    })

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
