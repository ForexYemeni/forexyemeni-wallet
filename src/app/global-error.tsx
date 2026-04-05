'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, Trash2, WifiOff } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isOffline, setIsOffline] = useState(false)
  const [isBackOnline, setIsBackOnline] = useState(false)

  useEffect(() => {
    console.error('[Global Error Boundary]', error)

    // Check if the error is network-related
    const isNetworkError =
      !navigator.onLine ||
      error?.message?.toLowerCase().includes('fetch') ||
      error?.message?.toLowerCase().includes('network') ||
      error?.message?.toLowerCase().includes('net::') ||
      error?.message?.toLowerCase().includes('failed to fetch') ||
      error?.message?.toLowerCase().includes('load failed')

    setIsOffline(isNetworkError)

    // Listen for online/offline events
    const goOnline = () => {
      setIsOffline(false)
      setIsBackOnline(true)
      // Auto-reload when back online
      setTimeout(() => window.location.reload(), 800)
    }
    const goOffline = () => setIsOffline(true)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [error])

  const clearAndReload = () => {
    try {
      localStorage.removeItem('forexyemeni-auth')
      if ('caches' in window) {
        caches.keys().then(names => {
          Promise.all(names.map(name => caches.delete(name)))
        })
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister())
        })
      }
    } catch {}
    window.location.href = '/'
  }

  // Offline-specific screen
  if (isOffline && !isBackOnline) {
    return (
      <html lang="ar" dir="rtl">
        <body className="bg-background text-foreground font-[family-name:var(--font-tajawal)] antialiased">
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="text-center space-y-6 max-w-sm w-full">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <WifiOff className="w-10 h-10 text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">لا يوجد اتصال بالإنترنت</h1>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                  يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.
                  <br />
                  سيتم إعادة التحميل تلقائياً عند توفر الاتصال.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  إعادة المحاولة
                </button>
              </div>
              {/* Pulsing dot to show it's checking */}
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-xs text-muted-foreground">جاري انتظار الاتصال...</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    )
  }

  // Back online - show success then reload
  if (isBackOnline) {
    return (
      <html lang="ar" dir="rtl">
        <body className="bg-background text-foreground font-[family-name:var(--font-tajawal)] antialiased">
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
                <WifiOff className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-green-400">تم الاتصال بالإنترنت ✓</h1>
              <p className="text-sm text-muted-foreground">جاري إعادة تحميل التطبيق...</p>
            </div>
          </div>
        </body>
      </html>
    )
  }

  // General error screen
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-background text-foreground font-[family-name:var(--font-tajawal)] antialiased">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-6 max-w-sm w-full">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-red-400">حدث خطأ في التطبيق</h1>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                حدث خطأ غير متوقع أثناء تحميل التطبيق.
                <br />
                جرب إعادة المحاولة أو مسح البيانات.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={reset}
                className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                إعادة المحاولة
              </button>
              <button
                onClick={clearAndReload}
                className="w-full h-12 bg-white/10 text-foreground font-medium rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                مسح البيانات والكاش وإعادة التحميل
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
