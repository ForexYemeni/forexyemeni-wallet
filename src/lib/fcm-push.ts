/**
 * FCM Push Notification Handler - v3.6.2
 * 
 * ROOT CAUSE FOUND: The app loads from Vercel URL (server.url config),
 * NOT from local files. So `import('@capacitor/push-notifications')` with
 * webpackIgnore:true FAILS because the module doesn't exist on Vercel.
 * 
 * FIX: Use window.Capacitor.Plugins.PushNotifications directly.
 * The Capacitor native bridge injects ALL installed plugins into the
 * WebView at runtime — no import needed!
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
    
    // Check if Capacitor bridge is injected by native layer
    if (w.Capacitor?.isNativePlatform?.()) return true
    if (w.Capacitor?.getPlatform?.() === 'android') return true
    if (w.Capacitor?.Plugins) return true
    
    // Check Android WebView user agent
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('wv') && ua.includes('android')) return true
    
    return false
  } catch {
    return false
  }
}

/**
 * Get PushNotifications plugin from Capacitor bridge.
 * This works because Capacitor injects all native plugins at runtime.
 */
function getPushPlugin(): any {
  try {
    const w = window as any
    
    // Method 1: Direct from Plugins registry (most reliable)
    if (w.Capacitor?.Plugins?.PushNotifications) {
      return w.Capacitor.Plugins.PushNotifications
    }
    
    // Method 2: Try registerPlugin from @capacitor/core (bundled by Next.js)
    // This is async-safe and works in server.url mode
    if (w.Capacitor?.isNativePlatform?.()) {
      // The plugin should be available, let's log what IS available
      const pluginNames = Object.keys(w.Capacitor.Plugins || {})
      console.log('[FCM] Available Capacitor plugins:', pluginNames)
      
      if (pluginNames.includes('PushNotifications')) {
        return w.Capacitor.Plugins.PushNotifications
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Register for FCM push notifications using Capacitor bridge.
 */
export async function registerFCMPushNotifications(): Promise<string> {
  if (fcmRegistered && currentFcmToken) {
    return 'already registered: ' + currentFcmToken.substring(0, 20) + '...'
  }

  if (!isNativeApp()) {
    return 'not a native app — running in browser'
  }

  try {
    console.log('[FCM] Starting registration via Capacitor bridge...')
    console.log('[FCM] Capacitor exists:', !!(window as any).Capacitor)
    console.log('[FCM] Platform:', (window as any).Capacitor?.getPlatform?.())
    console.log('[FCM] Plugins:', Object.keys((window as any).Capacitor?.Plugins || {}))
    
    const PushNotifications = getPushPlugin()
    
    if (!PushNotifications) {
      const availablePlugins = Object.keys((window as any).Capacitor?.Plugins || {})
      return 'PushNotifications plugin NOT found. Available: ' + availablePlugins.join(', ')
    }

    console.log('[FCM] PushNotifications plugin found!')

    // Request permission
    console.log('[FCM] Requesting permission...')
    const permResult = await PushNotifications.requestPermissions()
    console.log('[FCM] Permission result:', JSON.stringify(permResult))
    
    if (permResult.receive !== 'granted') {
      return 'Permission denied: ' + permResult.receive
    }

    // Register
    console.log('[FCM] Registering...')
    await PushNotifications.register()
    console.log('[FCM] Registered!')

    // Get token
    const tokenResult = await PushNotifications.getToken()
    currentFcmToken = tokenResult.value
    console.log('[FCM] Token:', currentFcmToken ? currentFcmToken.substring(0, 30) + '...' : 'NULL')

    if (!currentFcmToken) {
      return 'Got NULL token from getToken()'
    }

    // Send token to server
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
    
    // Save result so debug page can show it
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
      setTimeout(doRegister, 2000)
    }
    if (!state.isAuthenticated && prevState.isAuthenticated) {
      unregisterFCM()
    }
  })
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
