/**
 * Notification sound system - v3.5.0
 * 
 * Priority chain for playing sounds:
 * 1. Check user sound preferences (notification-settings.ts)
 * 2. Force AudioContext resume (CRITICAL: fixes suspended context issue)
 * 3. HTML5 Audio element — uses WAV files from /sounds/
 * 4. Web Audio API oscillators — fallback
 *
 * v3.5.0 FIX: AudioContext.resume() is called BEFORE every play attempt.
 * Previous versions failed because AudioContext was suspended (no recent user
 * gesture) and the play() call silently failed.
 */

import { shouldPlaySound } from '@/lib/notification-settings'

// Check if running inside Capacitor native app
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor
}

// ============ Audio Context Management ============

let audioContext: AudioContext | null = null

/**
 * Get or create AudioContext. ALWAYS tries to resume it.
 * This is the KEY FIX for v3.5.0 — previous versions assumed AudioContext
 * was active, but in Capacitor WebView it can be suspended at any time.
 */
async function getAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    // ALWAYS try to resume — this is critical!
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    return audioContext
  } catch (error) {
    return null
  }
}

// ============ HTML5 Audio Element (Primary Method) ============

const audioElements: Record<string, HTMLAudioElement | null> = {
  notification: null,
  success: null,
  alert: null,
}

let audioPreloaded = false

/**
 * Preload audio files so they play instantly when needed.
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
      audio.volume = 1.0
      audioElements[key as keyof typeof audioElements] = audio
    } catch (error) {
    }
  }
}

/**
 * Play sound using HTML5 Audio element.
 */
function playAudioElement(type: 'notification' | 'success' | 'alert'): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      // STEP 1: Force AudioContext resume BEFORE playing
      await getAudioContext()
      
      // STEP 2: Get or create audio element
      let audio = audioElements[type]
      if (!audio) {
        const src = `/sounds/${type}.wav`
        audio = new Audio(src)
        audio.volume = 1.0
        audioElements[type] = audio
      }

      // STEP 3: Reset and play
      audio.currentTime = 0
      audio.volume = 1.0
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
      
      try {
        await audio.play()
        resolve(true)
      } catch (playError) {
        // If HTML5 Audio fails, try Web Audio API
        resolve(false)
      }
    } catch {
      resolve(false)
    }
  })
}

// ============ Web Audio API Fallback ============

let audioInitialized = false

/**
 * Initialize AudioContext and preload audio files.
 * Should be called after first user interaction.
 */
export function initAudioOnInteraction() {
  if (audioInitialized) return
  audioInitialized = true
  getAudioContext().catch(() => {})
  preloadAudioFiles()
}

// Register interaction listener — use persistent (not once-only) listeners
// This ensures AudioContext gets resumed on EVERY interaction, not just the first
if (typeof document !== 'undefined') {
  const resumeAudio = () => {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }
    initAudioOnInteraction()
  }
  document.addEventListener('click', resumeAudio, { passive: true })
  document.addEventListener('touchstart', resumeAudio, { passive: true })
  document.addEventListener('touchend', resumeAudio, { passive: true })
}

/**
 * Play a beep using Web Audio API oscillators (fallback method).
 */
async function playWebAudioBeep(frequencies: number[], type: OscillatorType = 'sine', volume = 0.5) {
  const ctx = await getAudioContext()
  if (!ctx) return false

  try {
    const now = ctx.currentTime
    frequencies.forEach((freq, i) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, now + i * 0.15)
      gain.gain.setValueAtTime(volume, now + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3)
      osc.connect(gain)
      gain.connect(ctx!.destination)
      osc.start(now + i * 0.15)
      osc.stop(now + i * 0.15 + 0.3)
    })
    return true
  } catch (error) {
    return false
  }
}

// ============ Public API ============

/**
 * Play notification chime sound.
 * Tries: AudioContext resume → HTML5 Audio → Web Audio API.
 */
export async function playNotificationSound(type: string = 'general') {
  if (!shouldPlaySound(type)) return

  // 1. Force AudioContext resume (KEY FIX)
  await getAudioContext()

  // 2. Try HTML5 Audio element
  const audioOk = await playAudioElement('notification')
  if (audioOk) {
    vibrate([200, 100, 200])
    return
  }

  // 3. Fallback: Web Audio API oscillators
  const beepOk = await playWebAudioBeep([880, 1046.5, 1318.5], 'sine', 0.8)
  if (beepOk) {
    vibrate([200, 100, 200])
  }
}

/**
 * Play success sound.
 */
export async function playSuccessSound(type: string = 'general') {
  if (!shouldPlaySound(type)) return

  await getAudioContext()

  const audioOk = await playAudioElement('success')
  if (audioOk) {
    vibrate([200, 100, 200])
    return
  }

  const beepOk = await playWebAudioBeep([523.25, 659.25, 783.99], 'sine', 0.8)
  if (beepOk) {
    vibrate([200, 100, 200])
  }
}

/**
 * Play alert/warning sound.
 */
export async function playAlertSound(type: string = 'general') {
  if (!shouldPlaySound(type)) return

  await getAudioContext()

  const audioOk = await playAudioElement('alert')
  if (audioOk) {
    vibrate([300, 100, 300, 100, 300])
    return
  }

  const beepOk = await playWebAudioBeep([600, 600], 'square', 0.5)
  if (beepOk) {
    vibrate([300, 100, 300, 100, 300])
  }
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
  }
}
