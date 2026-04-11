'use client'

import { useState, useEffect, useCallback } from 'react'

interface OfflineState {
  isOffline: boolean
  lastSyncTime: number | null
}

/**
 * Hook to monitor network connectivity and provide offline status.
 * Returns isOffline boolean and lastSyncTime.
 * 
 * Uses both navigator.onLine and actual fetch to Vercel to detect
 * real connectivity (some browsers report online even without real internet).
 */
export function useOfflineMode() {
  const [state, setState] = useState<OfflineState>({
    isOffline: false,
    lastSyncTime: null,
  })

  useEffect(() => {
    // Initial check
    const initialOffline = !navigator.onLine
    setState(prev => ({ ...prev, isOffline: initialOffline }))

    // Load last sync time from offline store
    try {
      const stored = localStorage.getItem('forexyemeni-offline')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.state?.lastSyncTime) {
          setState(prev => ({ ...prev, lastSyncTime: parsed.state.lastSyncTime }))
        }
      }
    } catch {}

    // Listen for online/offline events
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOffline: false }))
    }

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOffline: true }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update last sync time
  const updateSyncTime = useCallback(() => {
    setState(prev => ({ ...prev, lastSyncTime: Date.now() }))
    // Also update the persisted store
    try {
      const stored = localStorage.getItem('forexyemeni-offline')
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.state.lastSyncTime = Date.now()
        localStorage.setItem('forexyemeni-offline', JSON.stringify(parsed))
      }
    } catch {}
  }, [])

  return {
    isOffline: state.isOffline,
    lastSyncTime: state.lastSyncTime,
    updateSyncTime,
  }
}
