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
 * 
 * OPTIMIZED v3.7.0:
 * - Combined notification fetch + unread count into ONE poll (was 2 separate polls)
 * - Increased poll interval from 5s/8s to 30s (85% less API calls)
 * - Returns unread count directly (no separate useUnreadCount hook needed)
 * - Skips sound/notification on native platform (FCM handles it)
 *
 * Firebase reads saved:
 *   Before: 720 polls/hr × (50 + 100 docs) = ~108,000 reads/hr per user
 *   After:  120 polls/hr × ~5 docs = ~600 reads/hr per user
 *   Savings: ~99.4%
 */
export function useRealtimeNotifications() {
  const user = useAuthStore(s => s.user)
  const userId = user?.id
  const lastCheckedRef = useRef<string>(new Date().toISOString())
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const [unreadCount, setUnreadCount] = useState(0)

  // Expose unread count for badge
  const getUnreadCount = useCallback(() => unreadCount, [unreadCount])

  const checkForNewNotifications = useCallback(async () => {
    if (!userId) return

    try {
      // Single API call gets both new notifications AND unread count
      const res = await fetch(
        `/api/notifications?userId=${userId}&after=${encodeURIComponent(lastCheckedRef.current)}&includeUnread=true&_t=${Date.now()}`,
        { cache: 'no-store' }
      )
      const data = await res.json()

      if (!data.success) return

      // Update unread count from the same response
      if (data.unreadCount !== undefined) {
        setUnreadCount(data.unreadCount)
      }

      if (!data.notifications?.length) return

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

      // In native app (APK), FCM handles sound + notification display.
      // Skip sound/banner here to avoid DUPLICATE notifications.
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()

      if (!isNative) {
        // Web only: play sound and show browser notification
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
      }

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
      setUnreadCount(0)
      return
    }

    // Initialize audio context on first interaction
    initAudioOnInteraction()

    // Initial fetch to populate known IDs (don't play sound for existing)
    const initialize = async () => {
      try {
        const res = await fetch(`/api/notifications?userId=${userId}&includeUnread=true&_t=${Date.now()}`, { cache: 'no-store' })
        const data = await res.json()
        if (data.success) {
          if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount)
          if (data.notifications) {
            for (const notif of data.notifications) {
              knownIdsRef.current.add(notif.id)
            }
            if (data.notifications.length > 0) {
              lastCheckedRef.current = data.notifications[0].createdAt
            }
          }
        }
      } catch {
        // Silent
      }

      // Poll every 30 seconds (was 5s — 6x less frequent)
      pollingRef.current = setInterval(checkForNewNotifications, 30000)
    }

    initialize()

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [userId, checkForNewNotifications])

  return { unreadCount }
}

/**
 * @deprecated Use useRealtimeNotifications().unreadCount instead.
 * This hook now delegates to the combined hook to avoid duplicate polling.
 */
export function useUnreadCount() {
  const { unreadCount } = useRealtimeNotifications()
  return unreadCount
}
