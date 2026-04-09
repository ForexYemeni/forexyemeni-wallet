/**
 * FCM Push Notification Handler - v3.6.2
 * 
 * KEY FIX: Capacitor Push Notifications v8 API changed!
 * - v5/v6: getToken() returned { value: string }  ← OLD, REMOVED
 * - v8:    NO getToken() method! Token comes via 'registration' event after register()
 * 
 * The app loads from Vercel URL (server.url config), but the Capacitor native bridge
 * still injects all installed plugins into the WebView at runtime.
 */

import { useAuthStore } from '@/lib/store'

let fcmRegistered = false
let currentFcmToken: string | null = null

/**
 * Check if running inside native Android app (not browser).
 */
function isNativeApp(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const w = window as any
    
    if (w.Capacitor?.isNativePlatform?.()) return true
    if (w.Capacitor?.getPlatform?.() === 'android') return true
    if (w.Capacitor?.Plugins) return true
    
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('wv') && ua.includes('android')) return true
    
    return false
  } catch {
    return false
  }
}

/**
 * Get PushNotifications plugin from Capacitor bridge.
 */
function getPushPlugin(): any {
  try {
    const w = window as any
    
    if (w.Capacitor?.Plugins?.PushNotifications) {
      return w.Capacitor.Plugins.PushNotifications
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Register for FCM push notifications using Capacitor v8 API.
 * 
 * v8 API Flow:
 *   1. requestPermissions()  → get notification permission
 *   2. register()            → trigger native registration
 *   3. addListener('registration', cb) → receive token via callback
 *   4. send token to server
 */
export async function registerFCMPushNotifications(): Promise<string> {
  if (fcmRegistered && currentFcmToken) {
    return 'already registered: ' + currentFcmToken.substring(0, 20) + '...'
  }

  if (!isNativeApp()) {
    return 'not a native app — running in browser'
  }

  try {
    const w = window as any
    console.log('[FCM] Starting registration via Capacitor v8 API...')
    console.log('[FCM] Capacitor exists:', !!w.Capacitor)
    console.log('[FCM] Platform:', w.Capacitor?.getPlatform?.())
    console.log('[FCM] Plugins:', Object.keys(w.Capacitor?.Plugins || {}))
    
    const PushNotifications = getPushPlugin()
    
    if (!PushNotifications) {
      const availablePlugins = Object.keys(w.Capacitor?.Plugins || {})
      return 'PushNotifications plugin NOT found. Available: ' + availablePlugins.join(', ')
    }

    console.log('[FCM] PushNotifications plugin found!')
    console.log('[FCM] Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(PushNotifications)).filter(m => m !== 'constructor'))

    // Step 1: Request permission
    console.log('[FCM] Requesting permission...')
    const permResult = await PushNotifications.requestPermissions()
    console.log('[FCM] Permission result:', JSON.stringify(permResult))
    
    if (permResult.receive !== 'granted') {
      return 'Permission denied: ' + permResult.receive
    }

    // Step 2: Set up listener BEFORE calling register() (v8 API requirement)
    // In v8, token comes via 'registration' event, not getToken()
    const token = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Token registration timed out (15s)'))
      }, 15000)

      PushNotifications.addListener('registration', (tokenObj: { value: string }) => {
        clearTimeout(timeout)
        console.log('[FCM] registration event received! Token:', tokenObj.value ? tokenObj.value.substring(0, 30) + '...' : 'NULL')
        resolve(tokenObj.value)
      })

      PushNotifications.addListener('registrationError', (err: { error: string }) => {
        clearTimeout(timeout)
        console.error('[FCM] registrationError event:', err.error)
        reject(new Error('Registration failed: ' + err.error))
      })

      // Step 3: Register — this triggers the 'registration' event with the token
      console.log('[FCM] Calling register()...')
      PushNotifications.register()
        .then(() => {
          console.log('[FCM] register() resolved — waiting for registration event...')
        })
        .catch((err: any) => {
          clearTimeout(timeout)
          reject(new Error('register() failed: ' + (err?.message || String(err))))
        })
    })

    currentFcmToken = token
    console.log('[FCM] Token obtained:', currentFcmToken ? currentFcmToken.substring(0, 30) + '...' : 'NULL')

    if (!currentFcmToken) {
      return 'Got NULL token from registration event'
    }

    // Step 4: Send token to server
    const user = useAuthStore.getState().user
    if (user?.id) {
      const ok = await sendTokenToServer(user.id, currentFcmToken)
      if (ok) {
        fcmRegistered = true
        return 'SUCCESS — token registered! ' + currentFcmToken.substring(0, 20) + '...'
      } else {
        return 'Token received but server registration FAILED'
      }
    } else {
      return 'Got token but no user ID yet'
    }
  } catch (error: any) {
    return 'ERROR: ' + (error?.message || String(error))
  }
}

