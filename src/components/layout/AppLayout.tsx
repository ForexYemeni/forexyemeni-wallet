'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { useRealtimeNotifications, useUnreadCount } from '@/hooks/useRealtimeNotifications'
import { setupFCMAutoRegister } from '@/lib/fcm-push'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import SocialFloatingButton from './SocialFloatingButton'
import { Bell, LogOut, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, setScreen, logout } = useAuthStore()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const mainRef = useRef<HTMLDivElement | null>(null)

  const isAdmin = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))

  // Real-time notification listener (sound + browser notifications)
  useRealtimeNotifications()
  // Dynamic unread count for badge
  const unreadCount = useUnreadCount()

  // FCM Push Notifications (Android APK only)
  useEffect(() => {
    setupFCMAutoRegister()
  }, [])

  // Session timeout check (7 days)
  useEffect(() => {
    if (!user?.id) return
    const SESSION_KEY = 'forexyameni-session-start'
    const start = localStorage.getItem(SESSION_KEY)
    if (!start) {
      localStorage.setItem(SESSION_KEY, Date.now().toString())
      return
    }
    const daysSinceLogin = (Date.now() - parseInt(start)) / (1000 * 60 * 60 * 24)
    if (daysSinceLogin > 7) {
      localStorage.removeItem(SESSION_KEY)
      logout()
      return
    }
  }, [user?.id])

  // Deep link: navigate to relevant screen when notification is tapped
  useEffect(() => {
    const screenMap: Record<string, string> = {
      success: 'dashboard',
      warning: 'dashboard',
      error: 'dashboard',
      info: 'notifications',
      chat: 'chat',
      deposit: 'deposit',
      withdrawal: 'withdraw',
      transfer: 'dashboard',
      kyc: 'kyc',
    }

    const handleNotificationTap = (e: Event | null) => {
      const detail = e ? (e as CustomEvent).detail : null
      const data = detail?.data || (window as any).__pendingNotification?.data || {}
      const type = detail?.type || (window as any).__pendingNotification?.type || ''

      if (type) {
        const target = screenMap[type] || 'notifications'
        setScreen(target)
        ;(window as any).__pendingNotification = null
      }
    }

    // Check if there's a pending notification (from cold start)
    if ((window as any).__pendingNotification) {
      handleNotificationTap(null)
    }

    // Listen for notification taps (warm start)
    window.addEventListener('notificationTap', handleNotificationTap)
    return () => window.removeEventListener('notificationTap', handleNotificationTap)
  }, [])

  const handleLogout = () => {
    setLogoutDialogOpen(false)
    logout()
  }

  // Pull-to-refresh handlers (uses window scroll since <main> is not the scroll container)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only trigger at very top of page
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === 0 || refreshing) return
    // Stop if user scrolled down
    if (window.scrollY > 0) {
      startY.current = 0
      setPullDistance(0)
      return
    }
    const diff = e.touches[0].clientY - startY.current
    if (diff > 0 && diff < 150) {
      setPullDistance(Math.min(diff * 0.5, 80))
      // Prevent native scroll while pulling
      e.preventDefault()
    }
  }, [refreshing])

  const onTouchEnd = useCallback(async () => {
    if (pullDistance > 50 && !refreshing) {
      setRefreshing(true)
      setPullDistance(80)
      try {
        window.location.reload()
      } catch {
        setRefreshing(false)
      }
    } else {
      setPullDistance(0)
    }
    startY.current = 0
  }, [pullDistance, refreshing])

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main
        ref={mainRef}
        className="md:mr-64 min-h-screen pb-24 md:pb-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-background/90 backdrop-blur-sm transition-all duration-200"
            style={{ height: Math.max(pullDistance, refreshing ? 48 : 0), opacity: Math.min(pullDistance / 40, 1) || (refreshing ? 1 : 0) }}
          >
            <Loader2 className="w-5 h-5 text-gold animate-spin" />
            <span className="text-sm text-muted-foreground">جاري التحديث...</span>
          </div>
        )}
        {/* Top Bar */}
        <header className="sticky top-0 z-40 px-4 md:px-6 py-3 glass-card rounded-none border-x-0 border-t-0">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div>
              <h2 className="text-sm font-bold gold-text">فوركس يمني</h2>
              <p className="text-[10px] text-muted-foreground">مرحباً، {user?.fullName || 'مستخدم'}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setScreen('notifications')}
                className="relative w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -left-1 min-w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Quick Logout Button in Header */}
              <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
                <AlertDialogTrigger asChild>
                  <button
                    className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-red-500/20 transition-colors group"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card bg-background/95 backdrop-blur-xl border-red-500/20 text-right" dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
                      <LogOut className="w-5 h-5" />
                      تسجيل الخروج
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
                      هل أنت متأكد من رغبتك في تسجيل الخروج؟
                      <br />
                      ستحتاج إلى إدخال البريد الإلكتروني وكلمة المرور مرة أخرى للوصول إلى حسابك.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex gap-3 sm:gap-0">
                    <AlertDialogAction
                      onClick={handleLogout}
                      className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all"
                    >
                      نعم، خروج
                    </AlertDialogAction>
                    <AlertDialogCancel
                      className="flex-1 h-11 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all"
                    >
                      إلغاء
                    </AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center text-gray-900 font-bold text-sm">
                {(user?.fullName || user?.email || 'م').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto overflow-x-hidden">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* Social Floating Button */}
      <SocialFloatingButton />
    </div>
  )
}
