'use client'

import { apiFetch } from '@/lib/api-client'
import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/store'
import { useOfflineStore } from '@/lib/offline-store'
import { useOfflineMode } from '@/hooks/useOfflineMode'
import { convertUSDTtoYER, convertUSDTtoSAR, useExchangeRates } from '@/lib/currency'
import { toast } from 'sonner'
import BannerSlider from '@/components/BannerSlider'
import AnnouncementBanner from '@/components/layout/AnnouncementBanner'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import WalletCard3D, { WalletChip, MiniSparkline } from '@/components/ui/WalletCard3D'
import BalanceChart, { KYCProgressRing } from '@/components/dashboard/BalanceChart'
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  DollarSign,
  Clock,
  ChevronLeft,
  Copy,
  Check as CheckIcon,
  WifiOff,
  ArrowRightLeft,
  Wallet,
  Landmark,
  Coins,
  Users,
  Shield,
  Star,
  Zap,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const PromoRedeem = dynamic(() => import('@/components/promo/PromoRedeem'), { ssr: false })

interface Transaction {
  id: string
  type: string
  amount: number
  description: string | null
  createdAt: string
}

export default function Dashboard() {
  const { user, setScreen } = useAuthStore()
  const { cachedTransactions, setCachedTransactions, setCachedUser, setLastSyncTime } = useOfflineStore()
  const { isOffline } = useOfflineMode()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedAccount, setCopiedAccount] = useState(false)
  const [usingOffline, setUsingOffline] = useState(false)
  const rates = useExchangeRates()

  // Mock sparkline data based on balance
  const sparklineData = useMemo(() => {
    const balance = user?.balance ?? 0
    if (balance <= 0) return [0, 5, 3, 8, 6, 10, 7, 12]
    const base = balance * 0.85
    return Array.from({ length: 10 }, (_, i) =>
      base + (balance - base) * (i / 9) + (Math.random() - 0.4) * balance * 0.1
    )
  }, [user?.balance])

  // Balance
  const balance = user?.balance ?? 0
  const balanceInYER = convertUSDTtoYER(balance, rates.usdToYer)
  const balanceInSAR = convertUSDTtoSAR(balance, rates.usdToSar)

  // KYC progress
  const kycSteps = useMemo(() => {
    const status = user?.kycStatus
    if (status === 'approved') return { completed: 3, steps: 3 }
    if (status === 'pending') return { completed: 2, steps: 3 }
    if (status === 'submitted') return { completed: 2, steps: 3 }
    if (status === 'rejected') return { completed: 1, steps: 3 }
    return { completed: user?.phoneVerified ? 1 : 0, steps: 3 }
  }, [user?.kycStatus, user?.phoneVerified])

  // Combined data fetch
  useEffect(() => {
    if (user?.id) fetchDashboardData()
  }, [user?.id])

  useEffect(() => {
    if (user?.id && user?.currentScreen === 'dashboard') fetchDashboardData()
  }, [user?.currentScreen])

  useEffect(() => {
    if (isOffline && cachedTransactions.length > 0) {
      setTransactions(cachedTransactions.slice(0, 5))
      setUsingOffline(true)
      setLoading(false)
    }
  }, [isOffline, cachedTransactions])

  const fetchDashboardData = async () => {
    if (!user?.id) return
    if (!navigator.onLine) {
      if (cachedTransactions.length > 0) {
        setTransactions(cachedTransactions.slice(0, 5))
        setUsingOffline(true)
      }
      setLoading(false)
      return
    }

    // Show progress bar
    try { (window as any).__topProgressBar?.start() } catch {}

    try {
      const res = await apiFetch(`/api/transactions?userId=${user.id}`)
      const data = await res.json()
      if (data.success) {
        const txs = (data.transactions || []).slice(0, 5)
        setTransactions(txs)
        setUsingOffline(false)

        setCachedTransactions(data.transactions || [])
        setCachedUser({
          balance: data.balance ?? user?.balance ?? 0,
          frozenBalance: data.frozenBalance ?? user?.frozenBalance ?? 0,
          accountNumber: data.accountNumber ?? user?.accountNumber ?? null,
          fullName: user?.fullName ?? null,
          email: user?.email ?? '',
          kycStatus: user?.kycStatus ?? 'none',
        })
        setLastSyncTime()

        const updates: Record<string, unknown> = {}
        let needsUpdate = false
        if (data.balance !== null && data.balance !== undefined && data.balance !== user?.balance) {
          updates.balance = data.balance
          needsUpdate = true
        }
        if (data.frozenBalance !== null && data.frozenBalance !== undefined && data.frozenBalance !== user?.frozenBalance) {
          updates.frozenBalance = data.frozenBalance
          needsUpdate = true
        }
        if (data.accountNumber && data.accountNumber !== user?.accountNumber) {
          updates.accountNumber = data.accountNumber
          needsUpdate = true
        }
        if (needsUpdate) {
          useAuthStore.getState().updateUser(updates as any)
        }
      }
    } catch {
      if (cachedTransactions.length > 0) {
        setTransactions(cachedTransactions.slice(0, 5))
        setUsingOffline(true)
      }
    } finally {
      setLoading(false)
      try { (window as any).__topProgressBar?.complete() } catch {}
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ar-SA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="w-4 h-4 text-green-400" />
      case 'withdrawal': return <ArrowUpRight className="w-4 h-4 text-red-400" />
      case 'transfer': return <Send className="w-4 h-4 text-blue-400" />
      case 'bonus': return <TrendingUp className="w-4 h-4 text-gold" />
      default: return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'إيداع'
      case 'withdrawal': return 'سحب'
      case 'transfer': return 'تحويل'
      case 'bonus': return 'مكافأة'
      default: return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit': return { bg: 'bg-green-500/10', border: 'border-green-500/20' }
      case 'withdrawal': return { bg: 'bg-red-500/10', border: 'border-red-500/20' }
      case 'transfer': return { bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
      case 'bonus': return { bg: 'bg-gold/10', border: 'border-gold/20' }
      default: return { bg: 'bg-white/5', border: 'border-white/10' }
    }
  }

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'صباح الخير'
    if (hour < 17) return 'مساء الخير'
    return 'مساء النور'
  }

  return (
    <div className="space-y-5 animate-fade-in pb-24 stagger-children">

      {/* Offline Mode Indicator */}
      {usingOffline && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>أنت غير متصل — يتم عرض البيانات المخزنة مؤقتاً</span>
        </div>
      )}

      {/* ========== 3D WALLET CARD ========== */}
      <WalletCard3D className="p-5 sm:p-6 cursor-default">
        <div className="relative z-10 space-y-5">
          {/* Top row: logo + chip + contactless */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center">
                <Wallet className="w-4 h-4 text-gray-900" />
              </div>
              <span className="text-xs font-bold text-white/70 tracking-wide">FOREX YEMENI</span>
            </div>
            <WalletChip />
          </div>

          {/* Balance Display */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-white/50">{getGreeting()}،</p>
              <p className="text-[11px] font-semibold text-white/80">{user?.fullName || 'مستخدم'}</p>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight" dir="ltr">
                <AnimatedCounter
                  value={balance}
                  decimals={2}
                  duration={1000}
                  prefix=""
                  suffix=" USDT"
                />
              </div>
              <MiniSparkline data={sparklineData} color="#FCD535" />
            </div>
            {user?.frozenBalance ? (
              <p className="text-[10px] text-white/40" dir="ltr">
                مجمّد: <AnimatedCounter value={user.frozenBalance} decimals={2} suffix=" USDT" className="text-white/50" />
              </p>
            ) : null}
          </div>

          {/* Bottom row: account number + network */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">USDT TRC20</span>
              {user?.accountNumber && (
                <>
                  <span className="text-white/20">|</span>
                  <span className="text-[10px] text-white/50 font-mono" dir="ltr">#{user.accountNumber}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-emerald-400/60" />
              <span className="text-[9px] text-emerald-400/60">محمي</span>
            </div>
          </div>
        </div>
      </WalletCard3D>

      {/* ========== QUICK ACTION BUTTONS ========== */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: ArrowDownLeft, label: 'إيداع', screen: 'deposit', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', glow: 'hover:shadow-green-500/20' },
          { icon: ArrowUpRight, label: 'سحب', screen: 'withdraw', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', glow: 'hover:shadow-red-500/20' },
          { icon: Send, label: 'تحويل', screen: 'transfer', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', glow: 'hover:shadow-blue-500/20' },
          { icon: Users, label: 'P2P', screen: 'p2p', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', glow: 'hover:shadow-purple-500/20' },
        ].map((action) => {
          return (
            <button
              key={action.screen}
              onClick={() => setScreen(action.screen)}
              className={`quick-action-btn glass-card p-3 rounded-2xl flex flex-col items-center gap-2 ${action.bg} ${action.border} border hover:shadow-lg ${action.glow} transition-all duration-300`}
            >
              <div className={`action-icon w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center`}>
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <span className="text-[11px] font-semibold">{action.label}</span>
            </button>
          )
        })}
      </div>

      {/* ========== EXCHANGE RATE CARDS ========== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-gold" />
            أسعار الصرف
          </h2>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="w-3 h-3 text-gold/50" />
            <span>مباشر</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* USD */}
          <div className="glass-card p-3 rounded-xl space-y-2.5 relative overflow-hidden group hover:border-gold/30 transition-all card-hover">
            <div className="absolute top-0 left-0 w-16 h-16 bg-emerald-500/5 rounded-full -translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform duration-500" />
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-1.5">
                <DollarSign className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <p className="text-[9px] text-muted-foreground font-medium">الدولار</p>
              <p className="text-xs font-bold text-emerald-400 mt-0.5" dir="ltr">USDT</p>
            </div>
            <div className="relative border-t border-white/5 pt-2">
              <p className="text-[9px] text-muted-foreground">رصيدك</p>
              <p className="text-sm font-bold text-foreground" dir="ltr">
                <AnimatedCounter value={balance} decimals={2} />
              </p>
            </div>
          </div>

          {/* YER */}
          <div className="glass-card p-3 rounded-xl space-y-2.5 relative overflow-hidden group hover:border-gold/30 transition-all card-hover">
            <div className="absolute top-0 left-0 w-16 h-16 bg-blue-500/5 rounded-full -translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform duration-500" />
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center mb-1.5">
                <Landmark className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <p className="text-[9px] text-muted-foreground font-medium">ريال يمني</p>
              <p className="text-xs font-bold text-blue-400 mt-0.5" dir="ltr">ر.ي</p>
            </div>
            <div className="relative border-t border-white/5 pt-2">
              <p className="text-[9px] text-muted-foreground">رصيدك</p>
              <p className="text-sm font-bold text-foreground" dir="ltr">
                {balanceInYER.toLocaleString()}
              </p>
            </div>
          </div>

          {/* SAR */}
          <div className="glass-card p-3 rounded-xl space-y-2.5 relative overflow-hidden group hover:border-gold/30 transition-all card-hover">
            <div className="absolute top-0 left-0 w-16 h-16 bg-purple-500/5 rounded-full -translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform duration-500" />
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center mb-1.5">
                <Coins className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <p className="text-[9px] text-muted-foreground font-medium">ريال سعودي</p>
              <p className="text-xs font-bold text-purple-400 mt-0.5" dir="ltr">ر.س</p>
            </div>
            <div className="relative border-t border-white/5 pt-2">
              <p className="text-[9px] text-muted-foreground">رصيدك</p>
              <p className="text-sm font-bold text-foreground" dir="ltr">
                <AnimatedCounter value={balanceInSAR} decimals={2} />
              </p>
            </div>
          </div>
        </div>

        {/* Rates bar */}
        <div className="glass-card p-2.5 rounded-xl">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">1 USDT</span>
              <ArrowRightLeft className="w-2.5 h-2.5 text-gold" />
              <span className="font-bold text-blue-400">{rates.usdToYer.toLocaleString()} ر.ي</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">1 USDT</span>
              <ArrowRightLeft className="w-2.5 h-2.5 text-gold" />
              <span className="font-bold text-purple-400">{rates.usdToSar} ر.س</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">1 ر.س</span>
              <ArrowRightLeft className="w-2.5 h-2.5 text-gold" />
              <span className="font-bold text-amber-400">{rates.sarToYer.toLocaleString()} ر.ي</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========== ANNOUNCEMENTS ========== */}
      <AnnouncementBanner />

      {/* ========== BANNER ========== */}
      <BannerSlider />

      {/* ========== BALANCE CHART ========== */}
      <div className="glass-card p-4 rounded-2xl">
        <BalanceChart />
      </div>

      {/* ========== PROMO ========== */}
      <PromoRedeem />

      {/* ========== KYC STATUS + ACCOUNT NUMBER ROW ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* KYC Status */}
        <button
          onClick={() => setScreen('kyc')}
          className="glass-card glass-card-hover p-4 flex items-center gap-3 rounded-xl text-right transition-all"
        >
          <div className="flex-shrink-0">
            {kycSteps.completed === kycSteps.steps ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center relative">
                <Shield className="w-5 h-5 text-emerald-400" />
                <div className="glow-star-badge" />
              </div>
            ) : (
              <KYCProgressRing
                completed={kycSteps.completed}
                steps={kycSteps.steps}
                size={40}
                strokeWidth={3}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">التحقق من الهوية</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {user?.kycStatus === 'approved' ? 'الحساب موثق بالكامل' :
               user?.kycStatus === 'pending' ? 'قيد المراجعة' :
               user?.kycStatus === 'rejected' ? 'مرفوض - إعادة المحاولة' : 'أكمل التوثيق'}
            </p>
          </div>
          <ChevronLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>

        {/* Account Number */}
        {user?.accountNumber && (
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-base font-bold text-blue-400">#</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">رقم حسابك</p>
                <p className="text-sm font-bold font-mono tracking-wider truncate" dir="ltr">{user.accountNumber}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(String(user.accountNumber))
                  setCopiedAccount(true)
                  toast.success('تم نسخ رقم الحساب')
                  setTimeout(() => setCopiedAccount(false), 2000)
                }}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                {copiedAccount ? (
                  <CheckIcon className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground mt-2">شارك هذا الرقم مع الآخرين ليحوّلوا لك مباشرة</p>
          </div>
        )}
      </div>

      {/* ========== RECENT TRANSACTIONS ========== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold" />
            آخر المعاملات
          </h2>
          <button
            onClick={() => setScreen('transactions')}
            className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
          >
            عرض الكل
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2.5 stagger-children">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass-card p-4 shimmer h-[68px] rounded-xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="glass-card p-8 text-center rounded-2xl relative overflow-hidden">
            {/* Floating particles */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="particle"
                style={{
                  left: `${15 + i * 18}%`,
                  top: `${60 + Math.random() * 30}%`,
                  '--pd': `${3 + Math.random() * 3}s`,
                  '--pdl': `${Math.random() * 2}s`,
                  '--px': `${-10 + Math.random() * 20}px`,
                } as React.CSSProperties}
              />
            ))}
            <div className="empty-state-icon relative">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4 relative">
                <Wallet className="w-8 h-8 text-gold/40" />
                <div className="glow-star-badge" style={{ top: '-2px', right: '-2px' }} />
              </div>
            </div>
            <p className="text-muted-foreground text-sm mb-1">لا توجد معاملات بعد</p>
            <p className="text-muted-foreground/60 text-xs mb-4">
              {user?.kycStatus === 'approved' ? 'ابدأ بأول إيداع لتفعيل محفظتك' : 'وثّق هويتك أولاً لبدء استخدام المحفظة'}
            </p>
            <button
              onClick={() => setScreen('deposit')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gold-gradient text-gray-900 text-sm font-bold hover:opacity-90 transition-opacity tap-effect"
            >
              <ArrowDownLeft className="w-4 h-4" />
              {user?.kycStatus === 'approved' ? 'ابدأ الإيداع' : 'توثيق الهوية'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, index) => {
              const typeColor = getTypeColor(tx.type)
              return (
                <div
                  key={tx.id}
                  className={`glass-card glass-card-hover p-3.5 rounded-xl flex items-center justify-between tx-item-animate transition-all duration-200 hover:border-gold/20`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColor.bg} ${typeColor.border} border`}>
                      {getTypeIcon(tx.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{getTypeLabel(tx.type)}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount >= 0 ? '+' : ''}{Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
