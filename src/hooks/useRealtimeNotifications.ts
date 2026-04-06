'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { playNotificationSound, playSuccessSound, playAlertSound, showBrowserNotification, vibrate, initAudioOnInteraction } from '@/lib/notification-sound'

interface NotificationItem {
  id: string
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

/**
 * Real-time notification listener hook.
 * Polls every 5 seconds to detect new notifications.
 * Plays sound (HTML5 Audio in Capacitor, Web Audio in browser) on new items.
 *
 * IMPORTANT: Sound plays from HERE (JS/WebView) when app is in foreground.
 * When app is in background, native FCM handles sound.
 */
export function useRealtimeNotifications() {
  const user = useAuthStore(s => s.user)
  const userId = user?.id
  const lastCheckedRef = useRef<string>(new Date().toISOString())
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())

  const checkForNewNotifications = useCallback(async () => {
    if (!userId) return

    try {
      const res = await fetch(`/api/notifications?userId=${userId}&after=${encodeURIComponent(lastCheckedRef.current)}&_t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()

      if (!data.success || !data.notifications?.length) return

      const newOnes: NotificationItem[] = []

      for (const notif of data.notifications) {
        if (!knownIdsRef.current.has(notif.id)) {
          knownIdsRef.current.add(notif.id)
          newOnes.push(notif)
        }
      }

      if (newOnes.length === 0) return

      // Get the latest notification
      const latest = newOnes[0]

      // Always play sound and show notification for ALL platforms (native + web)
      // FCM may not be working or tokens may not exist, so we need this as fallback
      try {
        await initAudioOnInteraction()
      } catch {}

      try {
        if (latest.type === 'success') {
          await playSuccessSound(latest.type)
        } else if (latest.type === 'warning' || latest.type === 'error') {
          await playAlertSound(latest.type)
        } else {
          await playNotificationSound(latest.type)
        }
      } catch {
        // Sound failed silently
      }

      await showBrowserNotification(latest.title, latest.message)

      // Update last checked timestamp
      lastCheckedRef.current = newOnes[0].createdAt

      // Dispatch global event so other components (like AdminPanel) refresh immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-data-changed', { detail: { type: latest.type, notification: latest } }))
      }
    } catch {
      // Silently fail — will retry on next poll
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      knownIdsRef.current.clear()
      lastCheckedRef.current = new Date().toISOString()
      return
    }

    // Initialize audio context on first interaction
    initAudioOnInteraction()

    // Initial fetch to populate known IDs (don't play sound for existing)
    const initialize = async () => {
      try {
        const res = await fetch(`/api/notifications?userId=${userId}&_t=${Date.now()}`, { cache: 'no-store' })
        const data = await res.json()
        if (data.success && data.notifications) {
          for (const notif of data.notifications) {
            knownIdsRef.current.add(notif.id)
          }
          if (data.notifications.length > 0) {
            lastCheckedRef.current = data.notifications[0].createdAt
          }
        }
      } catch {
        // Silent
      }

      // Start polling every 5 seconds
      pollingRef.current = setInterval(checkForNewNotifications, 5000)
    }

    initialize()

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [userId, checkForNewNotifications])
}

/**
 * Hook to get unread notification count.
 * Polls every 8 seconds.
 */
export function useUnreadCount() {
  const user = useAuthStore(s => s.user)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user?.id) { setCount(0); return }

    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/notifications?userId=${user.id}&countOnly=true&_t=${Date.now()}`, { cache: 'no-store' })
        const data = await res.json()
        if (data.success) setCount(data.unreadCount || 0)
      } catch {
        // Silent
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 8000)
    return () => clearInterval(interval)
  }, [user?.id])

  return count
}
