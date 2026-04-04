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
    const { PushNotifications } = await import('@capacitor/push-notifications')

    // Request permission
    const permResult = await PushNotifications.requestPermissions()
    console.log('[FCM] Permission result:', permResult.receive)

    if (permResult.receive !== 'granted') {
      console.log('[FCM] Permission denied')
      return false
    }

    // Register for push notifications
    await PushNotifications.register()
    console.log('[FCM] Registered successfully')

    // Get FCM token
    const tokenResult = await PushNotifications.getToken()
    currentFcmToken = tokenResult.value
    console.log('[FCM] Token received:', currentFcmToken?.substring(0, 20) + '...')

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
      console.log('[FCM] New token:', token.value?.substring(0, 20) + '...')
      currentFcmToken = token.value
      const user = useAuthStore.getState().user
      if (user?.id && currentFcmToken) {
        await sendTokenToServer(user.id, currentFcmToken)
        fcmRegistered = true
      }
    })

    // Listen for push notifications received (app in foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[FCM] Notification received:', notification)
      // Vibrate the device
      try {
        navigator.vibrate([200, 100, 200])
      } catch {}
    })

    // Listen for push notification action (user tapped)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[FCM] Notification tapped:', notification)
      // The app will handle navigation based on notification data
    })

    return true
  } catch (error) {
    console.error('[FCM] Registration failed:', error)
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
    console.log('[FCM] Token sent to server')
  } catch (error) {
    console.error('[FCM] Failed to send token to server:', error)
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
    console.error('[FCM] Failed to unregister:', error)
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
