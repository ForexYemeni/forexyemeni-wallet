'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { playNotificationSound, playSuccessSound, showBrowserNotification, vibrate } from '@/lib/notification-sound'

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
 * Uses smart polling (5 seconds) to detect new notifications.
 * Plays sound + shows browser notification + vibrates on new items.
 * 
 * Designed to work in: Browser, PWA, and Capacitor (Android APK).
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
      const res = await fetch(`/api/notifications?userId=${userId}&after=${encodeURIComponent(lastCheckedRef.current)}`)
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

      // Get the latest notification to show
      const latest = newOnes[0]

      // Play sound based on type
      if (latest.type === 'success') {
        playSuccessSound()
      } else if (latest.type === 'warning' || latest.type === 'error') {
        playNotificationSound()
      } else {
        playNotificationSound()
      }

      // Vibrate for mobile
      vibrate([200, 100, 200])

      // Show browser notification
      await showBrowserNotification(latest.title, latest.message)

      // Update last checked timestamp
      lastCheckedRef.current = newOnes[0].createdAt
    } catch {
      // Silently fail — will retry on next poll
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      // Cleanup when logged out
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      knownIdsRef.current.clear()
      lastCheckedRef.current = new Date().toISOString()
      return
    }

    // Request notification permission on first load (after user interaction)
    const requestPermission = () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
      document.removeEventListener('click', requestPermission)
    }
    document.addEventListener('click', requestPermission, { once: true })

    // Initial fetch to populate known IDs (don't play sound for existing)
    const initialize = async () => {
      try {
        const res = await fetch(`/api/notifications?userId=${userId}`)
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

      // Start polling after initial load
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
 * Polls every 8 seconds (slightly less frequent than real-time listener).
 */
export function useUnreadCount() {
  const user = useAuthStore(s => s.user)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user?.id) { setCount(0); return }

    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/notifications?userId=${user.id}&countOnly=true`)
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
