/**
 * Notification sound system.
 * Uses @capacitor/local-notifications for native Android sound (APK).
 * Falls back to Web Audio API for browser/PWA.
 */

// Check if running inside Capacitor native app
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor
}

/**
 * Play notification sound using Capacitor native notifications.
 * Works reliably in Android APK even in background.
 */
async function playNativeSound(title: string, body: string): Promise<boolean> {
  if (!isCapacitor()) return false

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    // Check permission
    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return false

    // Schedule a local notification with sound (fires immediately)
    await LocalNotifications.schedule({
      notifications: [{
        title,
        body,
        id: Date.now() % 100000,
        sound: 'notification.wav',
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
        priority: 'high' as any,
        visibility: 'public' as any,
        autoCancel: true,
      }],
    })

    return true
  } catch (error) {
    console.error('[Native Sound Error]', error)
    return false
  }
}

// ============ Web Audio API Fallback ============

let audioContext: AudioContext | null = null
let audioInitialized = false

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }
    return audioContext
  } catch {
    return null
  }
}

/**
 * Initialize AudioContext after user interaction.
 * Must be called once from a click/tap handler.
 */
export function initAudioOnInteraction() {
  if (audioInitialized) return
  audioInitialized = true
  // Pre-create and resume AudioContext on first interaction
  getAudioContext()
}

// Register interaction listener once
if (typeof document !== 'undefined') {
  const handler = () => {
    initAudioOnInteraction()
    document.removeEventListener('click', handler)
    document.removeEventListener('touchstart', handler)
  }
  document.addEventListener('click', handler, { once: true })
  document.addEventListener('touchstart', handler, { once: true })
}

function playWebAudioBeep(frequencies: number[], type: OscillatorType = 'sine', volume = 0.3) {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now + i * 0.12)
    gain.gain.setValueAtTime(volume, now + i * 0.12)
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + i * 0.12)
    osc.stop(now + i * 0.12 + 0.25)
  })
}

/**
 * Play notification chime sound.
 * Tries native Android sound first, falls back to Web Audio.
 */
export async function playNotificationSound() {
  // Try native sound first (Capacitor APK)
  const nativeOk = await playNativeSound('🔔', 'لديك إشعار جديد')
  if (nativeOk) return

  // Fallback: Web Audio API
  playWebAudioBeep([880, 1046.5, 1318.5], 'sine', 0.4)
  vibrate([200, 100, 200])
}

/**
 * Play success sound.
 */
export async function playSuccessSound() {
  // Try native
  const nativeOk = await playNativeSound('✅', 'تمت العملية بنجاح')
  if (nativeOk) return

  // Fallback
  playWebAudioBeep([523.25, 659.25, 783.99], 'sine', 0.35)
  vibrate([200, 100, 200])
}

/**
 * Play alert/warning sound.
 */
export async function playAlertSound() {
  // Try native
  const nativeOk = await playNativeSound('⚠️', 'تنبيه مهم')
  if (nativeOk) return

  // Fallback
  playWebAudioBeep([600, 600], 'square', 0.2)
  vibrate([300, 100, 300, 100, 300])
}

/**
 * Request browser notification permission.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Show a browser/system notification.
 */
export async function showBrowserNotification(title: string, body: string, icon?: string) {
  // In Capacitor, native notification already handles display
  if (isCapacitor()) return

  try {
    const hasPermission = await requestNotificationPermission()
    if (!hasPermission) return

    const notification = new Notification(title, {
      body,
      icon: icon || '/icon-512.png',
      badge: '/icon-512.png',
      tag: 'forexyemeni-notification',
      dir: 'rtl',
      lang: 'ar',
    })

    setTimeout(() => notification.close(), 5000)
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // Silently fail
  }
}

/**
 * Vibrate device.
 */
export function vibrate(pattern: number | number[] = [200, 100, 200]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // Silently fail
  }
}
