import { NextRequest, NextResponse } from 'next/server'
import { userOperations, withdrawalOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, toAddress, method = 'blockchain', network, paymentMethodId, paymentMethodName } = await request.json()

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

    // Fetch fee from settings
    const db = getDb()
    const settingsDoc = await db.collection('systemSettings').doc('fees').get()
    const feePercentage = settingsDoc.exists ? (settingsDoc.data().withdrawalFee || 0.1) : 0.1

    const fee = amount * (feePercentage / 100)
    const totalAmount = amount + fee

    if (user.balance < totalAmount) {
      return NextResponse.json(
        { success: false, message: `رصيدك غير كافي. المطلوب: ${totalAmount.toFixed(2)} USDT (يشمل الرسوم)` },
        { status: 400 }
      )
    }

    await userOperations.update({ id: userId }, {
      balance: user.balance - totalAmount,
      frozenBalance: user.frozenBalance + totalAmount,
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
      adminNote: null,
      screenshot: null,
      paymentMethodName: paymentMethodName || null,
      paymentMethodId: paymentMethodId || null,
      status: 'pending',
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
