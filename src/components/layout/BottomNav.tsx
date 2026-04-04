'use client'

import { useAuthStore } from '@/lib/store'
import { getTheme, setTheme, type Theme } from '@/lib/theme'
import {
  Home,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Settings,
  LayoutDashboard,
  Sun,
  Moon,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const userNavItems = [
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'deposit', label: 'إيداع', icon: ArrowDownLeft },
  { key: 'withdraw', label: 'سحب', icon: ArrowUpRight },
  { key: 'kyc', label: 'التحقق', icon: Shield },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

const adminNavItems = [
  { key: 'admin', label: 'الإدارة', icon: LayoutDashboard },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

export default function BottomNav() {
  const { currentScreen, setScreen, user } = useAuthStore()
  const [theme, setThemeState] = useState<Theme>('dark')

  const isAdmin = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))

  const items = isAdmin ? adminNavItems : userNavItems

  useEffect(() => {
    setThemeState(getTheme())
  }, [])

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    setTheme(next)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-3 mb-3 rounded-2xl glass-card border-gold/10 px-2 py-2">
        <div className="flex items-center justify-around">
          {items.map((item) => {
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

          {/* Theme Toggle in Bottom Nav */}
          <button
            onClick={handleToggleTheme}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-muted-foreground hover:text-foreground`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="text-[10px] font-medium">{theme === 'dark' ? 'مضيء' : 'مظلم'}</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
