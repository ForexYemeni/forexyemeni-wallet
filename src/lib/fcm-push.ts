/**
 * FCM Push Notification Handler for Capacitor (Android APK)
 * Registers device for FCM and handles incoming push notifications.
 * Only activates when running inside Capacitor native app.
 *
 * v3.5.0 FIX: When push notification received in foreground,
 * we now ALSO play sound via JS (not just vibrate).
 * This provides a backup in case native sound fails.
 */
import { useAuthStore } from '@/lib/store'

let fcmRegistered = false
let currentFcmToken: string | null = null

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
    const pushModule = await import(/* webpackIgnore: true */ '@capacitor/push-notifications')
    const PushNotifications = pushModule.PushNotifications || pushModule.default?.PushNotifications

    const permResult = await PushNotifications.requestPermissions()
    if (permResult.receive !== 'granted') return false

    await PushNotifications.register()

    const tokenResult = await PushNotifications.getToken()
    currentFcmToken = tokenResult.value

    if (currentFcmToken) {
      const user = useAuthStore.getState().user
      if (user?.id) {
        await sendTokenToServer(user.id, currentFcmToken)
        fcmRegistered = true
      }
    }

    PushNotifications.addListener('registration', async (token) => {
      currentFcmToken = token.value
      const user = useAuthStore.getState().user
      if (user?.id && currentFcmToken) {
        await sendTokenToServer(user.id, currentFcmToken)
        fcmRegistered = true
      }
    })

    // v3.5.0 FIX: When push notification received in foreground,
    // play sound via JS as BACKUP (native should also play)
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('[FCM] pushNotificationReceived in foreground')
      
      // Play sound AND vibrate via JS
      try {
        const { playNotificationSound, vibrate } = await import('@/lib/notification-sound')
        vibrate([300, 100, 300])
        playNotificationSound('general').catch(() => {})
      } catch {}
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      // App will handle navigation based on notification data
    })

    return true
  } catch (error) {
    return false
  }
}

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

export function setupFCMAutoRegister(): void {
  if (!isCapacitor()) return

  const unsubscribe = useAuthStore.subscribe((state, prevState) => {
    const justLoggedIn = state.isAuthenticated && !prevState.isAuthenticated
    const justLoggedOut = !state.isAuthenticated && prevState.isAuthenticated

    if (justLoggedIn && state.user?.id) {
      setTimeout(() => registerFCMPushNotifications(), 1000)
    }

    if (justLoggedOut) {
      unregisterFCM()
    }
  })

  const user = useAuthStore.getState().user
  if (user?.id) {
    setTimeout(() => registerFCMPushNotifications(), 1000)
  }
}
