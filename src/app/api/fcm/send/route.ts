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
    } catch (err) {
      console.error('[FCM/send] Firebase Admin Messaging init failed:', err)
      return NextResponse.json({ success: true, sent: false, message: 'FCM not configured' })
    }

    // Send with BOTH notification AND data fields (matching push-notification.ts strategy)
    // This ensures notifications show in background with sound + custom channel
    const multicastMessage = {
      android: {
        priority: 'high' as const,
        ttl: 86400,
        notification: {
          channelId: 'fx_v8',
          sound: 'default',
          title,
          body: message,
          clickAction: 'OPEN_NOTIFICATIONS',
        },
        data: {
          type: type || 'info',
          userId,
          title,
          body: message,
          ...data,
        },
      },
      notification: {
        title,
        body: message,
      },
      data: {
        type: type || 'info',
        userId,
        title,
        body: message,
        click_action: 'OPEN_NOTIFICATIONS',
        ...data,
      },
      tokens,
    }

    console.log(`[FCM/send] Sending to ${tokens.length} token(s) for user ${userId}`)

    const response = await messaging.sendEachForMulticast(multicastMessage)

    console.log(`[FCM/send] Response: ${response.successCount} success, ${response.failureCount} failure`)

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const batch = db.batch()
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.info?.code || resp.error?.code || ''
          console.error(`[FCM/send] Token ${idx} failed: ${errCode} - ${resp.error?.message}`)
          if ([
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered',
            'messaging/mismatched-credential',
            'UNREGISTERED',
          ].includes(errCode)) {
            const docToDelete = tokensSnapshot.docs[idx]
            if (docToDelete) batch.delete(docToDelete.ref)
          }
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
    console.error('[FCM/send] Error:', error)
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
