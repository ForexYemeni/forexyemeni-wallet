/**
 * Notification sound system - v3.4.0
 * 
 * Priority chain for playing sounds:
 * 1. Check user sound preferences (notification-settings.ts)
 * 2. HTML5 Audio element — uses WAV files from /sounds/ (works in WebView)
 * 3. Web Audio API oscillators — fallback if no audio files available
 *
 * IMPORTANT: In Capacitor APK, we use HTML5 Audio (not LocalNotifications)
 * to avoid creating duplicate notifications. The native FCM service
 * already handles notification display with sound in background.
 * In foreground, this JS code handles sound.
 */

import { shouldPlaySound } from '@/lib/notification-settings'

// Check if running inside Capacitor native app
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor
}

// ============ HTML5 Audio Element (Primary Method - works in both Web and Capacitor) ============

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
      audio.volume = 1.0  // MAX volume for notification reliability
      // Store reference
      audioElements[key as keyof typeof audioElements] = audio
    } catch (error) {
    }
  }
}

/**
 * Play sound using HTML5 Audio element.
 * Works in both web browser and Capacitor WebView.
 */
function playAudioElement(type: 'notification' | 'success' | 'alert'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const audio = audioElements[type]
      if (!audio) {
        // Try creating on the fly
        const src = `/sounds/${type}.wav`
        const fallback = new Audio(src)
        fallback.volume = 1.0
        fallback.onended = () => resolve(true)
        fallback.onerror = () => resolve(false)
        fallback.play().catch(() => resolve(false))
        // Timeout fallback
        setTimeout(() => resolve(true), 3000)
        return
      }

      // Reset to beginning in case it was played before
      audio.currentTime = 0
      audio.volume = 1.0
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
      audio.play().catch(() => resolve(false))
      // Timeout fallback
      setTimeout(() => resolve(true), 3000)
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
async function playWebAudioBeep(frequencies: number[], type: OscillatorType = 'sine', volume = 0.5) {
  const ctx = await getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, now + i * 0.15)
      gain.gain.setValueAtTime(volume, now + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.15)
      osc.stop(now + i * 0.15 + 0.3)
    })
  } catch (error) {
  }
}

// ============ Public API ============

/**
 * Play notification chime sound.
 * Tries HTML5 Audio → Web Audio API.
 * Works in BOTH web browser and Capacitor WebView (foreground).
 */
export async function playNotificationSound(type: string = 'general') {
  // Check user preferences first
  if (!shouldPlaySound(type)) return

  // 1. Try HTML5 Audio element (works in both web and Capacitor)
  const audioOk = await playAudioElement('notification')
  if (audioOk) {
    vibrate([200, 100, 200])
    return
  }

  // 2. Fallback: Web Audio API oscillators
  await playWebAudioBeep([880, 1046.5, 1318.5], 'sine', 0.5)
  vibrate([200, 100, 200])
}

/**
 * Play success sound.
 */
export async function playSuccessSound(type: string = 'general') {
  if (!shouldPlaySound(type)) return

  // 1. Try HTML5 Audio
  const audioOk = await playAudioElement('success')
  if (audioOk) {
    vibrate([200, 100, 200])
    return
  }

  // 2. Fallback: Web Audio
  await playWebAudioBeep([523.25, 659.25, 783.99], 'sine', 0.5)
  vibrate([200, 100, 200])
}

/**
 * Play alert/warning sound.
 */
export async function playAlertSound(type: string = 'general') {
  if (!shouldPlaySound(type)) return

  // 1. Try HTML5 Audio
  const audioOk = await playAudioElement('alert')
  if (audioOk) {
    vibrate([300, 100, 300, 100, 300])
    return
  }

  // 2. Fallback: Web Audio
  await playWebAudioBeep([600, 600], 'square', 0.3)
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
 * In Capacitor, this is skipped (native FCM handles display).
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
