/**
 * FCM Push Notification Handler for Capacitor (Android APK)
 * Registers device for FCM and handles incoming push notifications.
 * Only activates when running inside Capacitor native app.
 */

import { useAuthStore } from '@/lib/store'

let fcmRegistered = false
let currentFcmToken: string | null = null

// Check if running inside Capacitor native app
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor
}

/**
 * Register for FCM push notifications (only in Capacitor/Android)
 */
export async function registerFCMPushNotifications(): Promise<boolean> {
  if (!isCapacitor()) return false
  if (fcmRegistered) return true

  try {
    // Dynamic import with webpackIgnore to prevent build-time resolution on web
    const pushModule = await import(/* webpackIgnore: true */ '@capacitor/push-notifications')
    const PushNotifications = pushModule.PushNotifications || pushModule.default?.PushNotifications

    // Request permission
    const permResult = await PushNotifications.requestPermissions()

    if (permResult.receive !== 'granted') {
      return false
    }

    // Register for push notifications
    await PushNotifications.register()

    // Get FCM token
    const tokenResult = await PushNotifications.getToken()
    currentFcmToken = tokenResult.value

    // Send token to our server
    if (currentFcmToken) {
      const user = useAuthStore.getState().user
      if (user?.id) {
        await sendTokenToServer(user.id, currentFcmToken)
        fcmRegistered = true
      }
    }

    // Listen for registration updates
    PushNotifications.addListener('registration', async (token) => {
      currentFcmToken = token.value
      const user = useAuthStore.getState().user
      if (user?.id && currentFcmToken) {
        await sendTokenToServer(user.id, currentFcmToken)
        fcmRegistered = true
      }
    })

    // Listen for push notifications received (app in foreground)
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {

      // Get actual notification title/body from FCM payload
      const title = notification.title || notification.data?.title || '🔔 إشعار جديد'
      const body = notification.body || notification.data?.body || 'لديك إشعار جديد في المحفظة'
      const notifType = notification.data?.type || 'general'

      // Play sound & vibrate when notification received while app is in foreground
      try {
        const { playNotificationSound } = await import('@/lib/notification-sound')
        await playNotificationSound(notifType)
      } catch (error) {
      }

      try {
        navigator.vibrate([200, 100, 200])
      } catch {}
    })

    // Listen for push notification action (user tapped)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      // The app will handle navigation based on notification data
    })

    return true
  } catch (error) {
    return false
  }
}

/**
 * Send FCM token to our server
 */
async function sendTokenToServer(userId: string, token: string): Promise<void> {
  try {
    await fetch('/api/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        fcmToken: token,
        deviceName: 'Android APK',
      }),
    })
  } catch (error) {
  }
}

/**
 * Unregister FCM token (on logout)
 */
export async function unregisterFCM(): Promise<void> {
  if (!currentFcmToken) return

  try {
    const user = useAuthStore.getState().user
    if (user?.id) {
      await fetch('/api/fcm/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          fcmToken: currentFcmToken,
        }),
      })
    }
    currentFcmToken = null
    fcmRegistered = false
  } catch (error) {
  }
}

/**
 * Auto-register FCM when user logs in (Capacitor only)
 */
export function setupFCMAutoRegister(): void {
  if (!isCapacitor()) return

  // Subscribe to auth state changes
  const unsubscribe = useAuthStore.subscribe((state, prevState) => {
    const justLoggedIn = state.isAuthenticated && !prevState.isAuthenticated
    const justLoggedOut = !state.isAuthenticated && prevState.isAuthenticated

    if (justLoggedIn && state.user?.id) {
      // Register FCM after login
      setTimeout(() => registerFCMPushNotifications(), 1000)
    }

    if (justLoggedOut) {
      // Unregister FCM on logout
      unregisterFCM()
    }
  })

  // If already logged in, register immediately
  const user = useAuthStore.getState().user
  if (user?.id) {
    setTimeout(() => registerFCMPushNotifications(), 1000)
  }
}
