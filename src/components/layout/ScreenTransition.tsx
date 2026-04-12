'use client'

import { useEffect, useState, useRef, type ReactNode } from 'react'

/**
 * Navigation depth levels — dashboard is the root (0), each "deeper" screen
 * increments the depth. Going back to dashboard decrements it.
 */
const SCREEN_DEPTH: Record<string, number> = {
  dashboard: 0,
  deposit: 1,
  withdraw: 1,
  transactions: 1,
  transfer: 1,
  p2p: 1,
  kyc: 1,
  settings: 1,
  notifications: 1,
  referral: 1,
  chat: 1,
  help: 1,
  faq: 1,
  admin: 1,
}

export default function ScreenTransition({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const [key, setKey] = useState(screenKey)
  const [direction, setDirection] = useState<'forward' | 'back' | null>(null)
  const prevKey = useRef(screenKey)

  useEffect(() => {
    if (screenKey !== prevKey.current) {
      const prevDepth = SCREEN_DEPTH[prevKey.current] ?? 0
      const nextDepth = SCREEN_DEPTH[screenKey] ?? 0

      // If going deeper → forward, going back → back, same level → forward (default)
      setDirection(nextDepth > prevDepth ? 'forward' : nextDepth < prevDepth ? 'back' : 'forward')

      prevKey.current = screenKey
      setKey(screenKey)
    }
  }, [screenKey])

  const animClass = direction === 'back' ? 'page-enter-back' : direction === 'forward' ? 'page-enter-forward' : 'page-enter'

  return (
    <div key={key} className={animClass}>
      {children}
    </div>
  )
}
