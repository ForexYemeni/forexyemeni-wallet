/**
 * Notification sound system - v2.7.0
 * 
 * Priority chain for playing sounds:
 * 1. Check user sound preferences (notification-settings.ts)
 * 2. Capacitor native notifications (Android APK) — with sound file
 * 3. HTML5 Audio element — uses WAV files from /sounds/ (most reliable on web)
 * 4. Web Audio API oscillators — fallback if no audio files available
 */

import { shouldPlaySound } from '@/lib/notification-settings'

// Check if running inside Capacitor native app
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor
}

// ============ Capacitor Native Sound ============

/**
 * Play notification sound using Capacitor native notifications.
 * Works reliably in Android APK even in background.
 */
async function playNativeSound(title: string, body: string): Promise<boolean> {
  // In Capacitor APK: native FCM (MyFirebaseMessagingService) already handles
  // notification display with sound. Do NOT create duplicate local notifications.
  // This function is intentionally disabled in Capacitor to prevent double notifications.
  if (isCapacitor()) return false

  // Only for web — not applicable (web doesn't have Capacitor local notifications)
  return false
}

// ============ HTML5 Audio Element (Primary Web Method) ============

// Preload audio elements for instant playback
const audioElements: Record<string, HTMLAudioElement | null> = {
  notification: null,
  success: null,
  alert: null,
}

let audioPreloaded = false

/**
 * Preload audio files so they play instantly when needed.
 * Should be called after first user interaction.
 */
function preloadAudioFiles() {
  if (audioPreloaded || typeof window === 'undefined') return
  audioPreloaded = true

  const soundFiles = {
    notification: '/sounds/notification.wav',
    success: '/sounds/success.wav',
    alert: '/sounds/alert.wav',
  }

  for (const [key, src] of Object.entries(soundFiles)) {
    try {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.volume = 0.6
      // Store reference
      audioElements[key as keyof typeof audioElements] = audio
    } catch (error) {
    }
  }
}

/**
 * Play sound using HTML5 Audio element (most reliable on web).
 */
function playAudioElement(type: 'notification' | 'success' | 'alert'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const audio = audioElements[type]
      if (!audio) {
        // Try creating on the fly
        const src = `/sounds/${type}.wav`
        const fallback = new Audio(src)
        fallback.volume = 0.6
        fallback.onended = () => resolve(true)
        fallback.onerror = () => resolve(false)
        fallback.play().catch(() => resolve(false))
        // Timeout fallback
        setTimeout(() => resolve(true), 2000)
        return
      }

      // Reset to beginning in case it was played before
      audio.currentTime = 0
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
      audio.play().catch(() => resolve(false))
      // Timeout fallback
      setTimeout(() => resolve(true), 2000)
    } catch {
      resolve(false)
    }
  })
}

// ============ Web Audio API Fallback ============

let audioContext: AudioContext | null = null
let audioInitialized = false

/**
 * Get or create AudioContext. Handles suspended state properly.
 */
async function getAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    return audioContext
  } catch (error) {
    return null
  }
}

/**
 * Initialize AudioContext and preload audio files after user interaction.
 * Must be called once from a click/tap handler.
 */
export function initAudioOnInteraction() {
  if (audioInitialized) return
  audioInitialized = true
  // Pre-create AudioContext
  getAudioContext().catch(() => {})
  // Preload audio files
  preloadAudioFiles()
}

// Register interaction listener once (auto-initialize on first user interaction)
if (typeof document !== 'undefined') {
  const handler = () => {
    initAudioOnInteraction()
    document.removeEventListener('click', handler)
    document.removeEventListener('touchstart', handler)
  }
  document.addEventListener('click', handler, { once: true })
  document.addEventListener('touchstart', handler, { once: true })
}

/**
 * Play a beep using Web Audio API oscillators (fallback method).
 */
async function playWebAudioBeep(frequencies: number[], type: OscillatorType = 'sine', volume = 0.3) {
  const ctx = await getAudioContext()
  if (!ctx) return

  try {
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
  } catch (error) {
  }
}

// ============ Public API ============

/**
 * Play notification chime sound.
 * Tries native Android → HTML5 Audio → Web Audio API.
 * @param type - Notification type ('deposit', 'withdrawal', 'kyc', etc.)
 *               Used to check user's sound preferences.
 */
export async function playNotificationSound(type: string = 'general') {
  // Check user preferences first
  if (!shouldPlaySound(type)) return

  // 1. Try native sound first (Capacitor APK)
  const nativeOk = await playNativeSound('🔔', 'لديك إشعار جديد')
  if (nativeOk) return

  // 2. Try HTML5 Audio element (web - most reliable)
  const audioOk = await playAudioElement('notification')
  if (audioOk) {
    vibrate([200, 100, 200])
    return
  }

  // 3. Fallback: Web Audio API oscillators
  await playWebAudioBeep([880, 1046.5, 1318.5], 'sine', 0.4)
  vibrate([200, 100, 200])
}

/**
 * Play success sound.
 * @param type - Notification type for preference check
 */
export async function playSuccessSound(type: string = 'general') {
  if (!shouldPlaySound(type)) return

  // 1. Try native
  const nativeOk = await playNativeSound('✅', 'تمت العملية بنجاح')
  if (nativeOk) return

  // 2. Try HTML5 Audio
  const audioOk = await playAudioElement('success')
  if (audioOk) {
    vibrate([200, 100, 200])
    return
  }

  // 3. Fallback: Web Audio
  await playWebAudioBeep([523.25, 659.25, 783.99], 'sine', 0.35)
  vibrate([200, 100, 200])
}

/**
 * Play alert/warning sound.
 * @param type - Notification type for preference check
 */
export async function playAlertSound(type: string = 'general') {
  if (!shouldPlaySound(type)) return

  // 1. Try native
  const nativeOk = await playNativeSound('⚠️', 'تنبيه مهم')
  if (nativeOk) return

  // 2. Try HTML5 Audio
  const audioOk = await playAudioElement('alert')
  if (audioOk) {
    vibrate([300, 100, 300, 100, 300])
    return
  }

  // 3. Fallback: Web Audio
  await playWebAudioBeep([600, 600], 'square', 0.2)
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
    // Silently fail — notification permission might be denied
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
