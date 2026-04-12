'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { useOfflineStore } from '@/lib/offline-store'
import { useOfflineMode } from '@/hooks/useOfflineMode'
import { convertUSDTtoYER, convertUSDTtoSAR, formatYER, formatSAR, formatUSDT, BalanceCurrencySelector, useExchangeRates } from '@/lib/currency'
import { toast } from 'sonner'
import BannerSlider from '@/components/BannerSlider'
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Clock,
  ChevronLeft,
  Send,
  Copy,
  Check as CheckIcon,
  WifiOff,
  ArrowRightLeft,
  Wallet,
  BadgeDollarSign,
  Landmark,
  Coins,
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
  const { user, setScreen, updateBalance } = useAuthStore()
  const { cachedTransactions, setCachedTransactions, setCachedUser, setLastSyncTime } = useOfflineStore()
  const { isOffline } = useOfflineMode()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedAccount, setCopiedAccount] = useState(false)
  const [usingOffline, setUsingOffline] = useState(false)
  const rates = useExchangeRates()

  // Combined data fetch — single API call for both transactions + user data
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData()
    }
  }, [user?.id])

  // Refresh when returning to dashboard (e.g. from another tab)
  useEffect(() => {
    if (user?.id && user?.currentScreen === 'dashboard') {
      fetchDashboardData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentScreen])

  // Load offline cache when going offline
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

    try {
      const res = await fetch(`/api/transactions?userId=${user.id}`)
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
      case 'fee_income': return <BadgeDollarSign className="w-4 h-4 text-amber-400" />
      default: return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'إيداع'
      case 'withdrawal': return 'سحب'
      case 'transfer': return 'تحويل'
      case 'bonus': return 'مكافأة'
      case 'fee_income': return 'رسوم'
      default: return type
    }
  }

  // Balance converted to different currencies
  const balance = user?.balance ?? 0
  const balanceInYER = convertUSDTtoYER(balance, rates.usdToYer)
  const balanceInSAR = convertUSDTtoSAR(balance, rates.usdToSar)

  return (
    <div className="space-y-5 animate-fade-in pb-24">
      {/* Offline Mode Indicator */}
      {usingOffline && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>أنت غير متصل — يتم عرض البيانات المخزنة مؤقتاً</span>
        </div>
      )}

      {/* Welcome + Balance Card */}
      <div className="glass-card gold-border gold-glow p-5 relative overflow-hidden rounded-2xl">
        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-36 h-36 bg-gold/5 rounded-full -translate-x-10 -translate-y-10" />
        <div className="absolute bottom-0 right-0 w-28 h-28 bg-gold/5 rounded-full translate-x-8 translate-y-8" />
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-gold/3 rounded-full" />

        <div className="relative space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مرحباً، {user?.fullName || 'مستخدم'}</p>
                <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md">USDT TRC20</span>
              </div>
            </div>
          </div>

          {/* Balance */}
          <BalanceCurrencySelector
            balance={balance}
            frozenBalance={user?.frozenBalance ?? 0}
          />

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <button
              onClick={() => setScreen('deposit')}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-sm font-medium"
            >
              <ArrowDownLeft className="w-4 h-4" />
              إيداع
            </button>
            <button
              onClick={() => setScreen('withdraw')}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium"
            >
              <ArrowUpRight className="w-4 h-4" />
              سحب
            </button>
            <button
              onClick={() => setScreen('transfer')}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-sm font-medium"
            >
              <Send className="w-4 h-4" />
              تحويل
            </button>
          </div>
        </div>
      </div>

      {/* ==================== Exchange Rate Cards ==================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-gold" />
            أسعار الصرف
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* USD Dollar Card */}
          <div className="glass-card p-3.5 rounded-xl space-y-3 relative overflow-hidden group hover:border-gold/30 transition-all">
            <div className="absolute top-0 left-0 w-16 h-16 bg-emerald-500/5 rounded-full -translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">الدولار</p>
              <p className="text-sm font-bold text-emerald-400 mt-0.5" dir="ltr">USDT</p>
            </div>
            <div className="relative border-t border-white/5 pt-2.5">
              <p className="text-[10px] text-muted-foreground">رصيدك</p>
              <p className="text-sm font-bold text-foreground" dir="ltr">
                {balance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* YER Yemeni Card */}
          <div className="glass-card p-3.5 rounded-xl space-y-3 relative overflow-hidden group hover:border-gold/30 transition-all">
            <div className="absolute top-0 left-0 w-16 h-16 bg-blue-500/5 rounded-full -translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2">
                <Landmark className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">ريال يمني</p>
              <p className="text-sm font-bold text-blue-400 mt-0.5" dir="ltr">ر.ي</p>
            </div>
            <div className="relative border-t border-white/5 pt-2.5">
              <p className="text-[10px] text-muted-foreground">رصيدك</p>
              <p className="text-sm font-bold text-foreground" dir="ltr">
                {balanceInYER.toLocaleString()}
              </p>
            </div>
          </div>

          {/* SAR Saudi Card */}
          <div className="glass-card p-3.5 rounded-xl space-y-3 relative overflow-hidden group hover:border-gold/30 transition-all">
            <div className="absolute top-0 left-0 w-16 h-16 bg-purple-500/5 rounded-full -translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-2">
                <Coins className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">ريال سعودي</p>
              <p className="text-sm font-bold text-purple-400 mt-0.5" dir="ltr">ر.س</p>
            </div>
            <div className="relative border-t border-white/5 pt-2.5">
              <p className="text-[10px] text-muted-foreground">رصيدك</p>
              <p className="text-sm font-bold text-foreground" dir="ltr">
                {balanceInSAR.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Rates Info Bar */}
        <div className="glass-card p-3 rounded-xl">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">1 USDT</span>
              <ArrowRightLeft className="w-3 h-3 text-gold" />
              <span className="font-bold text-blue-400">{rates.usdToYer.toLocaleString()} ر.ي</span>
            </div>
            <div className="w-px h-3.5 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">1 USDT</span>
              <ArrowRightLeft className="w-3 h-3 text-gold" />
              <span className="font-bold text-purple-400">{rates.usdToSar} ر.س</span>
            </div>
            <div className="w-px h-3.5 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">1 ر.س</span>
              <ArrowRightLeft className="w-3 h-3 text-gold" />
              <span className="font-bold text-amber-400">{rates.sarToYer.toLocaleString()} ر.ي</span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Slider */}
      <BannerSlider />

      {/* Promo Code */}
      <PromoRedeem />

      {/* Account Number Card */}
      {user?.accountNumber && (
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-400">#</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">رقم حسابك</p>
                <p className="text-lg font-bold font-mono tracking-wider">{user.accountNumber}</p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(String(user.accountNumber))
                setCopiedAccount(true)
                toast.success('تم نسخ رقم الحساب')
                setTimeout(() => setCopiedAccount(false), 2000)
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs"
            >
              {copiedAccount ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">نسخ</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">شارك هذا الرقم مع الآخرين ليحوّلوا لك مباشرة</p>
        </div>
      )}

      {/* KYC Status */}
      {user?.kycStatus !== 'approved' && (
        <button
          onClick={() => setScreen('kyc')}
          className="w-full glass-card p-4 flex items-center justify-between hover:border-gold/30 transition-all rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gold" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">التحقق من الهوية</p>
              <p className="text-xs text-muted-foreground">
                {user?.kycStatus === 'none' ? 'لم تبدأ بعد' :
                 user?.kycStatus === 'pending' ? 'قيد المراجعة' :
                 user?.kycStatus === 'rejected' ? 'مرفوض - إعادة المحاولة' : user?.kycStatus}
              </p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Recent Transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">آخر المعاملات</h2>
          <button
            onClick={() => setScreen('transactions')}
            className="text-xs text-gold hover:text-gold-light transition-colors"
          >
            عرض الكل
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass-card p-4 shimmer h-16 rounded-xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="glass-card p-8 text-center rounded-xl">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد معاملات بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="glass-card glass-card-hover p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.amount >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {getTypeIcon(tx.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{getTypeLabel(tx.type)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}{Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
