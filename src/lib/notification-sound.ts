/**
 * Notification sound system using Web Audio API.
 * Generates notification sounds programmatically — no audio files needed.
 * Works in all browsers, PWAs, and Capacitor WebView.
 */

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  // Resume if suspended (required by browsers after user interaction)
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  return audioContext
}

/**
 * Play a pleasant notification chime (2-tone ascending).
 * Sounds like a modern notification bell.
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // First tone (higher)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now) // A5
    osc1.frequency.setValueAtTime(1046.5, now + 0.1) // C6
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.3)

    // Second tone (higher pitch confirmation)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1046.5, now + 0.15) // C6
    osc2.frequency.setValueAtTime(1318.5, now + 0.25) // E6
    gain2.gain.setValueAtTime(0.25, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.5)
  } catch {
    // Silently fail if audio not supported
  }
}

/**
 * Play a success sound (short ascending melody).
 */
export function playSuccessSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + i * 0.12)
      gain.gain.setValueAtTime(0.25, now + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 0.2)
    })
  } catch {
    // Silently fail
  }
}

/**
 * Play a warning/alert sound.
 */
export function playAlertSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // Two quick beeps
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(600, now + i * 0.2)
      gain.gain.setValueAtTime(0.15, now + i * 0.2)
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.2)
      osc.stop(now + i * 0.2 + 0.15)
    }
  } catch {
    // Silently fail
  }
}

/**
 * Request browser notification permission.
 * Must be called after user interaction (click/tap).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Show a browser/system notification with sound.
 */
export async function showBrowserNotification(title: string, body: string, icon?: string) {
  try {
    const hasPermission = await requestNotificationPermission()
    if (!hasPermission) return

    const notification = new Notification(title, {
      body,
      icon: icon || '/logo.png',
      badge: '/logo.png',
      tag: 'forexyemeni-notification',
      dir: 'rtl',
      lang: 'ar',
    })

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000)

    // Focus app when notification is clicked
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // Silently fail
  }
}

/**
 * Vibrate device (if supported) — for mobile/PWA.
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
