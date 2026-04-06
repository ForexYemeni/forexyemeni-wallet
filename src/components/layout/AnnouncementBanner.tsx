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

const typeConfig = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    icon: Info,
    badge: 'bg-blue-500/20 text-blue-400',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    icon: AlertTriangle,
    badge: 'bg-yellow-500/20 text-yellow-400',
  },
  urgent: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    icon: AlertCircle,
    badge: 'bg-red-500/20 text-red-400',
  },
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

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
        // silent fail
      }
    }
    fetchAnnouncements()
  }, [])

  // Filter visible (not dismissed) announcements
  const visibleAnnouncements = announcements.filter(
    (a) => !dismissedIds.has(a.id)
  )

  // Auto-scroll timer
  const startAutoScroll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (visibleAnnouncements.length <= 1) return

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % visibleAnnouncements.length
        return next
      })
    }, 5000)
  }, [visibleAnnouncements.length])

  useEffect(() => {
    if (visibleAnnouncements.length > 1) {
      startAutoScroll()
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [visibleAnnouncements.length, startAutoScroll])

  // Reset index when visible list changes
  useEffect(() => {
    if (currentIndex >= visibleAnnouncements.length) {
      setCurrentIndex(0)
    }
  }, [visibleAnnouncements.length, currentIndex])

  // Scroll to current card
  useEffect(() => {
    if (scrollRef.current && visibleAnnouncements.length > 0) {
      const cardWidth = scrollRef.current.scrollWidth / visibleAnnouncements.length
      scrollRef.current.scrollTo({
        left: currentIndex * cardWidth,
        behavior: 'smooth',
      })
    }
  }, [currentIndex, visibleAnnouncements.length])

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]))
  }, [])

  // Nothing to show
  if (visibleAnnouncements.length === 0) return null

  const current = visibleAnnouncements[currentIndex]
  if (!current) return null

  const config = typeConfig[current.type] || typeConfig.info
  const Icon = config.icon

  return (
    <div className="sticky top-[57px] z-30 px-4 md:px-6" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="relative overflow-hidden rounded-xl border" style={{ borderRadius: '12px' }}>
          {/* Scrolling container */}
          <div
            ref={scrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {visibleAnnouncements.map((announcement) => {
              const aConfig = typeConfig[announcement.type] || typeConfig.info
              const AIcon = aConfig.icon
              return (
                <div
                  key={announcement.id}
                  className="flex-shrink-0 w-full snap-center p-3 flex items-start gap-3 relative"
                  style={{
                    background: announcement.type === 'urgent'
                      ? 'rgba(239, 68, 68, 0.08)'
                      : announcement.type === 'warning'
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'rgba(59, 130, 246, 0.08)',
                    borderColor: announcement.type === 'urgent'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : announcement.type === 'warning'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(59, 130, 246, 0.2)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: announcement.type === 'urgent'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : announcement.type === 'warning'
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(59, 130, 246, 0.15)',
                    }}
                  >
                    <AIcon
                      className="w-4 h-4"
                      style={{
                        color: announcement.type === 'urgent'
                          ? '#f87171'
                          : announcement.type === 'warning'
                            ? '#fbbf24'
                            : '#60a5fa',
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: announcement.type === 'urgent'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : announcement.type === 'warning'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                          color: announcement.type === 'urgent'
                            ? '#f87171'
                            : announcement.type === 'warning'
                              ? '#fbbf24'
                              : '#60a5fa',
                        }}
                      >
                        {announcement.type === 'urgent' ? 'عاجل' : announcement.type === 'warning' ? 'تنبيه' : 'معلومة'}
                      </span>
                    </div>
                    <p className="text-sm font-bold leading-snug">{announcement.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{announcement.message}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dismiss(announcement.id)
                    }}
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Dot indicators */}
          {visibleAnnouncements.length > 1 && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
              {visibleAnnouncements.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: i === currentIndex
                      ? (current.type === 'urgent'
                        ? '#f87171'
                        : current.type === 'warning'
                          ? '#fbbf24'
                          : '#60a5fa')
                      : 'rgba(255,255,255,0.2)',
                    width: i === currentIndex ? '12px' : '6px',
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
