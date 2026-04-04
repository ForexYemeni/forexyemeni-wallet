'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Clock, Shield, AlertTriangle, CheckCircle, Star } from 'lucide-react'

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
  buyerPaymentRef: string
  escrowTxId: string
  listingType?: string
  listingNetwork?: string
  buyerName?: string
  sellerName?: string
  disputeReason?: string | null
  createdAt: string
  completedAt?: string | null
}

const STATUS_MAP: Record<string, { label: string; color: string; step: number }> = {
  pending: { label: 'بانتظار التمويل', color: 'text-yellow-400 bg-yellow-500/10', step: 1 },
  escrowed: { label: 'ممول - بانتظار التحويل', color: 'text-blue-400 bg-blue-500/10', step: 2 },
  paid: { label: 'تم التحويل - بانتظار التحرير', color: 'text-purple-400 bg-purple-500/10', step: 3 },
  released: { label: 'مكتمل', color: 'text-green-400 bg-green-500/10', step: 4 },
  disputed: { label: 'نزاع مفتوح', color: 'text-red-400 bg-red-500/10', step: 0 },
  cancelled: { label: 'ملغي', color: 'text-gray-400 bg-gray-500/10', step: 0 },
  expired: { label: 'منتهي', color: 'text-gray-400 bg-gray-500/10', step: 0 },
}

const STEPS = ['تمويل الحساب الأماني', 'المشتري يحول', 'البائع يحرر', 'مكتمل']

export default function P2PTradeDetail({ tradeId, onBack }: { tradeId: string; onBack: () => void }) {
  const { user } = useAuthStore()
  const [trade, setTrade] = useState<Trade | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)

  useEffect(() => {
    if (tradeId) fetchTrade()
  }, [tradeId])

  const fetchTrade = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/p2p/trades/${tradeId}`)
      const data = await res.json()
      if (data.success) setTrade(data.trade)
      else toast.error(data.message)
    } catch { toast.error('خطأ في جلب الصفقة') }
    finally { setLoading(false) }
  }

  const handleAction = async (action: string, body?: any) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/p2p/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        fetchTrade()
        setShowDispute(false)
      } else toast.error(data.message)
    } catch { toast.error('خطأ') }
    finally { setActionLoading(false) }
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
  }

  if (!trade) return null

  const isBuyer = trade.buyerId === user?.id
  const isSeller = trade.sellerId === user?.id
  const st = STATUS_MAP[trade.status] || STATUS_MAP.pending
  const isFinished = ['released', 'cancelled', 'expired'].includes(trade.status)

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        العودة
      </button>

      {/* Status */}
      <div className={`p-4 rounded-xl border ${st.color} text-center space-y-1`}>
        <p className="text-sm font-bold">{st.label}</p>
        <p className="text-[10px] opacity-70">#{trade.id.substring(0, 12)}</p>
      </div>

      {/* Progress Steps (for active trades) */}
      {!isFinished && trade.status !== 'disputed' && (
        <div className="glass-card p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${st.step > i ? 'gold-gradient text-gray-900' : 'bg-white/10 text-muted-foreground'}`}>
                  {st.step > i ? '✓' : i + 1}
                </div>
                <span className="text-[9px] text-muted-foreground text-center leading-tight">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Info */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-[10px] text-muted-foreground">المبلغ</p>
            <p className="text-lg font-bold">{trade.amount} <span className="text-xs text-muted-foreground">USDT</span></p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-[10px] text-muted-foreground">السعر</p>
            <p className="text-lg font-bold gold-text">{trade.price.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-[10px] text-muted-foreground">الإجمالي</p>
            <p className="text-lg font-bold">{trade.total.toLocaleString()} <span className="text-xs text-muted-foreground">YER</span></p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-[10px] text-muted-foreground">الشبكة</p>
            <p className="text-lg font-bold">{trade.listingNetwork || 'TRC20'}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5">
          <span>أنت: {isBuyer ? 'مشتري' : 'بائع'}</span>
          <span>{trade.buyerName || '—'} ↔ {trade.sellerName || '—'}</span>
        </div>
      </div>

      {/* Actions */}
      {!isFinished && trade.status !== 'disputed' && (
        <div className="space-y-3">
          {/* Seller: Fund Escrow */}
          {isSeller && trade.status === 'pending' && (
            <button onClick={() => handleAction('fund_escrow')} disabled={actionLoading} className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all">
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تمويل حساب الأماني'}
            </button>
          )}

          {/* Buyer: Confirm Payment */}
          {isBuyer && trade.status === 'escrowed' && (
            <div className="glass-card p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span>قم بتحويل المبلغ إلى حساب البائع</span>
              </div>
              <p className="text-xs text-muted-foreground">
                قم بتحويل <span className="font-bold gold-text">{trade.total.toLocaleString()} YER</span> عبر {trade.buyerPaymentMethod} إلى البائع
              </p>
              <button onClick={() => handleAction('confirm_payment')} disabled={actionLoading} className="w-full h-12 bg-green-500/20 text-green-400 font-bold rounded-xl hover:bg-green-500/30 border border-green-500/20 transition-all">
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '✓ تم التحويل'}
              </button>
            </div>
          )}

          {/* Seller: Release Coins */}
          {isSeller && trade.status === 'paid' && (
            <div className="glass-card p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>المشتري أكد التحويل</span>
              </div>
              <p className="text-xs text-muted-foreground">تحقق من استلام المبلغ ثم حرر العملات للمشتري</p>
              <button onClick={() => handleAction('release_coins')} disabled={actionLoading} className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all">
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تمام - تحرير العملات'}
              </button>
            </div>
          )}

          {/* Dispute button */}
          {(['escrowed', 'paid', 'pending'].includes(trade.status)) && (
            !showDispute ? (
              <button onClick={() => setShowDispute(true)} className="w-full h-10 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl hover:bg-red-500/20 border border-red-500/10 transition-all flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" />
                فتح نزاع
              </button>
            ) : (
              <div className="glass-card p-4 rounded-xl space-y-3 border border-red-500/10">
                <label className="text-xs font-medium text-red-400">سبب النزاع</label>
                <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={3} className="w-full rounded-xl glass-input px-3 py-2 text-sm resize-none" placeholder="اشرح سبب النزاع..." />
                <div className="flex gap-2">
                  <button onClick={() => setShowDispute(false)} className="flex-1 h-10 bg-white/5 text-muted-foreground text-sm rounded-xl">إلغاء</button>
                  <button onClick={() => handleAction('open_dispute', { disputeReason })} disabled={actionLoading || !disputeReason.trim()} className="flex-1 h-10 bg-red-500 text-white text-sm font-bold rounded-xl">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'إرسال'}
                  </button>
                </div>
              </div>
            )
          )}

          {/* Cancel */}
          {trade.status === 'pending' && (
            <button onClick={() => { if (confirm('هل أنت متأكد من إلغاء الصفقة؟')) handleAction('cancel_trade') }} className="w-full h-10 text-red-400 text-xs hover:bg-red-500/10 rounded-xl transition-all">
              إلغاء الصفقة
            </button>
          )}
        </div>
      )}

      {/* Disputed */}
      {trade.status === 'disputed' && (
        <div className="glass-card p-4 rounded-xl border border-red-500/10 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-400">
            <AlertTriangle className="w-4 h-4" />
            نزاع مفتوح
          </div>
          {trade.disputeReason && <p className="text-xs text-muted-foreground">السبب: {trade.disputeReason}</p>}
          <p className="text-[10px] text-muted-foreground">سيتم مراجعة النزاع من قبل الإدارة</p>
        </div>
      )}
    </div>
  )
}
