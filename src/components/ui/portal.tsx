'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Portal component that safely renders children into document.body.
 * Handles SSR by only rendering on the client after mount.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}
