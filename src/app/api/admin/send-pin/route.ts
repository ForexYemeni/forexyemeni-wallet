import { NextRequest, NextResponse } from 'next/server'
import { userOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPinRecoveryEmail } from '@/lib/email'
import { sendPushNotification } from '@/lib/push-notification'
import bcrypt from 'bcryptjs'

// POST: Admin generates a temporary PIN and sends it to user/merchant via email
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (user.role === 'admin') {
      return NextResponse.json({ success: false, message: 'لا يمكن إرسال PIN لحساب الإدارة' }, { status: 400 })
    }

    // Generate random 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString()

    // Hash and save as tempPinHash with expiry (30 minutes)
    const pinHash = await bcrypt.hash(pin, 10)
    const tempPinExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    await userOperations.update({ id: userId }, {
      tempPinHash: pinHash,
      tempPinExpiresAt: tempPinExpiresAt,
    })

    // Send PIN to user/merchant via email
    const emailSent = await sendPinRecoveryEmail(user.email, user.fullName || user.email, pin)

    if (!emailSent) {
      console.log('[ADMIN-SEND-PIN] Email not sent - PIN for ' + user.email + ': ' + pin)
    }

    // Notify user/merchant via push notification
    const roleLabel = user.role === 'merchant' ? 'التاجر' : 'المستخدم'
    const notifTitle = 'تم إرسال رمز PIN مؤقت'
    const notifMessage = 'تم إرسال رمز PIN مؤقت إلى بريدك الإلكتروني. استخدمه لتسجيل الدخول وغير كلمة المرور فوراً.'
    await notificationOperations.create({
      userId,
      title: notifTitle,
      message: notifMessage,
      type: 'info',
      read: false,
    })
    sendPushNotification(userId, notifTitle, notifMessage, 'info').catch(() => {})

    return NextResponse.json({
      success: true,
      message: `تم إرسال رمز PIN إلى بريد ${roleLabel}: ${user.email}`,
      emailSent,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
