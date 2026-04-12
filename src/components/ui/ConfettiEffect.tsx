'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const COLORS = ['#F0B90B', '#FCD535', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#ef4444', '#3b82f6']

interface ConfettiPiece {
  id: number
  x: number
  y: number
  tx: number
  ty: number
  tr: number
  color: string
  shape: 'rect' | 'circle'
  duration: number
  size: number
}

/**
 * ConfettiEffect — triggers a confetti burst animation.
 * Place once at app root level. Call `triggerConfetti()` from anywhere.
 */
export function ConfettiEffect() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const idCounter = useRef(0)

  const trigger = useCallback((originX?: number, originY?: number, count = 40) => {
    const cx = originX ?? window.innerWidth / 2
    const cy = originY ?? window.innerHeight / 3

    const newPieces: ConfettiPiece[] = Array.from({ length: count }, () => ({
      id: idCounter.current++,
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 20,
      tx: (Math.random() - 0.5) * 400,
      ty: Math.random() * 300 + 100,
      tr: (Math.random() - 0.5) * 720,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      duration: 1 + Math.random() * 1.5,
      size: 6 + Math.random() * 6,
    }))

    setPieces(prev => [...prev, ...newPieces])

    // Clean up after animation
    setTimeout(() => {
      setPieces(prev => prev.filter(p => !newPieces.find(np => np.id === p.id)))
    }, 3000)
  }, [])

  // Expose trigger globally
  useEffect(() => {
    ;(window as any).__confetti = { trigger }
    return () => { delete (window as any).__confetti }
  }, [trigger])

  if (pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {pieces.map(piece => (
        <div
          key={piece.id}
          className={`confetti-piece ${piece.shape}`}
          style={{
            left: piece.x,
            top: piece.y,
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.shape === 'rect' ? piece.size * 0.6 : piece.size,
            '--tx': `${piece.tx}px`,
            '--ty': `${piece.ty}px`,
            '--tr': `${piece.tr}deg`,
            '--duration': `${piece.duration}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/**
 * Helper hook to trigger confetti from anywhere in the app.
 */
export function useConfetti() {
  const confetti = (typeof window !== 'undefined') ? (window as any).__confetti : null
  return {
    trigger: confetti?.trigger ?? (() => {}),
  }
}

/**
 * Standalone function to trigger confetti from anywhere.
 * Can be imported directly: import { triggerConfetti } from '@/components/ui/ConfettiEffect'
 */
export function triggerConfetti(originX?: number, originY?: number, count?: number) {
  const confetti = (typeof window !== 'undefined') ? (window as any).__confetti : null
  confetti?.trigger(originX, originY, count)
}
