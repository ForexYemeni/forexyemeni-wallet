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
  Users,
  UserCog,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  FileCheck,
  CreditCard,
  Sliders,
  BarChart3,
  MessageSquare,
  Activity,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

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

// Extra items shown in the "More" popup menu
const userExtraItems = [
  { key: 'p2p', label: 'سوق P2P', icon: Repeat },
  { key: 'referral', label: 'برنامج الدعوات', icon: Gift },
  { key: 'chat', label: 'الدعم الفني', icon: MessageCircle },
  { key: 'kyc', label: 'التحقق (KYC)', icon: Shield },
  { key: 'transactions', label: 'المعاملات', icon: Clock },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

const merchantExtraItems = [
  { key: 'withdraw', label: 'سحب', icon: ArrowUpRight },
  { key: 'p2p', label: 'سوق P2P', icon: Repeat },
  { key: 'transactions', label: 'المعاملات', icon: Clock },
  { key: 'kyc', label: 'التحقق (KYC)', icon: Shield },
  { key: 'chat', label: 'الدعم الفني', icon: MessageCircle },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

const adminNavItems = [
  { key: 'admin', label: 'الإدارة', icon: LayoutDashboard },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
]

const adminSubItems = [
  { key: 'admin-dashboard', label: 'الإحصائيات', icon: BarChart3, tab: 'dashboard' },
  { key: 'admin-users', label: 'المستخدمون', icon: Users, tab: 'users' },
  { key: 'admin-deposits', label: 'الإيداعات', icon: ArrowDownCircle, tab: 'deposits' },
  { key: 'admin-withdrawals', label: 'السحوبات', icon: ArrowUpCircle, tab: 'withdrawals' },
  { key: 'admin-kyc', label: 'التوثيق', icon: FileCheck, tab: 'kyc' },
  { key: 'admin-chats', label: 'المحادثات', icon: MessageCircle, tab: 'chats' },
  { key: 'admin-methods', label: 'طرق الدفع', icon: CreditCard, tab: 'payment-methods' },
  { key: 'admin-referral', label: 'برنامج الدعوات', icon: Gift, tab: 'referral-settings' },
  { key: 'admin-faq', label: 'البوت والأسئلة', icon: MessageSquare, tab: 'faq-bot' },
  { key: 'admin-p2p', label: 'P2P والنزاعات', icon: Repeat, tab: 'p2p' },
  { key: 'admin-audit', label: 'سجل العمليات', icon: Clock, tab: 'audit-log' },
  { key: 'admin-reports', label: 'التقارير المالية', icon: BarChart3, tab: 'reports' },
  { key: 'admin-monitor', label: 'مراقبة النظام', icon: Activity, tab: 'system-monitor' },
  { key: 'admin-settings', label: 'إعدادات النظام', icon: Sliders, tab: 'admin-settings' },
  { key: 'admin-team', label: '👥 فريق الإدارة', icon: UserCog, tab: 'admin-team' },
  { key: 'admin-financial', label: '💰 الملخص المالي', icon: DollarSign, tab: 'admin-financial' },
  { key: 'admin-super', label: '🛡️ تحكم خارق', icon: Shield, tab: 'super-admin' },
]

export default function BottomNav() {
  const { currentScreen, setScreen, user, setPendingAdminTab } = useAuthStore()
  const [theme, setThemeState] = useState<Theme>('dark')
  const [showMore, setShowMore] = useState(false)
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const isAdmin = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))
  const isMerchant = !!user?.merchantId && !isAdmin
  const items = isAdmin ? adminNavItems : isMerchant ? merchantNavItems : userNavItems
  const extraItems = isMerchant ? merchantExtraItems : userExtraItems

  useEffect(() => {
    setThemeState(getTheme())
  }, [])

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false)
        setShowAdminMenu(false)
      }
    }
    if (showMore || showAdminMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMore, showAdminMenu])

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    setTheme(next)
  }

  const handleScreenClick = (key: string) => {
    setScreen(key === 'p2p-trades' ? 'p2p' : key)
    setShowMore(false)
  }

  const handleAdminSubClick = (tab: string) => {
    setPendingAdminTab(tab)
    setScreen('admin')
    setShowAdminMenu(false)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-3 mb-3 rounded-2xl glass-card border-gold/10 px-2 py-2">
        <div className="flex items-center justify-around">
          {items.map((item) => {
            const isActive = currentScreen === item.key
            // For non-admin/non-merchant users, "settings" is the "more" button
            if (!isAdmin && !isMerchant && item.key === 'settings') {
              const isInExtra = userExtraItems.some(e => e.key === currentScreen)
              return (
                <button
                  key="more-btn"
                  onClick={() => setShowMore(!showMore)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                    isInExtra
                      ? 'text-gold bg-gold/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showMore ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                  <span className="text-[10px] font-medium">{showMore ? 'إغلاق' : 'المزيد'}</span>
                </button>
              )
            }

            // For admin users, "admin" button opens sub-menu popup
            if (isAdmin && item.key === 'admin') {
              return (
                <button
                  key="admin-btn"
                  onClick={() => {
                    setScreen('admin')
                    setShowAdminMenu(!showAdminMenu)
                  }}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                    isActive || showAdminMenu
                      ? 'text-gold bg-gold/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="text-[10px] font-medium">الإدارة</span>
                </button>
              )
            }

            return (
              <button
                key={item.key}
                onClick={() => handleScreenClick(item.key)}
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

          {/* Theme Toggle */}
          <button
            onClick={handleToggleTheme}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="text-[10px] font-medium">{theme === 'dark' ? 'مضيء' : 'مظلم'}</span>
          </button>
        </div>
      </div>

      {/* Admin Sub-Menu Popup */}
      {showAdminMenu && isAdmin && (
        <div
          ref={moreRef}
          className="fixed bottom-20 left-3 right-3 z-50 glass-card border-gold/10 rounded-2xl p-2 animate-scale-in"
          dir="rtl"
        >
          <div className="flex items-center justify-between px-3 py-2 mb-1">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-gold" />
              <span className="text-xs font-medium gold-text">خدمات الإدارة</span>
            </div>
            <button onClick={() => setShowAdminMenu(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
            {adminSubItems.filter(sub => {
              if (sub.key === 'admin-super' || sub.key === 'admin-team' || sub.key === 'admin-financial') {
                return user?.role === 'admin' && !user?.permissions
              }
              return true
            }).map((sub) => (
              <button
                key={sub.key}
                onClick={() => handleAdminSubClick(sub.tab)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                <sub.icon className="w-4 h-4" />
                <span>{sub.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extra Items Popup Menu */}
      {showMore && !isAdmin && (
        <div
          ref={moreRef}
          className="fixed bottom-20 left-3 right-3 z-50 glass-card border-gold/10 rounded-2xl p-2 animate-scale-in"
          dir="rtl"
        >
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <ChevronUp className="w-4 h-4 text-gold" />
            <span className="text-xs font-medium gold-text">{isMerchant ? 'قائمة التاجر' : 'القائمة الكاملة'}</span>
          </div>
          <div className="space-y-0.5">
            {extraItems.map((item) => {
              const isActive = currentScreen === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => handleScreenClick(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-gold/10 text-gold font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
