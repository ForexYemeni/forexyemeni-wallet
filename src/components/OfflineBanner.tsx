'use client'

import { useEffect, useState } from 'react'
import { useOfflineMode } from '@/hooks/useOfflineMode'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

export default function OfflineBanner() {
  const { isOffline, lastSyncTime, updateSyncTime } = useOfflineMode()
  const [showBackOnline, setShowBackOnline] = useState(false)
  const [timeAgo, setTimeAgo] = useState('')

  // Show "back online" toast for 3 seconds
  useEffect(() => {
    if (!isOffline && showBackOnline) {
      const timer = setTimeout(() => setShowBackOnline(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOffline, showBackOnline])

  // Track offline→online transition
  useEffect(() => {
    if (!isOffline) {
      setShowBackOnline(true)
      // Update sync time when coming back online
      updateSyncTime()
    }
  }, [isOffline, updateSyncTime])

  // Calculate time ago for last sync
  useEffect(() => {
    if (!lastSyncTime || !isOffline) return

    const calculate = () => {
      const diff = Date.now() - lastSyncTime
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)

      if (minutes < 1) setTimeAgo('الآن')
      else if (minutes < 60) setTimeAgo(`منذ ${minutes} دقيقة`)
      else if (hours < 24) setTimeAgo(`منذ ${hours} ساعة`)
      else setTimeAgo(`منذ ${Math.floor(hours / 24)} يوم`)
    }

    calculate()
    const interval = setInterval(calculate, 30000) // Update every 30s
    return () => clearInterval(interval)
  }, [lastSyncTime, isOffline])

  if (!isOffline && !showBackOnline) return null

  return (
    <>
      {/* Offline Banner */}
      {isOffline && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2"
          style={{ animation: 'offlineSlideDown 0.3s ease-out' }}
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>لا يوجد اتصال بالإنترنت — يتم عرض البيانات المخزنة مؤقتاً</span>
          {lastSyncTime && timeAgo && (
            <span className="opacity-80 mr-2">(آخر تحديث: {timeAgo})</span>
          )}
        </div>
      )}

      {/* Back Online Toast */}
      {showBackOnline && !isOffline && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg shadow-green-600/20"
          style={{ animation: 'offlineSlideDown 0.3s ease-out' }}
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>تم استعادة الاتصال</span>
          <RefreshCw className="w-3 h-3 animate-spin" />
        </div>
      )}

      <style jsx global>{`
        @keyframes offlineSlideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
