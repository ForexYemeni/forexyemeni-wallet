'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { convertUSDTtoYER, formatYER } from '@/lib/currency'
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedAccount, setCopiedAccount] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchTransactions()
      fetchLatestUserData()
    }
  }, [user?.id])

  // Refresh data when screen becomes active (e.g. returning from another tab)
  useEffect(() => {
    if (user?.id) {
      fetchTransactions()
      fetchLatestUserData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentScreen])

  const fetchTransactions = async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/transactions?userId=${user.id}`)
      const data = await res.json()
      if (data.success) {
        setTransactions(data.transactions.slice(0, 5))
        // Update local balance from server
        if (data.balance !== null && data.balance !== undefined && data.balance !== user?.balance) {
          updateBalance(data.balance)
        }
        // Also update accountNumber from server if available
        if (data.accountNumber && data.accountNumber !== user?.accountNumber) {
          useAuthStore.getState().updateUser({ accountNumber: data.accountNumber } as any)
        }
        if (data.frozenBalance !== null && data.frozenBalance !== undefined && data.frozenBalance !== user?.frozenBalance) {
          useAuthStore.getState().updateUser({ frozenBalance: data.frozenBalance } as any)
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const fetchLatestUserData = async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/transactions?userId=${user.id}`)
      const data = await res.json()
      if (data.success) {
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
      // silently fail
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner Slider */}
      <BannerSlider />

      {/* Balance Card */}
      <div className="glass-card gold-border gold-glow p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gold/5 rounded-full -translate-x-8 -translate-y-8" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-gold/5 rounded-full translate-x-6 translate-y-6" />

        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gold" />
              <span className="text-muted-foreground text-sm">رصيدك الحالي</span>
            </div>
            <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-md">USDT TRC20</span>
          </div>

          <div className="text-4xl font-bold gold-text tracking-tight">
            {user?.balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
          </div>
          <div className="text-sm text-muted-foreground">
            ≈ {formatYER(convertUSDTtoYER(user?.balance ?? 0))}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">المجمّد:</span>
            <span className="text-foreground/70">
              {user?.frozenBalance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'} USDT
            </span>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => setScreen('deposit')}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-sm font-medium"
            >
              <ArrowDownLeft className="w-4 h-4" />
              إيداع
            </button>
            <button
              onClick={() => setScreen('withdraw')}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium"
            >
              <ArrowUpRight className="w-4 h-4" />
              سحب
            </button>
            <button
              onClick={() => setScreen('transfer')}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-sm font-medium"
            >
              <Send className="w-4 h-4" />
              تحويل
            </button>
          </div>
        </div>
      </div>

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
          className="w-full glass-card p-4 flex items-center justify-between hover:border-gold/30 transition-all"
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
          <div className="glass-card p-8 text-center">
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
