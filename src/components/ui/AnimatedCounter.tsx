'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * AnimatedCounter — smoothly counts from 0 to target number.
 * Supports decimal formatting and direction (up/down).
 */
export default function AnimatedCounter({
  value,
  decimals = 2,
  duration = 800,
  prefix = '',
  suffix = '',
  className = '',
  glowOnComplete = false,
}: {
  value: number
  decimals?: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
  glowOnComplete?: boolean
}) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValue = useRef(value)
  const animationRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  useEffect(() => {
    const startVal = prevValue.current
    const diff = value - startVal

    if (diff === 0) return

    startRef.current = performance.now()
    prevValue.current = value

    const animate = (now: number) => {
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startVal + diff * eased

      setDisplayValue(current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationRef.current)
  }, [value, duration])

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={`tabular-nums ${glowOnComplete ? 'number-glow' : ''} ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  )
}

/**
 * TopProgressBar — a gold progress bar at the very top of the page.
 * Shows during API calls or operations.
 */
export function TopProgressBar() {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => {
    setProgress(0)
    setVisible(true)

    let current = 0
    intervalRef.current = setInterval(() => {
      current += Math.random() * 15
      if (current >= 90) {
        current = 90
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
      setProgress(current)
    }, 200)
  }, [])

  const complete = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setProgress(100)
    setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 400)
  }, [])

  const fail = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setVisible(false)
    setProgress(0)
  }, [])

  // Expose methods globally so any component can call them
  useEffect(() => {
    (window as any).__topProgressBar = { start, complete, fail }
    return () => { delete (window as any).__topProgressBar }
  }, [start, complete, fail])

  if (!visible) return null

  return (
    <div
      className="top-progress-bar"
      style={{ width: `${progress}%` }}
    />
  )
}

/**
 * Helper hook to use the top progress bar.
 */
export function useProgressBar() {
  const bar = (typeof window !== 'undefined') ? (window as any).__topProgressBar : null
  return {
    start: bar?.start ?? (() => {}),
    complete: bar?.complete ?? (() => {}),
    fail: bar?.fail ?? (() => {}),
  }
}
