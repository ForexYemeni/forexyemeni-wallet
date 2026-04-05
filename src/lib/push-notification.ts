/**
 * Send FCM push notification to a user (server-side utility).
 * This is called by admin operations (deposit confirmation, withdrawal, etc.)
 * to send real push notifications to the user's Android device.
 *
 * IMPORTANT v3.5.0 FIX:
 * We send BOTH "notification" AND "data" fields.
 * 
 * WHY:
 * - The "notification" field (with channelId set to fx_v8) ensures that when 
 *   Android handles the message in background, it uses OUR channel which has
 *   IMPORTANCE_MAX and sound configured → SOUND PLAYS RELIABLY.
 * - The "data" field ensures our custom MyFirebaseMessagingService can also
 *   read the data in onMessageReceived() (for foreground handling).
 * - Previous data-only approach: Android might not show notification at all
 *   in deep background/Doze mode.
 * - Previous notification-only approach: Android bypassed onMessageReceived()
 *   and used wrong channel (default, no sound).
 */
import { getDb, initializeFirebase } from '@/lib/firebase'
import { getMessaging, Message } from 'firebase-admin/messaging'

// Channel ID must match MyFirebaseMessagingService.java and MainActivity.java
const CHANNEL_ID = 'fx_v8'

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  type: string = 'info',
  data?: Record<string, string>
): Promise<{ sent: boolean; count: number }> {
  try {
    const db = getDb()

    // Get user's FCM tokens
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .get()

    if (tokensSnapshot.empty) {
      return { sent: false, count: 0 }
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean)
    if (tokens.length === 0) {
      return { sent: false, count: 0 }
    }

    // Get Firebase Messaging instance
    let messaging
    try {
      const { app } = initializeFirebase()
      messaging = getMessaging(app)
    } catch {
      // Firebase Admin Messaging not available
      return { sent: false, count: 0 }
    }

    // Build message with BOTH notification AND data fields.
    // 
    // "notification" field:
    //   - Android uses this to create the system notification in background
    //   - We set channelId to our fx_v8 channel which has IMPORTANCE_MAX + sound
    //   - This guarantees sound plays even when app is killed/in Doze mode
    //
    // "data" field:
    //   - Our custom MyFirebaseMessagingService reads this in onMessageReceived()
    //   - Used for foreground handling and custom data
    const message: Message = {
      android: {
        priority: 'high' as const,
        ttl: 86400,
        // CRITICAL: Set notification with our channel ID + sound
        // This tells Android which channel to use for the system notification
        notification: {
          channelId: CHANNEL_ID,
          sound: 'default',
          title: title,
          body: body,
          clickAction: 'OPEN_NOTIFICATIONS',
        },
        data: {
          type: type || 'info',
          userId,
          title,
          body,
          ...(data || {}),
        },
      },
      // Top-level notification for cross-platform support
      notification: {
        title: title,
        body: body,
      },
      // Top-level data — read by MyFirebaseMessagingService.onMessageReceived()
      data: {
        type: type || 'info',
        userId,
        title,
        body,
        click_action: 'OPEN_NOTIFICATIONS',
        ...(data || {}),
      },
      tokens,
    }

    const response = await messaging.sendEachForMulticast(message)

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const batch = db.batch()
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.info?.code || ''
          if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered', 'UNREGISTERED'].includes(errCode)) {
            const docToDelete = tokensSnapshot.docs[idx]
            if (docToDelete) batch.delete(docToDelete.ref)
          }
        }
      })
      await batch.commit()
    }

    return { sent: response.successCount > 0, count: response.successCount }
  } catch (error) {
    return { sent: false, count: 0 }
  }
}
