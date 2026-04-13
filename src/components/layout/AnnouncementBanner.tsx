'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Info, AlertTriangle, AlertCircle } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'urgent'
  active: boolean
  expiresAt?: unknown
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [fade, setFade] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/announcements')
        const data = await res.json()
        if (data.success && Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements)
        }
      } catch {
        // silent
      }
    }
    fetchAnnouncements()
  }, [])

  // Filter visible
  const visible = announcements.filter((a) => !dismissedIds.has(a.id))
  const total = visible.length

  // Slide to index with fade animation
  const slideTo = useCallback((index: number) => {
    setFade(false)
    fadeRef.current = setTimeout(() => {
      setCurrentIndex(index % (total || 1))
      setFade(true)
    }, 200)
  }, [total])

  // Auto-scroll
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (total <= 1) return

    timerRef.current = setInterval(() => {
      slideTo((currentIndex + 1) % total)
    }, 5000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (fadeRef.current) clearTimeout(fadeRef.current)
    }
  }, [total, currentIndex, slideTo])

  // Clamp index when items dismissed
  useEffect(() => {
    if (total > 0 && currentIndex >= total) {
      if (fadeRef.current) clearTimeout(fadeRef.current)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setCurrentIndex(0)
      setFade(true)
    }
  }, [total, currentIndex])

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]))
  }, [])

  if (total === 0) return null

  const item = visible[currentIndex]
  if (!item) return null

  const urgent = item.type === 'urgent'
  const warn = item.type === 'warning'

  const color = urgent ? '#f87171' : warn ? '#fbbf24' : '#60a5fa'
  const bg = urgent ? 'rgba(239,68,68,0.08)' : warn ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)'
  const iconBg = urgent ? 'rgba(239,68,68,0.15)' : warn ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)'
  const label = urgent ? 'عاجل' : warn ? 'تنبيه' : 'معلومة'
  const Icon = urgent ? AlertCircle : warn ? AlertTriangle : Info

  return (
    <div className="px-4 md:px-6 mb-3" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="relative overflow-hidden rounded-xl border border-white/10" style={{ background: bg, borderRadius: '12px' }}>
          <div className="p-3 flex items-start gap-3 transition-opacity duration-200" style={{ opacity: fade ? 1 : 0 }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: iconBg }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1" style={{ background: iconBg, color }}>
                {label}
              </span>
              <p className="text-sm font-bold leading-snug">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{item.message}</p>
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {total > 1 && (
            <div className="flex items-center justify-center gap-1.5 pb-2">
              {visible.map((_, i) => (
                <button
                  key={visible[i].id}
                  onClick={() => slideTo(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    background: i === currentIndex ? color : 'rgba(255,255,255,0.2)',
                    width: i === currentIndex ? '12px' : '6px',
                    height: '6px',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
