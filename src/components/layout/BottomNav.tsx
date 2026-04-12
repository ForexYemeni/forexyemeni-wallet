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
  Bell,
  Gift,
  MessageCircle,
  ChevronUp,
  X,
  Clock,
  Repeat,
  Send,
  HelpCircle,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

const userNavItems = [
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'deposit', label: 'إيداع', icon: ArrowDownLeft },
  { key: 'withdraw', label: 'سحب', icon: ArrowUpRight },
  { key: 'settings', label: 'المزيد', icon: Settings },
]

const merchantNavItems = [
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'deposit', label: 'إيداع', icon: ArrowDownLeft },
  { key: 'p2p', label: 'P2P', icon: Repeat },
  { key: 'settings', label: 'المزيد', icon: Settings },
]

const userExtraItems = [
  { key: 'transfer', label: 'تحويل', icon: Send },
  { key: 'p2p', label: 'سوق P2P', icon: Repeat },
  { key: 'referral', label: 'برنامج الدعوات', icon: Gift },
  { key: 'help', label: 'مركز المساعدة', icon: HelpCircle },
  { key: 'chat', label: 'الدعم الفني', icon: MessageCircle },
  { key: 'kyc', label: 'التحقق (KYC)', icon: Shield },
  { key: 'transactions', label: 'المعاملات', icon: Clock },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

const merchantExtraItems = [
  { key: 'withdraw', label: 'سحب', icon: ArrowUpRight },
  { key: 'transfer', label: 'تحويل', icon: Send },
  { key: 'p2p', label: 'سوق P2P', icon: Repeat },
  { key: 'transactions', label: 'المعاملات', icon: Clock },
  { key: 'kyc', label: 'التحقق (KYC)', icon: Shield },
  { key: 'chat', label: 'الدعم الفني', icon: MessageCircle },
  { key: 'help', label: 'مركز المساعدة', icon: HelpCircle },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

const adminNavItems = [
  { key: 'admin', label: 'الإدارة', icon: LayoutDashboard },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

export default function BottomNav() {
  const { currentScreen, setScreen, user } = useAuthStore()
  const [theme, setThemeState] = useState<Theme>(() => getTheme())
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const navBarRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const isAdmin = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))
  const isMerchant = !!user?.merchantId && !isAdmin
  const items = isAdmin ? adminNavItems : isMerchant ? merchantNavItems : userNavItems
  const extraItems = isMerchant ? merchantExtraItems : userExtraItems

  // Calculate active indicator position for bottom nav
  const updateIndicator = useCallback(() => {
    if (!navBarRef.current) return
    const buttons = navBarRef.current.querySelectorAll<HTMLButtonElement>('[data-bnav-key]')
    const activeKey = isAdmin ? currentScreen
      : (!isMerchant && showMore) ? 'more'
      : currentScreen

    let targetBtn: HTMLButtonElement | null = null
    for (const btn of buttons) {
      const key = btn.dataset.bnavKey
      if (key === activeKey) { targetBtn = btn; break }
      if (key === 'more' && !isMerchant && !isAdmin && userExtraItems.some(e => e.key === currentScreen)) {
        targetBtn = btn; break
      }
      if (key === currentScreen) { targetBtn = btn; break }
    }

    if (targetBtn) {
      const parent = navBarRef.current
      const parentRect = parent.getBoundingClientRect()
      const btnRect = targetBtn.getBoundingClientRect()
      setIndicator({
        left: btnRect.left - parentRect.left,
        width: btnRect.width,
      })
    }
  }, [currentScreen, showMore, isAdmin, isMerchant])

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(updateIndicator, 50)
    return () => clearTimeout(timer)
  }, [updateIndicator])

  // Close more menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false)
      }
    }
    if (showMore) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMore])

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    setTheme(next)
  }

  const handleScreenClick = (key: string) => {
    setScreen(key === 'p2p-trades' ? 'p2p' : key)
    setShowMore(false)
  }

  // Determine which key is active for indicator
  const getActiveIndicatorKey = () => {
    if (!isAdmin && !isMerchant && userExtraItems.some(e => e.key === currentScreen)) return 'more'
    return currentScreen
  }

  const activeKey = getActiveIndicatorKey()
  const hasActive = items.some(i => i.key === activeKey) ||
    (!isAdmin && !isMerchant && activeKey === 'more')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-3 mb-3">
        <div
          ref={navBarRef}
          className="glass-bottom-nav relative"
        >
          {/* Animated indicator */}
          {hasActive && (
            <div
              className="bottom-nav-indicator"
              style={{
                left: indicator.left,
                width: indicator.width,
              }}
            />
          )}

          <div className="flex items-center justify-around relative z-10">
            {items.map((item) => {
              const isActive = currentScreen === item.key
              // For non-admin/non-merchant users, "settings" is the "more" button
              if (!isAdmin && !isMerchant && item.key === 'settings') {
                const isInExtra = userExtraItems.some(e => e.key === currentScreen)
                const isMoreActive = isInExtra || showMore
                return (
                  <button
                    key="more-btn"
                    data-bnav-key="more"
                    onClick={() => setShowMore(!showMore)}
                    className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all duration-200 tap-effect ${
                      isMoreActive
                        ? 'text-gold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {showMore ? (
                      <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
                        <X className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                        <Settings className="w-5 h-5" />
                      </div>
                    )}
                    <span className="text-[10px] font-medium">{showMore ? 'إغلاق' : 'المزيد'}</span>
                  </button>
                )
              }

              return (
                <button
                  key={item.key}
                  data-bnav-key={item.key}
                  onClick={() => handleScreenClick(item.key)}
                  className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all duration-200 tap-effect ${
                    isActive
                      ? 'text-gold bottom-nav-item-active'
                      : 'text-muted-foreground'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive ? 'bg-gold/10' : ''
                  }`}>
                    <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              )
            })}

            {/* Theme Toggle */}
            <button
              onClick={handleToggleTheme}
              className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all duration-200 text-muted-foreground tap-effect"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'
              }`}>
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </div>
              <span className="text-[10px] font-medium">{theme === 'dark' ? 'مضيء' : 'مظلم'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Extra Items Popup Menu */}
      {showMore && !isAdmin && (
        <div
          ref={moreRef}
          className="fixed bottom-20 left-3 right-3 z-50 glass-more-menu rounded-2xl p-2 animate-scale-in overflow-hidden"
          dir="rtl"
        >
          {/* Header with gradient line */}
          <div className="relative">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-l from-gold via-gold-light to-emerald-400" />
            <div className="flex items-center gap-2 px-3 py-2.5 mb-1">
              <ChevronUp className="w-4 h-4 text-gold" />
              <span className="text-xs font-bold gold-text">{isMerchant ? 'قائمة التاجر' : 'القائمة الكاملة'}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            {extraItems.map((item, index) => {
              const isActive = currentScreen === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => handleScreenClick(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    isActive
                      ? 'sidebar-item-active text-gold font-medium'
                      : 'text-muted-foreground hover:text-foreground sidebar-item-hover'
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-gold/10' : 'bg-white/5'
                  }`}>
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-gold' : ''}`} />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
