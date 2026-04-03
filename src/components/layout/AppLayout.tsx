'use client'

import { useAuthStore } from '@/lib/store'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import { Bell } from 'lucide-react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, setScreen, currentScreen } = useAuthStore()

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
                <span className="absolute -top-1 -left-1 w-4 h-4 bg-gold text-gray-900 text-[8px] font-bold rounded-full flex items-center justify-center">
                  !
                </span>
              </button>
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
