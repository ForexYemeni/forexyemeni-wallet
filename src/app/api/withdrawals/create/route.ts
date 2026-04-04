import { NextRequest, NextResponse } from 'next/server'
import { userOperations, withdrawalOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp } from '@/lib/firebase'
import { sendPushNotification } from '@/lib/push-notification'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

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
    const db = getDb()
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

    // Notify admin about new withdrawal request
    try {
      const admin = await userOperations.findUnique({ email: ADMIN_EMAIL })
      if (admin) {
        const title = 'طلب سحب جديد'
        const message = `طلب سحب بقيمة ${amount} USDT من ${user.fullName || user.email} (الصافي: ${netAmount.toFixed(2)} USDT)`
        await notificationOperations.create({ userId: admin.id, title, message, type: 'warning', read: false })
        sendPushNotification(admin.id, title, message, 'warning').catch(() => {})
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
