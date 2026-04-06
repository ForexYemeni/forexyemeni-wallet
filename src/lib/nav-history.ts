// Simple navigation history tracker
// Stored only in memory - resets on app reload
// Completely independent from Zustand store

const history: string[] = []
const MAX_HISTORY = 50

export function navPush(screen: string) {
  // Don't push duplicate consecutive screens
  if (history.length > 0 && history[history.length - 1] === screen) return
  if (history.length >= MAX_HISTORY) history.shift()
  history.push(screen)
}

export function navBack(): string | null {
  if (history.length === 0) return null
  return history.pop() || null
}

export function navClear() {
  history.length = 0
}

export function navSize(): number {
  return history.length
}
