/**
 * Send FCM push notification to a user (server-side utility).
 * This is called by admin operations (deposit confirmation, withdrawal, etc.)
 * to send real push notifications to the user's Android device.
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

    // Determine channel based on notification type
    const isUrgent = ['transfer', 'deposit', 'withdraw', 'payment'].some(t => 
      (type || '').includes(t)
    ) || ['تحويل', 'إيداع', 'سحب', 'دف'].some(w => title.includes(w))
    const channelId = isUrgent ? 'forexyemeni_urgent' : 'forexyemeni_notifications'

    // Build the message
    const message: Message = {
      notification: {
        title,
        body,
      },
      android: {
        // High priority ensures immediate delivery even when device is in Doze
        priority: 'high' as const,
        // TTL: 24 hours — retry delivery if device is offline
        ttl: 86400,
        notification: {
          channelId,
          sound: 'notification',
          priority: 'max' as const,
          // Enable default sound and vibration
          defaultSound: true,
          defaultVibrateTimings: true,
          notificationCount: 1,
          // Show on lock screen
          visibility: 'public' as const,
          // Vibration pattern
          vibrateTimingsMillis: [0, 500, 200, 500, 200, 500],
        },
        data: {
          type: type || 'info',
          userId,
          click_action: 'OPEN_NOTIFICATIONS',
          title,
          body,
          ...(data || {}),
        },
      },
      // Also include data payload at top level for our custom FCM service
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
