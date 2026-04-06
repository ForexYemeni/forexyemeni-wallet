/**
 * FCM Push Notification Handler for Capacitor (Android APK)
 * 
 * IMPORTANT FIX: The app loads from Vercel URL (not local files),
 * so we MUST try to register FCM even when isCapacitor() might not
 * work perfectly. We use @capacitor/core's nativeBridge detection
 * as a more reliable check.
 *
 * v3.6.1 FIX: Relaxed Capacitor detection + added retry logic.
 * Previously, FCM token was NEVER registered because isCapacitor()
 * returned false in WebView mode (server.url config).
 */
import { useAuthStore } from '@/lib/store'

let fcmRegistered = false
let currentFcmToken: string | null = null

/**
 * More reliable Capacitor detection.
 * Check for native bridge AND Capacitor object AND Android platform.
 */
function isNativeApp(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const w = window as any
    
    // Method 1: Check Capacitor native bridge
    if (w.Capacitor?.isNativePlatform?.()) return true
    
    // Method 2: Check for Android WebView user agent
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('wv') && ua.includes('android')) return true
    
    // Method 3: Check if running inside our APK package
    if (w.Capacitor?.getPlatform?.() === 'android') return true
    
    // Method 4: Check for the Capacitor JS module loaded
    if (w.Capacitor?.Plugins?.PushNotifications) return true
    
    return false
  } catch {
    return false
  }
}

/**
 * Register for FCM push notifications.
 * Retries up to 3 times with delays.
 */
export async function registerFCMPushNotifications(): Promise<boolean> {
  if (fcmRegistered) return true

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[FCM] Registration attempt ${attempt}/3`)
      
      // Try to load Capacitor Push Notifications plugin
      const pushModule = await import(/* webpackIgnore: true */ '@capacitor/push-notifications')
      const PushNotifications = pushModule.PushNotifications || pushModule.default?.PushNotifications

      if (!PushNotifications) {
        console.log('[FCM] PushNotifications plugin not available')
        return false
      }

      // Request permission
      const permResult = await PushNotifications.requestPermissions()
      console.log('[FCM] Permission result:', permResult.receive)
      if (permResult.receive !== 'granted') {
        console.log('[FCM] Permission denied')
        return false
      }

      // Register for push
      await PushNotifications.register()
      console.log('[FCM] Registered successfully')

      // Get token
      const tokenResult = await PushNotifications.getToken()
      currentFcmToken = tokenResult.value
      console.log('[FCM] Got token:', currentFcmToken?.substring(0, 20) + '...')

      if (currentFcmToken) {
        const user = useAuthStore.getState().user
        if (user?.id) {
          const ok = await sendTokenToServer(user.id, currentFcmToken)
          if (ok) {
            fcmRegistered = true
            console.log('[FCM] Token registered to server ✓')
          }
        } else {
          console.log('[FCM] No user ID yet, will retry')
        }
      }

      // Listen for token refresh
      PushNotifications.addListener('registration', async (token) => {
        console.log('[FCM] Token refreshed:', token.value?.substring(0, 20) + '...')
        currentFcmToken = token.value
        const user = useAuthStore.getState().user
        if (user?.id && currentFcmToken) {
          await sendTokenToServer(user.id, currentFcmToken)
          fcmRegistered = true
        }
      })

      // Listen for foreground notifications → play sound
      PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        console.log('[FCM] Notification received in foreground')
        try {
          const { playNotificationSound, vibrate } = await import('@/lib/notification-sound')
          vibrate([300, 100, 300])
          playNotificationSound('general').catch(() => {})
        } catch {}
      })

      // Listen for notification tap
      PushNotifications.addListener('pushNotificationActionPerformed', () => {})

      if (fcmRegistered) return true
    } catch (error) {
      console.log(`[FCM] Attempt ${attempt} failed:`, error)
      // Wait before retry (2s, 4s)
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000 * attempt))
      }
    }
  }

  return false
}

/**
 * Send FCM token to server so push notifications can be sent.
 * Returns true if successful.
 */
async function sendTokenToServer(userId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        fcmToken: token,
        deviceName: 'Android APK',
      }),
    })
    const data = await res.json()
    console.log('[FCM] Server registration response:', data)
    return data.success === true
  } catch (error) {
    console.log('[FCM] Failed to register token to server:', error)
    return false
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
  } catch {}
}

/**
 * Setup FCM auto-registration.
 * Tries to register immediately + watches for login events.
 */
export function setupFCMAutoRegister(): void {
  // Try registration immediately (don't skip even if isNativeApp is uncertain)
  const tryRegister = () => {
    const user = useAuthStore.getState().user
    if (user?.id) {
      console.log('[FCM] setupFCMAutoRegister - attempting registration...')
      registerFCMPushNotifications().then(ok => {
        console.log('[FCM] setupFCMAutoRegister result:', ok)
      })
    }
  }

  // Try immediately
  setTimeout(tryRegister, 2000)

  // Also try after a delay (in case Capacitor plugins load late)
  setTimeout(tryRegister, 5000)

  // Watch for login events
  const unsubscribe = useAuthStore.subscribe((state, prevState) => {
    const justLoggedIn = state.isAuthenticated && !prevState.isAuthenticated
    const justLoggedOut = !state.isAuthenticated && prevState.isAuthenticated

    if (justLoggedIn && state.user?.id) {
      setTimeout(() => registerFCMPushNotifications(), 1500)
    }

    if (justLoggedOut) {
      unregisterFCM()
    }
  })
}
