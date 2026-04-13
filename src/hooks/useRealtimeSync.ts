'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'

/**
 * Real-time user data sync hook.
 * 
 * Polls /api/user/profile periodically to detect server-side changes
 * (admin actions like KYC approval, balance updates, status changes)
 * and updates the zustand store immediately.
 * 
 * This ensures all operations reflect instantly without needing to
 * refresh the screen or exit the app.
 * 
 * - Fast polling: every 5 seconds when authenticated
 * - Immediate sync on app resume (Capacitor) and tab visibility change
 * - Listens to 'force-sync' events for instant sync after user actions
 * - Compares fields before updating to avoid unnecessary re-renders
 * - Dispatches 'app-data-changed' event for cross-component reactions
 * - Pauses when tab is not visible (Page Visibility API)
 */

// Track last sync time globally to prevent multiple hooks from syncing simultaneously
let globalLastSyncTime = 0
const SYNC_COOLDOWN = 3000 // Minimum 3s between syncs across all hooks
let globalSyncPromise: Promise<void> | null = null

// Fields to monitor for changes
const MONITORED_FIELDS = [
  'kycStatus', 'balance', 'frozenBalance', 'status',
  'phoneVerified', 'mustChangePassword', 'twoFactorEnabled',
  'role', 'permissions', 'merchantId', 'accountNumber',
] as const

export function useRealtimeSync() {
  const user = useAuthStore(s => s.user)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visibilityRef = useRef(true)
  const lastDataRef = useRef<string>('')
  const mountedRef = useRef(false)

  const syncUserData = useCallback(async (force = false) => {
    if (!isAuthenticated || !user?.id) return

    // Skip if tab is not visible (unless forced)
    if (!visibilityRef.current && !force) return

    // Global cooldown check — prevent multiple syncs within 3s
    const now = Date.now()
    if (!force && now - globalLastSyncTime < SYNC_COOLDOWN) return

    // Deduplicate concurrent syncs
    if (globalSyncPromise) return globalSyncPromise

    globalSyncPromise = (async () => {
      try {
        const token = useAuthStore.getState().token
        if (!token) return

        const res = await fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await res.json()

        if (!data.success || !data.user) return

        globalLastSyncTime = Date.now()

        // Create a hash of the server data to detect actual changes
        const serverHash = JSON.stringify(
          MONITORED_FIELDS.reduce((acc, field) => {
            acc[field] = data.user[field]
            return acc
          }, {} as Record<string, unknown>)
        )

        // Skip if data hasn't changed (unless forced — always update store)
        if (!force && serverHash === lastDataRef.current) return

        // Detect what changed for event dispatch
        const currentUser = useAuthStore.getState().user
        const changes: string[] = []

        for (const field of MONITORED_FIELDS) {
          if (currentUser && (currentUser as Record<string, unknown>)[field] !== data.user[field]) {
            changes.push(field)
          }
        }

        if (changes.length === 0 && !force) return

        // Update the store with fresh data
        useAuthStore.getState().updateUser(data.user as any)
        lastDataRef.current = serverHash

        // Dispatch global event so other components react immediately
        if (typeof window !== 'undefined' && changes.length > 0) {
          window.dispatchEvent(
            new CustomEvent('app-data-changed', {
              detail: { source: 'realtime-sync', changes, user: data.user },
            })
          )

          // Show toast for important changes (only when not on dashboard)
          const currentScreen = useAuthStore.getState().currentScreen
          if (currentScreen !== 'dashboard' && currentScreen !== 'transactions') {
            if (changes.includes('kycStatus')) {
              const newStatus = data.user.kycStatus
              if (newStatus === 'approved') {
                try {
                  const { toast } = await import('sonner')
                  toast.success('تم توثيق حسابك بنجاح! الآن يمكنك الإيداع والسحب')
                } catch {}
              } else if (newStatus === 'rejected') {
                try {
                  const { toast } = await import('sonner')
                  toast.error('تم رفض توثيق حسابك، يرجى إعادة المحاولة')
                } catch {}
              }
            }
            if (changes.includes('balance')) {
              // Balance changes are shown silently on dashboard
            }
            if (changes.includes('status')) {
              if (data.user.status === 'suspended') {
                try {
                  const { toast } = await import('sonner')
                  toast.error('تم تعليق حسابك، يرجى التواصل مع الدعم')
                } catch {}
                // Force logout
                setTimeout(() => useAuthStore.getState().logout(), 2000)
              }
            }
          }
        }
      } catch {
        // Silent — will retry on next poll
      } finally {
        globalSyncPromise = null
      }
    })()

    return globalSyncPromise
  }, [isAuthenticated, user?.id])

  // Main polling effect
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      lastDataRef.current = ''
      return
    }

    mountedRef.current = true

    // Initial sync immediately
    syncUserData(true)

    // Poll every 5 seconds (reduced from 10s for faster updates)
    pollingRef.current = setInterval(() => {
      syncUserData(false)
    }, 5000)

    return () => {
      mountedRef.current = false
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [isAuthenticated, user?.id, syncUserData])

  // Page Visibility API — pause polling when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      visibilityRef.current = !document.hidden
      if (document.hidden) {
        // Tab became hidden — no need to clear interval, syncUserData skips when not visible
      } else {
        // Tab became visible — sync immediately for instant updates
        syncUserData(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [syncUserData])

  // Listen for Capacitor app resume event (mobile app coming back from background)
  useEffect(() => {
    const handleAppResume = () => {
      visibilityRef.current = true
      // Force immediate sync when app resumes
      syncUserData(true)
    }

    // Listen for both Capacitor and web events
    document.addEventListener('resume', handleAppResume)
    if (typeof window !== 'undefined') {
      (window as any).__onAppResume = handleAppResume
    }

    return () => {
      document.removeEventListener('resume', handleAppResume)
      if (typeof window !== 'undefined') {
        delete (window as any).__onAppResume
      }
    }
  }, [syncUserData])

  // Listen for 'force-sync' events from other components/actions
  useEffect(() => {
    const handleForceSync = () => {
      syncUserData(true)
    }

    window.addEventListener('force-sync', handleForceSync)
    return () => window.removeEventListener('force-sync', handleForceSync)
  }, [syncUserData])
}

/**
 * Trigger an immediate data sync from anywhere in the app.
 * Use this after actions that might cause server-side changes
 * (e.g., after admin approval, after creating a transaction, etc.)
 */
export function triggerSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('force-sync'))
  }
}
