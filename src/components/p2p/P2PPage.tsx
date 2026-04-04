'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  ShoppingCart, Store, History, UserCheck,
  DollarSign, ArrowDownLeft, ArrowUpRight, TrendingUp,
  Loader2, RefreshCw, Package, Users
} from 'lucide-react'
import dynamic from 'next/dynamic'

const MerchantVerification = dynamic(() => import('./MerchantVerification'), { ssr: false })
const P2PMarketplace = dynamic(() => import('./P2PMarketplace'), { ssr: false })
const P2PMyListings = dynamic(() => import('./P2PMyListings'), { ssr: false })
const P2PMyTrades = dynamic(() => import('./P2PMyTrades'), { ssr: false })
const P2PTradeDetail = dynamic(() => import('./P2PTradeDetail'), { ssr: false })

type SubScreen = 'overview' | 'market' | 'my-listings' | 'my-trades' | 'trade-detail' | 'verification'

export default function P2PPage() {
  const { user } = useAuthStore()
  const [subScreen, setSubScreen] = useState<SubScreen>('overview')
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [creatingTrade, setCreatingTrade] = useState<{ listingId: string; type: string } | null>(null)

  // Merchant stats
  const [stats, setStats] = useState({ totalTrades: 0, activeListings: 0, completedTrades: 0, pendingTrades: 0 })
  const [statsLoading, setStatsLoading] = useState(true)

  const isMerchant = !!user?.merchantId && user.role !== 'admin'

  const fetchStats = useCallback(async () => {
    if (!user?.merchantId) { setStatsLoading(false); return }
    setStatsLoading(true)
    try {
      const [tradesRes, listingsRes] = await Promise.all([
        fetch('/api/p2p/trades'),
        fetch('/api/p2p/listings'),
      ])
      const [tradesData, listingsData] = await Promise.all([tradesRes.json(), listingsRes.json()])

      const trades = tradesData.trades || []
      const listings = (listingsData.listings || []).filter((l: any) => l.merchantId === user.merchantId)

      setStats({
        totalTrades: trades.length,
        activeListings: listings.filter((l: any) => l.status === 'active').length,
        completedTrades: trades.filter((t: any) => t.status === 'released').length,
        pendingTrades: trades.filter((t: any) => ['pending', 'escrowed', 'paid'].includes(t.status)).length,
      })
    } catch { /* silent */ }
    finally { setStatsLoading(false) }
  }, [user?.merchantId])

  useEffect(() => {
    if (subScreen === 'overview') fetchStats()
  }, [subScreen, fetchStats])

  // Redirect non-merchant to market
  useEffect(() => {
    if (!isMerchant && subScreen === 'overview') {
      setSubScreen('market')
    }
  }, [isMerchant, subScreen])

  const handleBuy = (listingId: string) => {
    setCreatingTrade({ listingId, type: 'buy' })
  }

  const handleTradeClick = (tradeId: string) => {
    setSelectedTradeId(tradeId)
    setSubScreen('trade-detail')
  }

  const handleCreateTrade = async () => {
    if (!creatingTrade) return
    try {
      const res = await fetch('/api/p2p/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: creatingTrade.listingId,
          amount: 0,
          buyerPaymentMethod: 'bank_transfer',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء الصفقة')
        setSelectedTradeId(data.trade.id)
        setSubScreen('trade-detail')
        setCreatingTrade(null)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في إنشاء الصفقة')
    }
    setCreatingTrade(null)
  }

  const tabs = isMerchant ? [
    { key: 'overview' as const, label: 'لوحة التحكم', icon: TrendingUp },
    { key: 'my-listings' as const, label: 'إعلاناتي', icon: Store },
    { key: 'my-trades' as const, label: 'الطلبات', icon: History },
    { key: 'market' as const, label: 'السوق', icon: ShoppingCart },
    { key: 'verification' as const, label: 'التوثيق', icon: UserCheck },
  ] : [
    { key: 'market' as const, label: 'السوق', icon: ShoppingCart },
    { key: 'my-trades' as const, label: 'صفقاتي', icon: History },
    { key: 'verification' as const, label: 'التوثيق', icon: UserCheck },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold gold-text">التداول P2P</h1>
        <p className="text-sm text-muted-foreground">بيع وشراء USDT مباشرة مع التجار</p>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(item => (
          <button
            key={item.key}
            onClick={() => setSubScreen(item.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0 ${
              subScreen === item.key ? 'bg-gold/10 text-gold border border-gold/20' : 'text-muted-foreground bg-white/5 border border-transparent hover:bg-white/10'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subScreen === 'overview' && isMerchant && (
        <MerchantOverview
          stats={stats}
          loading={statsLoading}
          onRefresh={fetchStats}
          onCreateListing={() => setSubScreen('my-listings')}
          onViewTrades={() => setSubScreen('my-trades')}
        />
      )}
      {subScreen === 'market' && <P2PMarketplace onBuy={handleBuy} onSell={handleBuy} />}
      {subScreen === 'my-listings' && <P2PMyListings />}
      {subScreen === 'my-trades' && <P2PMyTrades onTradeClick={handleTradeClick} />}
      {subScreen === 'verification' && <MerchantVerification />}
      {subScreen === 'trade-detail' && selectedTradeId && (
        <P2PTradeDetail tradeId={selectedTradeId} onBack={() => setSubScreen('my-trades')} />
      )}

      {/* Quick Trade Dialog */}
      {creatingTrade && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setCreatingTrade(null)}>
          <div className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()} dir="rtl">
            <h3 className="text-lg font-bold gold-text">إنشاء صفقة</h3>
            <p className="text-sm text-muted-foreground">سيتم إنشاء صفقة P2P مع التاجر</p>
            <button onClick={handleCreateTrade} className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90">
              تأكيد إنشاء الصفقة
            </button>
            <button onClick={() => setCreatingTrade(null)} className="w-full h-10 bg-white/10 text-foreground rounded-xl text-sm">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== MERCHANT OVERVIEW DASHBOARD =====================

function MerchantOverview({
  stats, loading, onRefresh, onCreateListing, onViewTrades
}: {
  stats: { totalTrades: number; activeListings: number; completedTrades: number; pendingTrades: number }
  loading: boolean
  onRefresh: () => void
  onCreateListing: () => void
  onViewTrades: () => void
}) {
  const { user, setScreen } = useAuthStore()

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="glass-card p-5 rounded-2xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gold/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-gold/5 rounded-full translate-x-1/2 translate-y-1/2" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">رصيد المحفظة</p>
            <button onClick={onRefresh} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold gold-text">
              {(user?.balance ?? 0).toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">USDT</span>
          </div>
          {user?.frozenBalance && user.frozenBalance > 0 && (
            <p className="text-xs text-blue-400 mb-4">
              مجمد: {user.frozenBalance.toFixed(2)} USDT
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setScreen('deposit')}
              className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-green-500/10 text-green-400 text-xs font-bold hover:bg-green-500/20 transition-all"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              إيداع
            </button>
            <button
              onClick={() => setScreen('withdraw')}
              className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-orange-500/10 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-all"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              سحب
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Store className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs text-muted-foreground">إعلانات نشطة</span>
            </div>
            <p className="text-xl font-bold">{stats.activeListings}</p>
          </div>
          <div className="glass-card p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <History className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-xs text-muted-foreground">طلبات معلقة</span>
            </div>
            <p className="text-xl font-bold">{stats.pendingTrades}</p>
          </div>
          <div className="glass-card p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-xs text-muted-foreground">صفقات مكتملة</span>
            </div>
            <p className="text-xl font-bold">{stats.completedTrades}</p>
          </div>
          <div className="glass-card p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-xs text-muted-foreground">إجمالي الصفقات</span>
            </div>
            <p className="text-xl font-bold">{stats.totalTrades}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">إجراءات سريعة</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCreateListing}
            className="glass-card p-3 rounded-xl flex items-center gap-3 hover:bg-white/5 transition-colors text-right"
          >
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <p className="text-xs font-bold">إعلان جديد</p>
              <p className="text-[10px] text-muted-foreground">إنشاء إعلان بيع/شراء</p>
            </div>
          </button>
          <button
            onClick={onViewTrades}
            className="glass-card p-3 rounded-xl flex items-center gap-3 hover:bg-white/5 transition-colors text-right"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <History className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-bold">الطلبات الواردة</p>
              <p className="text-[10px] text-muted-foreground">{stats.pendingTrades > 0 ? `${stats.pendingTrades} طلب معلق` : 'لا توجد طلبات'}</p>
            </div>
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <p className="text-sm font-bold gold-text">كيف يعمل التداول P2P</p>
        <div className="space-y-3">
          {[
            { step: '1', title: 'إنشاء إعلان', desc: 'أنشئ إعلان بيع أو شراء USDT مع تحديد السعر والطرق' },
            { step: '2', title: 'استقبال الطلبات', desc: 'يستلم المستخدمون إعلانك ويرسلون طلبات شراء/بيع' },
            { step: '3', title: 'تمويل الحساب الأماني', desc: 'قم بتمويل حساب الأماني بقيمة USDT لضمان الصفقة' },
            { step: '4', title: 'المستخدم يحول', desc: 'المشتري يحول المبلغ بالنقد إلى حسابك البنكي' },
            { step: '5', title: 'تحرير العملات', desc: 'بعد تأكيد استلام المبلغ، حرر USDT للمشتري' },
          ].map(item => (
            <div key={item.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full gold-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-gray-900">{item.step}</span>
              </div>
              <div>
                <p className="text-xs font-bold">{item.title}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
