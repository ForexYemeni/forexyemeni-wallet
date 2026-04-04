'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Clock, RefreshCw, CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react'

interface Trade {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  amount: number
  price: number
  total: number
  status: string
  buyerPaymentMethod: string
  listingType?: string
  listingNetwork?: string
  buyerName?: string
  sellerName?: string
  createdAt: string
  completedAt?: string | null
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'بانتظار التمويل', color: 'text-yellow-400 bg-yellow-500/10' },
  escrowed: { label: 'ممول بالحساب الأماني', color: 'text-blue-400 bg-blue-500/10' },
  paid: { label: 'تم التحويل', color: 'text-purple-400 bg-purple-500/10' },
  released: { label: 'مكتمل', color: 'text-green-400 bg-green-500/10' },
  disputed: { label: 'نزاع', color: 'text-red-400 bg-red-500/10' },
  cancelled: { label: 'ملغي', color: 'text-gray-400 bg-gray-500/10' },
  expired: { label: 'منتهي', color: 'text-gray-400 bg-gray-500/10' },
}

export default function P2PMyTrades({ onTradeClick }: { onTradeClick?: (tradeId: string) => void }) {
  const { user } = useAuthStore()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const fetchTrades = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/p2p/trades')
      const data = await res.json()
      if (data.success) setTrades(data.trades || [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  const filtered = filter === 'all' ? trades : trades.filter(t => t.status === filter)
  const activeCount = trades.filter(t => ['pending', 'escrowed', 'paid'].includes(t.status)).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold gold-text">صفقاتي</h2>
        <button onClick={fetchTrades} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'active', label: `نشطة (${activeCount})` },
          { key: 'released', label: 'مكتملة' },
          { key: 'cancelled', label: 'ملغاة' },
          { key: 'disputed', label: 'نزاعات' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key === 'active' ? 'special' : f.key)} className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${filter === f.key ? 'bg-gold/10 text-gold border border-gold/20' : 'text-muted-foreground bg-white/5 border border-transparent'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {(filter === 'special' ? trades.filter(t => ['pending', 'escrowed', 'paid'].includes(t.status)) : filtered).map((trade, i) => {
            const st = STATUS_MAP[trade.status] || STATUS_MAP.pending
            const isBuyer = trade.buyerId === user?.id
            return (
              <button key={trade.id} onClick={() => onTradeClick?.(trade.id)} className={`w-full glass-card p-4 rounded-xl space-y-3 text-right hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md ${st.color}`}>{st.label}</span>
                  <span className="text-[10px] text-muted-fontground">#{trade.id.substring(0, 8)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-[10px] text-muted-foreground">المبلغ</p>
                    <p className="text-sm font-bold">{trade.amount} USDT</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                    <p className="text-sm font-bold gold-text">{trade.total.toLocaleString()} YER</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{isBuyer ? 'مشتري' : 'بائع'} · {trade.listingNetwork || 'TRC20'}</span>
                  <span>{trade.buyerName || '—'} ↔ {trade.sellerName || '—'}</span>
                </div>
              </button>
            )
          })}
          {(filter === 'special' ? trades.filter(t => ['pending', 'escrowed', 'paid'].includes(t.status)) : filtered).length === 0 && (
            <div className="glass-card p-8 text-center">
              <p className="text-sm text-muted-foreground">لا توجد صفقات</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
