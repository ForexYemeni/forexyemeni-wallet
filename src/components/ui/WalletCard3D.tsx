'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'

interface WalletCard3DProps {
  children: ReactNode
  className?: string
}

/**
 * 3D Wallet Card with Parallax effect.
 * Tracks mouse/touch position and applies 3D transform + specular light.
 */
export default function WalletCard3D({ children, className = '' }: WalletCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('')
  const [shinePos, setShinePos] = useState({ x: 50, y: 50 })
  const [isHovering, setIsHovering] = useState(false)
  const rafRef = useRef<number>(0)

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Calculate rotation (max 12 degrees)
    const rotateY = ((x - centerX) / centerX) * 12
    const rotateX = ((centerY - y) / centerY) * 8

    // Calculate shine position (as percentage)
    const shineX = (x / rect.width) * 100
    const shineY = (y / rect.height) * 100

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setTransform(`rotateY(${rotateY}deg) rotateX(${rotateX}deg)`)
      setShinePos({ x: shineX, y: shineY })
    })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY)
  }, [handleMove])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, [handleMove])

  const handleReset = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setTransform('rotateY(0deg) rotateX(0deg)')
    setShinePos({ x: 50, y: 50 })
    setIsHovering(false)
  }, [])

  // Auto-animate when not interacting (subtle float)
  const [autoAnimate, setAutoAnimate] = useState(true)

  useEffect(() => {
    let frame: number
    let start: number | null = null

    const animate = (timestamp: number) => {
      if (!start) start = timestamp
      const elapsed = (timestamp - start) / 1000

      if (autoAnimate) {
        const rotateY = Math.sin(elapsed * 0.5) * 3
        const rotateX = Math.cos(elapsed * 0.7) * 2
        const shineX = 50 + Math.sin(elapsed * 0.3) * 20
        const shineY = 50 + Math.cos(elapsed * 0.4) * 15
        setTransform(`rotateY(${rotateY}deg) rotateX(${rotateX}deg)`)
        setShinePos({ x: shineX, y: shineY })
      }

      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [autoAnimate])

  return (
    <div className="wallet-card-3d">
      <div
        ref={cardRef}
        className={`wallet-card-inner wallet-card-bg rounded-[20px] relative overflow-hidden ${className}`}
        style={{
          transform,
          '--shine-x': `${shinePos.x}%`,
          '--shine-y': `${shinePos.y}%`,
        } as React.CSSProperties}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => { setIsHovering(true); setAutoAnimate(false) }}
        onMouseLeave={handleReset}
        onTouchMove={handleTouchMove}
        onTouchStart={() => setAutoAnimate(false)}
        onTouchEnd={handleReset}
      >
        {/* Specular light reflection */}
        <div className="card-shine" />

        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full bg-gold/5 -translate-x-24 -translate-y-24 blur-2xl" />
        <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-gold/5 translate-x-20 translate-y-20 blur-2xl" />
        <div className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full bg-blue-500/3 blur-xl" />

        {children}
      </div>
    </div>
  )
}

/** Wallet chip component (gold metallic chip) */
export function WalletChip() {
  return (
    <div className="flex items-center gap-3">
      <div className="wallet-chip" />
      <div className="wallet-contactless" />
    </div>
  )
}

/** Mini sparkline SVG for balance card */
export function MiniSparkline({ data = [], color = '#F0B90B', width = 80, height = 28 }: {
  data?: number[]
  color?: string
  width?: number
  height?: number
}) {
  const points = data.length > 0 ? data : [20, 25, 22, 30, 28, 35, 32, 40, 38, 45]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const svgPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - ((p - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const areaPath = `M 0 ${height} L ${points.map((p, i) => `${(i / (points.length - 1)) * width},${height - ((p - min) / range) * (height - 4) - 2}`).join(' L ')} L ${width} ${height} Z`

  return (
    <svg width={width} height={height} className="overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
      <polyline
        points={svgPoints}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - ((points[points.length - 1] - min) / range) * (height - 4) - 2}
        r="3"
        fill={color}
      />
    </svg>
  )
}
