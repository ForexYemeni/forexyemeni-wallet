'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { ShoppingCart, Store, History, UserCheck, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

const MerchantVerification = dynamic(() => import('./MerchantVerification'), { ssr: false })
const P2PMarketplace = dynamic(() => import('./P2PMarketplace'), { ssr: false })
const P2PMyListings = dynamic(() => import('./P2PMyListings'), { ssr: false })
const P2PMyTrades = dynamic(() => import('./P2PMyTrades'), { ssr: false })
const P2PTradeDetail = dynamic(() => import('./P2PTradeDetail'), { ssr: false })

type SubScreen = 'market' | 'my-listings' | 'my-trades' | 'trade-detail' | 'verification'

export default function P2PPage() {
  const { user } = useAuthStore()
  const [subScreen, setSubScreen] = useState<SubScreen>('market')
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [creatingTrade, setCreatingTrade] = useState<{ listingId: string; type: string } | null>(null)

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
          amount: 0, // Will be filled by a dialog - for now quick create
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold gold-text">التداول P2P</h1>
        <p className="text-sm text-muted-foreground">بيع وشراء USDT مباشرة مع التجار</p>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'market' as const, label: 'السوق', icon: ShoppingCart },
          { key: 'my-listings' as const, label: 'إعلاناتي', icon: Store },
          { key: 'my-trades' as const, label: 'صفقاتي', icon: History },
          { key: 'verification' as const, label: 'التوثيق', icon: UserCheck },
        ].map(item => (
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
