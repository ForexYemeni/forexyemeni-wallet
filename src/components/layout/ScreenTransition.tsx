'use client'

import { useEffect, useState, useRef, type ReactNode } from 'react'

/**
 * Wraps children with a smooth page-enter animation.
 * Each time the `screenKey` changes, the animation replays.
 */
export default function ScreenTransition({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const [key, setKey] = useState(screenKey)
  const prevKey = useRef(screenKey)

  useEffect(() => {
    if (screenKey !== prevKey.current) {
      prevKey.current = screenKey
      setKey(screenKey)
    }
  }, [screenKey])

  return (
    <div key={key} className="page-enter">
      {children}
    </div>
  )
}