/**
 * Send FCM token to our server.
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
    console.log('[FCM] Server response:', data)
    return data.success === true
  } catch (error: any) {
    console.log('[FCM] Server error:', error?.message)
    return false
  }
}

/**
 * Reset FCM registration flag so it re-registers on next attempt.
 * Called after database switch or user change.
 */
export function resetFCMRegistration(): void {
  fcmRegistered = false
  currentFcmToken = null
  console.log('[FCM] Registration reset — will re-register on next attempt')
}

/**
 * Force re-register FCM token (e.g. after database switch).
 */
export async function forceReregisterFCM(): Promise<string> {
  resetFCMRegistration()
  return registerFCMPushNotifications()
}

export async function unregisterFCM(): Promise<void> {
  if (!currentFcmToken) return
  try {
    const user = useAuthStore.getState().user
    if (user?.id) {
      await fetch('/api/fcm/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, fcmToken: currentFcmToken }),
      })
    }
    currentFcmToken = null
    fcmRegistered = false
  } catch {}
}

/**
 * Setup FCM auto-registration on app start and login.
 */
export function setupFCMAutoRegister(): void {
  const doRegister = async () => {
    const result = await registerFCMPushNotifications()
    console.log('[FCM] setupFCMAutoRegister result:', result)
    
    try {
      (window as any).__fcm_debug = result
    } catch {}
  }

  // Try at 2s, 5s, and 10s (plugins may load late)
  setTimeout(doRegister, 2000)
  setTimeout(doRegister, 5000)
  setTimeout(doRegister, 10000)

  // Watch for login
  useAuthStore.subscribe((state, prevState) => {
    if (state.isAuthenticated && !prevState.isAuthenticated && state.user?.id) {
      resetFCMRegistration() // Always re-register on new login
      setTimeout(doRegister, 2000)
    }
    // Re-register if user ID changes (different account = possibly different DB)
    if (state.isAuthenticated && prevState.isAuthenticated && state.user?.id && prevState.user?.id && state.user.id !== prevState.user.id) {
      resetFCMRegistration()
      setTimeout(doRegister, 2000)
    }
    if (!state.isAuthenticated && prevState.isAuthenticated) {
      unregisterFCM()
    }
  })

  // Listen for notification taps — dispatch event for AppLayout to handle
  const setupNotificationListener = async () => {
    try {
      const PushNotifications = getPushPlugin()
      if (!PushNotifications) return

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
        console.log('[FCM] Notification tapped:', JSON.stringify(notification?.data))
        const data = notification?.notification?.data || notification?.data || {}
        const type = data.type || data.notificationType || ''
        if (type) {
          ;(window as any).__pendingNotification = { type, data }
          window.dispatchEvent(new CustomEvent('notificationTap', { detail: { type, data } }))
        }
      })
    } catch (e) {
      console.log('[FCM] Could not setup notification listener:', e)
    }
  }

  // Try to setup listener after plugins load
  setTimeout(setupNotificationListener, 3000)
  setTimeout(setupNotificationListener, 6000)
}

/**
 * Get FCM debug info (for settings page).
 */
export function getFCMDebugInfo(): { registered: boolean; token: string | null; lastResult: string } {
  return {
    registered: fcmRegistered,
    token: currentFcmToken,
    lastResult: (window as any).__fcm_debug || 'not attempted',
  }
}
