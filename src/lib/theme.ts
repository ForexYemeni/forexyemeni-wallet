/**
 * Theme management — v2.8.0
 * 
 * Supports 'dark' (default) and 'light' modes.
 * Persists choice in localStorage.
 * Adds/removes 'dark' class on <html> element.
 */

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'forexyemeni-theme'

/** Get current theme (defaults to dark) */
export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    // Check system preference
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light'
    return 'dark'
  } catch {
    return 'dark'
  }
}

/** Save and apply theme */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
  } catch {}
}

/** Apply theme to DOM without saving */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0a0a0f' : '#f5f5f0')
  }
}

/** Toggle between dark and light */
export function toggleTheme(): Theme {
  const current = getTheme()
  const next = current === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

/** Initialize theme on page load (call once in layout) */
export function initTheme(): Theme {
  const theme = getTheme()
  applyTheme(theme)
  return theme
}
