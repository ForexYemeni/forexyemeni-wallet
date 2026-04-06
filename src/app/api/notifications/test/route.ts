import { NextRequest, NextResponse } from 'next/server'
import { notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { getDb } from '@/lib/firebase'

/**
 * POST /api/notifications/test
 * Send a test push notification to the user's device.
 * Used by the Settings page "اختبار إشعار كامل (FCM)" button.
 * 
 * Returns detailed debug info to help diagnose FCM issues.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId مطلوب' }, { status: 400 })
    }

    const db = getDb()
    const debug: Record<string, unknown> = {}

    // Step 1: Check if user has FCM tokens
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .get()

    debug.tokenCount = tokensSnapshot.size

    if (tokensSnapshot.empty) {
      // No tokens = device never registered for FCM
      debug.reason = 'لا يوجد جهاز مسجل للإشعارات'
      debug.hint = 'تأكد أنك تستخدم تطبيق APK (مو المتصفح) وأنك سجلت الدخول'

      // Still create in-app notification
      await notificationOperations.create({
        userId,
        title: '🔔 اختبار إشعار',
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

    // Step 2: Create in-app notification
    const notification = await notificationOperations.create({
      userId,
      title: '🔔 اختبار إشعار FCM',
      message: 'إذا رأيت هذا في شريط الإشعارات = كل شيء يعمل!',
      type: 'info',
    })

    // Step 3: Send push notification
    const pushResult = await sendPushNotification(
      userId,
      '🔔 اختبار إشعار FCM',
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
