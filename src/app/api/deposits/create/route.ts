import { NextRequest, NextResponse } from 'next/server'
import { userOperations, depositOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { getDb } from '@/lib/firebase'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

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

    const deposit = await depositOperations.create({
      userId,
      amount,
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

    // Notify admin about new deposit request
    try {
      const admin = await userOperations.findUnique({ email: ADMIN_EMAIL })
      if (admin) {
        const title = 'طلب إيداع جديد'
        const message = `طلب إيداع بقيمة ${amount} USDT من ${user.fullName || user.email}`
        await notificationOperations.create({ userId: admin.id, title, message, type: 'info' })
        sendPushNotification(admin.id, title, message, 'info').catch(() => {})
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
