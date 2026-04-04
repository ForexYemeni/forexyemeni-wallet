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
  Users,
  UserCog,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  FileCheck,
  MessageCircle,
  CreditCard,
  Sliders,
  Sun,
  Moon,
  BarChart3,
  MessageSquare,
  Gift,
  Repeat,
  Activity,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const userNavItems = [
  { key: 'dashboard', label: 'الرئيسية', icon: Home },
  { key: 'deposit', label: 'إيداع', icon: ArrowDownLeft },
  { key: 'withdraw', label: 'سحب', icon: ArrowUpRight },
  { key: 'p2p', label: 'P2P', icon: Repeat },
  { key: 'transactions', label: 'المعاملات', icon: Clock },
  { key: 'referral', label: 'الدعوات', icon: Gift },
  { key: 'kyc', label: 'التحقق (KYC)', icon: Shield },
  { key: 'chat', label: 'الدعم الفني', icon: MessageCircle },
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
  { key: 'admin', label: 'لوحة التحكم', icon: LayoutDashboard, section: 'إدارة' },
  { key: 'dashboard', label: 'الرئيسية', icon: Home, section: null },
  { key: 'notifications', label: 'الإشعارات', icon: Bell, section: null },
  { key: 'settings', label: 'الإعدادات', icon: Settings, section: null },
]

// Sub-nav items shown when admin is selected — for quick access
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

export default function Sidebar() {
  const { currentScreen, setScreen, user, logout, setPendingAdminTab } = useAuthStore()
  const [theme, setThemeState] = useState<Theme>('dark')
  const [adminExpanded, setAdminExpanded] = useState(false)

  const isAdmin = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))
  const isMerchant = !!user?.merchantId && !isAdmin

  const items = isAdmin ? adminNavItems : isMerchant ? merchantNavItems : userNavItems

  useEffect(() => {
    setThemeState(getTheme())
  }, [])

  useEffect(() => {
    if (currentScreen === 'admin' && !adminExpanded) {
      setAdminExpanded(true)
    }
  }, [currentScreen])

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    setTheme(next)
  }

  const handleAdminSubClick = (tab: string) => {
    setPendingAdminTab(tab)
    setScreen('admin')
  }

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed right-0 top-0 border-l border-gold/10 bg-sidebar z-50">
      {/* Logo */}
      <div className="p-6 border-b border-gold/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
            <Wallet className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <h1 className="font-bold gold-text text-lg">فوركس يمني</h1>
            <p className="text-[10px] text-muted-foreground">USDT TRC20 Wallet</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gold/10">
        <div className="glass-input p-3 rounded-xl">
          <p className="text-sm font-medium truncate">{user?.fullName || user?.email}</p>
          <p className="text-xs text-muted-foreground truncate" dir="ltr">{user?.email}</p>
          <div className="mt-2 flex items-center gap-1">
            {isAdmin ? (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-gold/20 text-gold">
                مدير النظام
              </span>
            ) : isMerchant ? (
              <>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/20 text-green-400">
                  تاجر موثق ✓
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground">
                  P2P
                </span>
              </>
            ) : (
              <>
                <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                  user?.kycStatus === 'approved' ? 'status-approved' : 'status-pending'
                }`}>
                  {user?.kycStatus === 'approved' ? 'متحقق' : 'غير متحقق'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gold/10 text-gold">
                  {(user?.balance ?? 0).toFixed(2)} USDT
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const isActive = currentScreen === item.key

          if (item.section) {
            return (
              <div key={item.section}>
                <button
                  onClick={() => {
                    setScreen(item.key!)
                    setAdminExpanded(true)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-gold/10 text-gold font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  <ChevronLeft className={`w-3 h-3 mr-auto transition-transform ${adminExpanded && isActive ? 'rotate-90' : ''}`} />
                </button>

                {/* Admin Sub-navigation */}
                {adminExpanded && isActive && (
                  <div className="mr-4 mt-1 space-y-0.5 animate-fade-in">
                    {adminSubItems.filter(sub => {
                      // Only show super-admin, admin-team, admin-financial to actual super admin (no permissions)
                      if (sub.key === 'admin-super' || sub.key === 'admin-team' || sub.key === 'admin-financial') {
                        return user?.role === 'admin' && !user?.permissions
                      }
                      return true
                    }).map((sub) => (
                      <button
                        key={sub.key}
                        onClick={() => handleAdminSubClick(sub.tab)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                      >
                        <sub.icon className="w-3.5 h-3.5" />
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <button
              key={item.key}
              onClick={() => setScreen(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-gold/10 text-gold font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {isActive && <ChevronLeft className="w-3 h-3 mr-auto" />}
            </button>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-gold/10 space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={handleToggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4" />
              الوضع المضيء
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" />
              الوضع المظلم
            </>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
