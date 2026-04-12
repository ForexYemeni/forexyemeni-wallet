'use client'

import { useAuthStore } from '@/lib/store'
import { getTheme, setTheme, type Theme } from '@/lib/theme'
import {
  Home,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Settings,
  Bell,
  LayoutDashboard,
  Wallet,
  Clock,
  ChevronLeft,
  ChevronRight,
  Gift,
  Repeat,
  MessageCircle,
  Sun,
  Moon,
  Send,
  HelpCircle,
  LogOut,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

const userNavItems = [
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'deposit', label: 'إيداع', icon: ArrowDownLeft },
  { key: 'withdraw', label: 'سحب', icon: ArrowUpRight },
  { key: 'transfer', label: 'تحويل', icon: Send },
  { key: 'p2p', label: 'P2P', icon: Repeat },
  { key: 'transactions', label: 'المعاملات', icon: Clock },
  { key: 'referral', label: 'الدعوات', icon: Gift },
  { key: 'kyc', label: 'التحقق (KYC)', icon: Shield },
  { key: 'chat', label: 'الدعم الفني', icon: MessageCircle },
  { key: 'help', label: 'المساعدة', icon: HelpCircle },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

const merchantNavItems = [
  { key: 'p2p', label: 'سوق P2P', icon: Repeat },
  { key: 'transactions', label: 'المعاملات', icon: Clock },
  { key: 'chat', label: 'الدعم الفني', icon: MessageCircle },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

const adminNavItems = [
  { key: 'admin', label: 'لوحة التحكم', icon: LayoutDashboard },
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

export default function Sidebar() {
  const { currentScreen, setScreen, user, logout } = useAuthStore()
  const [theme, setThemeState] = useState<Theme>(() => getTheme())
  const [collapsed, setCollapsed] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 40 })

  const isAdmin = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))
  const isMerchant = !!user?.merchantId && !isAdmin

  const items = isAdmin ? adminNavItems : isMerchant ? merchantNavItems : userNavItems

  // Update indicator position when active item changes
  useEffect(() => {
    if (!navRef.current) return
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      const activeIndex = items.findIndex(item => item.key === currentScreen)
      if (activeIndex >= 0 && navRef.current) {
        const buttons = navRef.current.querySelectorAll('button[data-nav-key]')
        const btn = buttons[activeIndex] as HTMLElement
        if (btn) {
          setIndicatorStyle({
            top: btn.offsetTop,
            height: btn.offsetHeight,
          })
        }
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [currentScreen, items, collapsed])

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    setTheme(next)
  }

  return (
    <aside className={`hidden md:flex flex-col h-screen fixed right-0 top-0 glass-sidebar z-50 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
      {/* Logo + Collapse Toggle */}
      <div className="p-4 border-b border-gold/8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shrink-0 shadow-lg shadow-gold/20">
            <Wallet className="w-5 h-5 text-gray-900" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="font-bold gold-text text-lg whitespace-nowrap tracking-tight">فوركس يمني</h1>
              <p className="text-[10px] text-muted-foreground">USDT TRC20 Wallet</p>
            </div>
          )}
        </div>
        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -translate-y-1/2 -left-3 w-6 h-6 rounded-full glass-card border border-gold/20 flex items-center justify-center text-muted-foreground hover:text-gold transition-colors tap-effect"
          title={collapsed ? 'توسيع' : 'تصغير'}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-b border-gold/8 animate-fade-in">
          <div className="sidebar-user-card glass-input p-3 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center text-gray-900 font-bold text-sm shrink-0">
                {(user?.fullName || user?.email || 'م').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user?.fullName || 'مستخدم'}</p>
                <p className="text-[10px] text-muted-foreground truncate" dir="ltr">{user?.email}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1">
              {isAdmin ? (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gold/15 text-gold font-medium">
                  مدير النظام
                </span>
              ) : isMerchant ? (
                <>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-medium">
                    تاجر موثق
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground">
                    P2P
                  </span>
                </>
              ) : (
                <>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                    user?.kycStatus === 'approved' ? 'status-approved' : 'status-pending'
                  }`}>
                    {user?.kycStatus === 'approved' ? 'متحقق' : 'غير متحقق'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-gold/8 text-gold font-medium">
                    {(user?.balance ?? 0).toFixed(2)} USDT
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav ref={navRef} className="flex-1 overflow-y-auto sidebar-scroll p-3 space-y-0.5 relative">
        {/* Animated indicator bar */}
        {!collapsed && items.some(item => item.key === currentScreen) && (
          <div
            className="sidebar-nav-indicator"
            style={{
              top: indicatorStyle.top + 2,
              height: Math.max(indicatorStyle.height - 4, 20),
              transition: 'top 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}

        {items.map((item) => {
          const isActive = currentScreen === item.key
          return (
            <button
              key={item.key}
              data-nav-key={item.key}
              onClick={() => setScreen(item.key)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 tap-effect ${
                isActive
                  ? `sidebar-item-active text-gold font-medium ${collapsed ? '' : 'pl-4'}`
                  : `sidebar-item-hover text-muted-foreground hover:text-foreground ${collapsed ? 'justify-center' : ''}`
              }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              {isActive && !collapsed && <ChevronLeft className="w-3 h-3 mr-auto text-gold/50" />}
            </button>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-gold/8 space-y-0.5">
        {/* Theme Toggle */}
        <button
          onClick={handleToggleTheme}
          title={collapsed ? (theme === 'dark' ? 'الوضع المضيء' : 'الوضع المظلم') : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground sidebar-item-hover transition-all duration-200 tap-effect ${collapsed ? 'justify-center' : ''}`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${
            theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'
          }`}>
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </div>
          {!collapsed && (
            <span>{theme === 'dark' ? 'الوضع المضيء' : 'الوضع المظلم'}</span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title={collapsed ? 'تسجيل الخروج' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/8 transition-all duration-200 tap-effect ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-red-500/8">
            <LogOut className="w-4 h-4" />
          </div>
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  )
}
