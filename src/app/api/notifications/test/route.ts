import { NextRequest, NextResponse } from 'next/server'
import { notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { getDb } from '@/lib/firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

/**
 * POST /api/notifications/test
 * Send a test push notification to the user's device.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const db = getDb()
    const debug: Record<string, unknown> = {}

    const tokensSnapshot = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .get()

    debug.tokenCount = tokensSnapshot.size

    if (tokensSnapshot.empty) {
      debug.reason = 'لا يوجد جهاز مسجل للإشعارات'
      debug.hint = 'تأكد أنك تستخدم تطبيق APK (مو المتصفح) وأنك سجلت الدخول'

      await notificationOperations.create({
        userId,
        title: 'اختبار إشعار',
        message: 'هذا إشعار اختبار داخلي (FCM غير متاح)',
        type: 'info',
      })

      return NextResponse.json({
        success: false,
        message: 'لا يوجد جهاز مسجل - جرّب من تطبيق APK',
        debug,
      })
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean)
    debug.tokens = tokens.map(t => t.substring(0, 20) + '...')
    debug.platforms = tokensSnapshot.docs.map(d => d.data().platform)
    debug.deviceNames = tokensSnapshot.docs.map(d => d.data().deviceName)

    const notification = await notificationOperations.create({
      userId,
      title: 'اختبار إشعار FCM',
      message: 'إذا رأيت هذا في شريط الإشعارات = كل شيء يعمل!',
      type: 'info',
    })

    const pushResult = await sendPushNotification(
      userId,
      'اختبار إشعار FCM',
      'إذا رأيت هذا في شريط الإشعارات = كل شيء يعمل!',
      'info'
    )

    debug.pushResult = { successCount: pushResult.count, failureCount: tokensSnapshot.size - pushResult.count, sent: pushResult.sent }

    if (pushResult.sent) {
      return NextResponse.json({
        success: true,
        message: `تم الإرسال إلى ${pushResult.count} جهاز — راقب شريط الإشعارات خلال 5 ثواني`,
        debug,
      })
    } else if (tokensSnapshot.size > 0) {
      return NextResponse.json({
        success: false,
        message: `فشل إرسال FCM — الرمز القديم غير صالح. أعد تسجيل الدخول من التطبيق لتسجيل رمز جديد.`,
        debug,
      })
    } else {
      return NextResponse.json({
        success: false,
        message: `فشل إرسال FCM — الإشعار محفوظ داخل التطبيق فقط`,
        debug,
      })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, message: `خطأ: ${message}` },
      { status: 500 }
    )
  }
}
