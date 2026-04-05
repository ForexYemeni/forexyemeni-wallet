/**
 * Send FCM push notification to a user (server-side utility).
 * This is called by admin operations (deposit confirmation, withdrawal, etc.)
 * to send real push notifications to the user's Android device.
 *
 * IMPORTANT: We send DATA-ONLY messages (no "notification" field).
 * This ensures onMessageReceived() is ALWAYS called in our custom
 * MyFirebaseMessagingService, which plays sound + shows notification.
 * If we include "notification" field, Android handles it directly
 * in background WITHOUT calling onMessageReceived() → NO SOUND.
 */
import { getDb, initializeFirebase } from '@/lib/firebase'
import { getMessaging, Message } from 'firebase-admin/messaging'

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

    // Build DATA-ONLY message — NO "notification" field!
    // This guarantees onMessageReceived() is always called.
    // All title/body info goes in the "data" payload.
    const message: Message = {
      // ❌ NO "notification" field — Android would handle it without sound
      android: {
        // High priority ensures immediate delivery even in Doze
        priority: 'high' as const,
        // TTL: 24 hours
        ttl: 86400,
        // No android.notification either — our Java code handles everything
        data: {
          type: type || 'info',
          userId,
          click_action: 'OPEN_NOTIFICATIONS',
          title,
          body,
          ...(data || {}),
        },
      },
      // Top-level data payload — this is what our Java service reads
      data: {
        type: type || 'info',
        userId,
        title,
        body,
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
