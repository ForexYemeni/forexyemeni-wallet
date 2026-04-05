'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error)
  }, [error])

  const clearAndReload = () => {
    try {
      // Clear all app state
      localStorage.removeItem('forexyemeni-auth')
      // Clear service worker caches
      if ('caches' in window) {
        caches.keys().then(names => {
          Promise.all(names.map(name => caches.delete(name)))
        })
      }
      // Unregister service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister())
        })
      }
    } catch {}
    window.location.href = '/'
  }

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
