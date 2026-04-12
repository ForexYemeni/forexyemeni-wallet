'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

/**
 * BalanceChart — Interactive SVG-based balance history chart.
 * Pure CSS/SVG, no external charting library needed.
 */
export default function BalanceChart({
  data = [],
  height = 180,
  color = '#F0B90B',
  gradientStart = 'rgba(240, 185, 11, 0.25)',
  gradientEnd = 'rgba(240, 185, 11, 0)',
}: {
  data: { value: number; label: string }[]
  height?: number
  color?: string
  gradientStart?: string
  gradientEnd?: string
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Generate sample data if none provided
  const chartData = useMemo(() => {
    if (data.length > 0) return data
    // Simulated 7-day data
    return [
      { value: 120, label: 'السبت' },
      { value: 145, label: 'الأحد' },
      { value: 132, label: 'الاثنين' },
      { value: 178, label: 'الثلاثاء' },
      { value: 165, label: 'الأربعاء' },
      { value: 210, label: 'الخميس' },
      { value: 195, label: 'الجمعة' },
    ]
  }, [data])

  const values = chartData.map(d => d.value)
  const min = Math.min(...values) * 0.9
  const max = Math.max(...values) * 1.05
  const range = max - min || 1

  const width = 100 // percentage width
  const padding = { top: 10, right: 5, bottom: 25, left: 5 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const points = chartData.map((d, i) => ({
    x: padding.left + (i / (chartData.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - min) / range) * chartHeight,
    ...d,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`

  // Trend calculation
  const firstVal = values[0]
  const lastVal = values[values.length - 1]
  const trendPercent = ((lastVal - firstVal) / firstVal * 100).toFixed(1)
  const isUp = lastVal >= firstVal

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">تطور الرصيد</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{isUp ? '+' : ''}{trendPercent}%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientStart} />
              <stop offset="100%" stopColor={gradientEnd} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(pct => (
            <line
              key={pct}
              x1={padding.left}
              y1={padding.top + chartHeight * (1 - pct)}
              x2={width - padding.right}
              y2={padding.top + chartHeight * (1 - pct)}
              stroke="currentColor"
              strokeOpacity="0.06"
              strokeDasharray="3 3"
            />
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#balanceGrad)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="0.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points and hover areas */}
          {points.map((p, i) => (
            <g key={i}>
              {/* Invisible hover area */}
              <rect
                x={p.x - (chartWidth / chartData.length) / 2}
                y={padding.top}
                width={chartWidth / chartData.length}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                className="cursor-crosshair"
              />

              {/* Tooltip vertical line */}
              {hoveredIndex === i && (
                <line
                  x1={p.x}
                  y1={padding.top}
                  x2={p.x}
                  y2={padding.top + chartHeight}
                  stroke={color}
                  strokeOpacity="0.3"
                  strokeWidth="0.2"
                  strokeDasharray="2 2"
                />
              )}

              {/* Point dot */}
              {hoveredIndex === i && (
                <circle cx={p.x} cy={p.y} r="1.2" fill={color}>
                  <animate attributeName="r" from="0.5" to="1.5" dur="0.2s" />
                </circle>
              )}

              {/* Always show last point */}
              {i === points.length - 1 && (
                <circle cx={p.x} cy={p.y} r="1" fill={color} />
              )}
            </g>
          ))}

          {/* Labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - 5}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={hoveredIndex === i ? 0.9 : 0.4}
              fontSize="3.5"
              fontWeight={hoveredIndex === i ? '600' : '400'}
              className="transition-opacity duration-200"
            >
              {p.label}
            </text>
          ))}
        </svg>

        {/* Hover tooltip */}
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div
            className="absolute pointer-events-none z-10 glass-card px-2.5 py-1.5 rounded-lg text-xs font-bold animate-scale-in"
            style={{
              left: `${(points[hoveredIndex].x / width) * 100}%`,
              top: `${(points[hoveredIndex].y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <span className="gold-text">{chartData[hoveredIndex].value.toFixed(2)}</span>
            <span className="text-muted-foreground mr-1">USDT</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * KYCProgressRing — Circular progress indicator for KYC steps.
 */
export function KYCProgressRing({
  steps = 3,
  completed = 0,
  size = 48,
  strokeWidth = 4,
  className = '',
}: {
  steps?: number
  completed?: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = Math.min(completed / steps, 1)
  const strokeDashoffset = circumference * (1 - progress)

  const getLabel = () => {
    const pct = Math.round(progress * 100)
    return `${pct}%`
  }

  const getStepText = () => {
    if (completed === 0) return 'لم تبدأ'
    if (completed < steps) return `${completed} من ${steps}`
    return 'مكتمل'
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F0B90B"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(240, 185, 11, 0.4))',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold gold-text">{getLabel()}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium">{getStepText()}</p>
        <p className="text-[10px] text-muted-foreground">{completed === steps ? 'الحساب موثق بالكامل' : 'أكمل الخطوات المتبقية'}</p>
      </div>
    </div>
  )
}
