'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

interface FeedbackItem {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
  duration?: number
}

let idCounter = 0

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLORS = {
  success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', icon: 'text-emerald-400', glow: 'rgba(16, 185, 129, 0.15)' },
  error: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', icon: 'text-red-400', glow: 'rgba(239, 68, 68, 0.15)' },
  warning: { bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)', icon: 'text-amber-400', glow: 'rgba(251, 191, 36, 0.15)' },
  info: { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)', icon: 'text-indigo-400', glow: 'rgba(99, 102, 241, 0.15)' },
}

/**
 * InPageFeedback — shows beautiful animated feedback messages in-page.
 * Success messages trigger confetti. Error messages shake.
 */
export function InPageFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>([])

  const show = useCallback((type: FeedbackItem['type'], message: string, description?: string, duration = 3000) => {
    const id = ++idCounter
    setItems(prev => [...prev, { id, type, message, description, duration }])

    // Auto-remove
    setTimeout(() => {
      setItems(prev => prev.filter(item => item.id !== id))
    }, duration)

    // Trigger side effects
    if (type === 'success') {
      // Trigger confetti
      try { (window as any).__confetti?.trigger() } catch {}
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  // Expose globally
  useEffect(() => {
    ;(window as any).__feedback = { show }
    return () => { delete (window as any).__feedback }
  }, [show])

  if (items.length === 0) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-[9998] flex flex-col items-center gap-2 pointer-events-none">
      {items.map(item => {
        const colors = COLORS[item.type]
        const Icon = ICONS[item.type]

        return (
          <div
            key={item.id}
            className={`pointer-events-auto animate-slide-up max-w-sm w-full rounded-xl p-3.5 flex items-start gap-3 ${item.type === 'error' ? 'animate-shake-error' : ''}`}
            style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              backdropFilter: 'blur(20px)',
              boxShadow: `0 8px 32px ${colors.glow}`,
            }}
          >
            <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.message}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Hook to show in-page feedback from anywhere.
 */
export function useFeedback() {
  const feedback = (typeof window !== 'undefined') ? (window as any).__feedback : null
  return {
    success: (msg: string, desc?: string) => feedback?.show('success', msg, desc),
    error: (msg: string, desc?: string) => feedback?.show('error', msg, desc),
    warning: (msg: string, desc?: string) => feedback?.show('warning', msg, desc),
    info: (msg: string, desc?: string) => feedback?.show('info', msg, desc),
  }
}
