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
 * - Polls every 10 seconds when authenticated
 * - Compares fields before updating to avoid unnecessary re-renders
 * - Dispatches 'app-data-changed' event for cross-component reactions
 * - Pauses when tab is not visible (Page Visibility API)
 */
export function useRealtimeSync() {
  const user = useAuthStore(s => s.user)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visibilityRef = useRef(true)
  const lastDataRef = useRef<string>('')

  const syncUserData = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return
    // Skip if tab is not visible
    if (!visibilityRef.current) return

    try {
      const token = useAuthStore.getState().token
      if (!token) return

      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await res.json()

      if (!data.success || !data.user) return

      // Create a hash of the server data to detect actual changes
      const serverHash = JSON.stringify({
        kycStatus: data.user.kycStatus,
        balance: data.user.balance,
        frozenBalance: data.user.frozenBalance,
        status: data.user.status,
        phoneVerified: data.user.phoneVerified,
        mustChangePassword: data.user.mustChangePassword,
        twoFactorEnabled: data.user.twoFactorEnabled,
        role: data.user.role,
        permissions: data.user.permissions,
        merchantId: data.user.merchantId,
        accountNumber: data.user.accountNumber,
      })

      // Skip if data hasn't changed
      if (serverHash === lastDataRef.current) return

      // Detect what changed for event dispatch
      const currentUser = useAuthStore.getState().user
      const changes: string[] = []

      if (currentUser?.kycStatus !== data.user.kycStatus) {
        changes.push('kycStatus')
      }
      if (currentUser?.balance !== data.user.balance) {
        changes.push('balance')
      }
      if (currentUser?.frozenBalance !== data.user.frozenBalance) {
        changes.push('frozenBalance')
      }
      if (currentUser?.status !== data.user.status) {
        changes.push('status')
      }
      if (currentUser?.phoneVerified !== data.user.phoneVerified) {
        changes.push('phoneVerified')
      }
      if (currentUser?.role !== data.user.role) {
        changes.push('role')
      }
      if (currentUser?.permissions !== data.user.permissions) {
        changes.push('permissions')
      }
      if (currentUser?.accountNumber !== data.user.accountNumber) {
        changes.push('accountNumber')
      }

      if (changes.length === 0) return

      // Update the store with fresh data
      useAuthStore.getState().updateUser(data.user as any)
      lastDataRef.current = serverHash

      // Dispatch global event so other components react immediately
      if (typeof window !== 'undefined' && changes.length > 0) {
        window.dispatchEvent(
          new CustomEvent('app-data-changed', {
            detail: { source: 'realtime-sync', changes },
          })
        )
      }
    } catch {
      // Silent — will retry on next poll
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      lastDataRef.current = ''
      return
    }

    // Initial sync
    syncUserData()

    // Poll every 10 seconds
    pollingRef.current = setInterval(syncUserData, 10000)

    return () => {
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
        // Tab became visible — sync immediately
        syncUserData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [syncUserData])
}
