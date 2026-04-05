'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  Store,
} from 'lucide-react'

// ===================== TYPES =====================

interface RecentTrade {
  id: string
  amount: number
  total: number
  status: string
  createdAt: string
  completedAt: string | null
  type: 'buy' | 'sell'
}

interface ActiveListing {
  id: string
  type: string
  amount: number
  price: number
  network: string
  totalTrades: number
  successRate: number
}

interface MerchantStats {
  totalCompletedTrades: number
  totalTrades: number
  totalTradeVolume: number
  totalEarnings: number
  successRate: number
  activeListingsCount: number
  pendingOrdersCount: number
  completedOrdersCount: number
  recentTrades: RecentTrade[]
  activeListings: ActiveListing[]
  cancelledCount: number
}

interface MerchantDashboardProps {
  onNavigateToListings?: () => void
  onNavigateToTrades?: () => void
}

// ===================== STATUS HELPERS =====================

function getStatusLabel(status: string): string {
  switch (status) {
    case 'released':
      return 'مكتملة'
    case 'pending':
      return 'معلقة'
    case 'escrowed':
      return 'في الحساب الأماني'
    case 'paid':
      return 'تم الدفع'
    case 'disputed':
      return 'متنازع عليها'
    case 'cancelled':
      return 'ملغاة'
    case 'expired':
      return 'منتهية'
    default:
      return status
  }
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'released':
      return 'bg-green-500/10 text-green-400'
    case 'pending':
    case 'escrowed':
    case 'paid':
      return 'bg-yellow-500/10 text-yellow-400'
    case 'disputed':
      return 'bg-red-500/10 text-red-400'
    case 'cancelled':
    case 'expired':
      return 'bg-gray-500/10 text-gray-400'
    default:
      return 'bg-white/5 text-muted-foreground'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'released':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
    case 'pending':
    case 'escrowed':
    case 'paid':
      return <Clock className="w-3.5 h-3.5 text-yellow-400" />
    case 'cancelled':
    case 'expired':
      return <XCircle className="w-3.5 h-3.5 text-gray-400" />
    default:
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ar-YE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function formatAmount(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`
  }
  return amount.toFixed(2)
}

// ===================== COMPONENT =====================

export default function MerchantDashboard({ onNavigateToListings, onNavigateToTrades }: MerchantDashboardProps) {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<MerchantStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const merchantId = user?.merchantId

  const fetchStats = useCallback(async () => {
    if (!merchantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/p2p/merchant/stats?merchantId=${merchantId}`)
      const data = await res.json()
      if (data.success) {
        setStats(data.stats)
      } else {
        setError(data.message || 'خطأ في جلب البيانات')
      }
    } catch {
      setError('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (!merchantId) {
    return (
      <div className="glass-card p-8 text-center">
        <Store className="w-10 h-10 text-gold mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">يجب أن تكون تاجر موثق لعرض لوحة التحكم المالية</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton for stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-28 rounded-xl" />
          ))}
        </div>
        <div className="glass-card shimmer h-64 rounded-xl" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="glass-card p-8 text-center space-y-3">
        <XCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="text-sm text-red-400">{error || 'لم يتم العثور على بيانات'}</p>
        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-2 px-4 h-10 gold-gradient text-gray-900 font-bold text-xs rounded-xl hover:opacity-90 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold gold-text">لوحة التحكم المالية</h2>
        <button
          onClick={fetchStats}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Trades */}
        <div className="glass-card p-4 rounded-xl space-y-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="relative flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground">إجمالي الصفقات</span>
          </div>
          <p className="relative text-2xl font-bold gold-text">
            {stats.totalTrades}
          </p>
          <p className="relative text-[10px] text-muted-foreground">
            {stats.totalCompletedTrades} مكتملة
          </p>
        </div>

        {/* Trade Volume */}
        <div className="glass-card p-4 rounded-xl space-y-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="relative flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs text-muted-foreground">حجم التداول</span>
          </div>
          <p className="relative text-2xl font-bold gold-text">
            {formatAmount(stats.totalTradeVolume)}
          </p>
          <p className="relative text-[10px] text-muted-foreground">USDT</p>
        </div>

        {/* Earnings */}
        <div className="glass-card p-4 rounded-xl space-y-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-20 h-20 bg-gold/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="relative flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-gold" />
            </div>
            <span className="text-xs text-muted-foreground">الأرباح</span>
          </div>
          <p className="relative text-2xl font-bold gold-text">
            {formatAmount(stats.totalEarnings)}
          </p>
          <p className="relative text-[10px] text-muted-foreground">USDT (عمولة 1%)</p>
        </div>

        {/* Success Rate */}
        <div className="glass-card p-4 rounded-xl space-y-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-20 h-20 bg-green-500/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="relative flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground">نسبة النجاح</span>
          </div>
          <p className="relative text-2xl font-bold gold-text">
            {stats.successRate}%
          </p>
          <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full gold-gradient transition-all duration-700"
              style={{ width: `${Math.min(stats.successRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Order Summary Row */}
      <div className="glass-card p-4 rounded-xl">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-muted-foreground">إعلانات نشطة</span>
            </div>
            <p className="text-lg font-bold">{stats.activeListingsCount}</p>
          </div>
          <div className="text-center border-x border-white/5">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] text-muted-foreground">طلبات معلقة</span>
            </div>
            <p className="text-lg font-bold">{stats.pendingOrdersCount}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[10px] text-muted-foreground">طلبات مكتملة</span>
            </div>
            <p className="text-lg font-bold">{stats.completedOrdersCount}</p>
          </div>
        </div>
      </div>

      {/* Active Listings Summary */}
      {stats.activeListings.length > 0 && (
        <div className="glass-card p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold gold-text">الإعلانات النشطة</h3>
            {onNavigateToListings && (
              <button
                onClick={onNavigateToListings}
                className="text-[10px] text-muted-foreground hover:text-gold transition-colors"
              >
                عرض الكل
              </button>
            )}
          </div>
          <div className="space-y-2">
            {stats.activeListings.map((listing) => (
              <div
                key={listing.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                      listing.type === 'sell'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    {listing.type === 'sell' ? 'بيع' : 'شراء'}
                  </div>
                  <div>
                    <p className="text-xs font-bold">
                      {listing.amount} USDT
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {listing.network} · {listing.totalTrades} صفقة · {listing.successRate}%
                    </p>
                  </div>
                </div>
                <p className="text-xs font-bold gold-text">
                  {listing.price.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold gold-text">آخر الصفقات</h3>
          {onNavigateToTrades && (
            <button
              onClick={onNavigateToTrades}
              className="text-[10px] text-muted-foreground hover:text-gold transition-colors"
            >
              عرض الكل
            </button>
          )}
        </div>
        {stats.recentTrades.length === 0 ? (
          <div className="text-center py-6">
            <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">لا توجد صفقات بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(trade.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                          trade.type === 'sell'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {trade.type === 'sell' ? 'بيع' : 'شراء'}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md ${getStatusStyle(trade.status)}`}
                      >
                        {getStatusLabel(trade.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDate(trade.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold gold-text">
                    {trade.amount} USDT
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    #{trade.id.slice(0, 8)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
