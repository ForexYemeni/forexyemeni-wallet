'use client'

import { useAuthStore } from '@/lib/store'
import {
  Home,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Settings,
  Bell,
  LayoutDashboard,
} from 'lucide-react'

const navItems = [
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'deposit', label: 'إيداع', icon: ArrowDownLeft },
  { key: 'withdraw', label: 'سحب', icon: ArrowUpRight },
  { key: 'kyc', label: 'التحقق', icon: Shield },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

export default function BottomNav() {
  const { currentScreen, setScreen, user } = useAuthStore()

  const isAdmin = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))

  const items = isAdmin
    ? [{ key: 'admin', label: 'الإدارة', icon: LayoutDashboard }, ...navItems]
    : navItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-3 mb-3 rounded-2xl glass-card border-gold/10 px-2 py-2">
        <div className="flex items-center justify-around">
          {items.slice(0, 5).map((item) => {
            const isActive = currentScreen === item.key
            return (
              <button
                key={item.key}
                onClick={() => setScreen(item.key)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  isActive
                    ? 'text-gold bg-gold/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
