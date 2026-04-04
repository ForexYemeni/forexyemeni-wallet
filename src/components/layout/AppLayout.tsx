'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { useRealtimeNotifications, useUnreadCount } from '@/hooks/useRealtimeNotifications'
import { setupFCMAutoRegister } from '@/lib/fcm-push'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import { Bell, LogOut } from 'lucide-react'
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

  const isAdmin = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))

  // Real-time notification listener (sound + browser notifications)
  useRealtimeNotifications()
  // Dynamic unread count for badge
  const unreadCount = useUnreadCount()

  // FCM Push Notifications (Android APK only)
  useEffect(() => {
    setupFCMAutoRegister()
  }, [])

  const handleLogout = () => {
    setLogoutDialogOpen(false)
    logout()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="md:mr-64 min-h-screen pb-24 md:pb-6">
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
        <div className="px-4 md:px-6 py-4 max-w-2xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  )
}
