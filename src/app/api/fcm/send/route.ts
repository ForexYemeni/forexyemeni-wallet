import { NextRequest, NextResponse } from 'next/server'
import { getDb, initializeFirebase } from '@/lib/firebase'
import { getMessaging } from 'firebase-admin/messaging'

// POST /api/fcm/send - Send FCM push notification to a user
// Body: { userId, title, message, type?, data? }
export async function POST(request: NextRequest) {
  try {
    const { userId, title, message, type = 'info', data = {} } = await request.json()

    if (!userId || !title || !message) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    const db = getDb()

    // Get all FCM tokens for this user
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .get()

    if (tokensSnapshot.empty) {
      return NextResponse.json({ success: true, sent: false, message: 'لا يوجد أجهزة مسجلة' })
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean)

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, sent: false, message: 'لا يوجد توكنات صالحة' })
    }

    // Send via FCM
    let messaging
    try {
      const { app } = initializeFirebase()
      messaging = getMessaging(app)
    } catch {
      // Firebase Admin Messaging might not be configured
      return NextResponse.json({ success: true, sent: false, message: 'FCM not configured' })
    }

    // Send multicast message to all user devices
    const multicastMessage = {
      notification: {
        title,
        body: message,
      },
      android: {
        priority: 'high' as const,
        ttl: 86400,
        notification: {
          channelId: 'fx_v6',
          sound: 'notification',
          priority: 'high' as const,
          defaultSound: true,
          defaultVibrateTimings: true,
          notificationCount: 1,
        },
        data: {
          type: type || 'info',
          userId,
          title,
          body: message,
          ...data,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'notification.wav',
            'content-available': 1,
          },
        },
      },
      tokens,
    }

    const response = await messaging.sendEachForMulticast(multicastMessage)

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const batch = db.batch()
      response.responses.forEach((resp, idx) => {
        if (!resp.success && (resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code === 'messaging/registration-token-not-registered')) {
          const docToDelete = tokensSnapshot.docs[idx]
          if (docToDelete) batch.delete(docToDelete.ref)
        }
      })
      await batch.commit()
    }

    return NextResponse.json({
      success: true,
      sent: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
