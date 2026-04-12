'use client'

import { Check, X, AlertTriangle } from 'lucide-react'

interface SuccessResultProps {
  type: 'success' | 'error' | 'warning'
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

export default function SuccessResult({
  type,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: SuccessResultProps) {
  const config = {
    success: {
      icon: Check,
      circleColor: 'bg-green-500',
      iconColor: 'text-white',
      animClass: 'success-anim-bounce',
      ringClass: 'success-anim-ring',
      ringColor: 'bg-green-500/30',
    },
    error: {
      icon: X,
      circleColor: 'bg-red-500',
      iconColor: 'text-white',
      animClass: 'error-anim-shake',
      ringClass: '',
      ringColor: '',
    },
    warning: {
      icon: AlertTriangle,
      circleColor: 'bg-amber-500',
      iconColor: 'text-white',
      animClass: 'success-anim-bounce',
      ringClass: '',
      ringColor: '',
    },
  }

  const { icon: Icon, circleColor, iconColor, animClass, ringClass, ringColor } = config[type]

  return (
    <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
      {/* Animated icon */}
      <div className="relative mb-6">
        {/* Expanding ring (success only) */}
        {type === 'success' && (
          <div
            className={`absolute inset-0 rounded-full ${ringColor} ${ringClass}`}
            style={{ width: 80, height: 80 }}
          />
        )}
        <div
          className={`w-20 h-20 rounded-full ${circleColor} flex items-center justify-center ${animClass}`}
        >
          <Icon className={`w-9 h-9 ${iconColor}`} strokeWidth={3} />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-center mb-2">{title}</h3>

      {/* Message */}
      <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed mb-8">
        {message}
      </p>

      {/* Action buttons */}
      <div className="w-full max-w-xs space-y-3">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow haptic-btn"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            onClick={onSecondary}
            className="w-full h-11 bg-white/10 text-foreground font-medium rounded-xl hover:bg-white/20 transition-all"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
