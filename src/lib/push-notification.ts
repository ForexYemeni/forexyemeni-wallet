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
import { getMessaging } from 'firebase-admin/messaging'

// Channel ID must match MyFirebaseMessagingService.java and MainActivity.java
const CHANNEL_ID = 'fx_v8'

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  type: string = 'info',
  data?: Record<string, string>
): Promise<{ sent: boolean; count: number; error?: string }> {
  try {
    const db = getDb()

    // Get user's FCM tokens
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .get()

    if (tokensSnapshot.empty) {
      console.log(`[FCM] No tokens found for user ${userId}`)
      return { sent: false, count: 0, error: 'No FCM tokens registered' }
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean)
    if (tokens.length === 0) {
      console.log(`[FCM] All tokens empty for user ${userId}`)
      return { sent: false, count: 0, error: 'All FCM tokens are empty' }
    }

    // Get Firebase Messaging instance
    let messaging
    try {
      const { app } = initializeFirebase()
      messaging = getMessaging(app)
    } catch (err) {
      console.error('[FCM] Failed to initialize Firebase Messaging:', err)
      return { sent: false, count: 0, error: 'Firebase Messaging init failed' }
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
    const message: any = {
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

    console.log(`[FCM] Sending to ${tokens.length} token(s) for user ${userId}, type=${type}`)

    const response = await messaging.sendEachForMulticast(message)

    console.log(`[FCM] Response: ${response.successCount} success, ${response.failureCount} failure out of ${tokens.length}`)

    // Log individual failures for debugging
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.info?.code || resp.error?.code || 'unknown'
          const errMsg = resp.error?.message || 'no message'
          console.error(`[FCM] Token ${idx} failed: ${errCode} - ${errMsg}`)
        }
      })

      // Clean up invalid tokens (including mismatched-credential)
      const batch = db.batch()
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.info?.code || ''
          // Delete tokens that are invalid, unregistered, or from a different Firebase project
          if ([
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered',
            'messaging/mismatched-credential',
            'UNREGISTERED',
          ].includes(errCode)) {
            const docToDelete = tokensSnapshot.docs[idx]
            if (docToDelete) {
              batch.delete(docToDelete.ref)
              console.log(`[FCM] Cleaned up invalid token for user ${userId}: ${errCode}`)
            }
          }
        }
      })
      await batch.commit()
    }

    return { sent: response.successCount > 0, count: response.successCount }
  } catch (error) {
    console.error('[FCM] sendPushNotification error:', error)
    return { sent: false, count: 0, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
