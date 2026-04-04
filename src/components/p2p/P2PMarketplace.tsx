'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Star,
  Loader2,
  RefreshCw,
  Shield,
  Plus,
  Clock,
  CheckCircle,
  ShoppingCart,
} from 'lucide-react'

// ===================== TYPES =====================

interface P2POrder {
  id: string
  merchantId: string
  merchantName: string
  merchantEmail: string
  type: 'sell' | 'buy'
  asset: string
  network: string
  amount: number
  price: number
  minAmount: number
  maxAmount: number
  paymentMethods: string[]
  paymentDetails: string
  status: string
  escrowAmount: number
  p2pFee: number
  totalAmount: number
  expiresAt: string
  createdAt: string
  merchantFullName?: string
  merchantAvatar?: string
}

// ===================== HELPERS =====================

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'تحويل بنكي',
  bank_deposit: 'إيداع بنكي',
  atm_transfer: 'صراف آلي',
  mobile_payment: 'دفع عبر الجوال',
  cash: 'نقدي',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  const days = Math.floor(hrs / 24)
  return `منذ ${days} يوم`
}

// ===================== COMPONENT =====================

export default function P2PMarketplace() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<P2POrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [networkFilter, setNetworkFilter] = useState<string>('TRC20')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<P2POrder | null>(null)
  const [isMerchant, setIsMerchant] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      // To buy USDT, find sell orders. To sell USDT, find buy orders.
      const type = activeTab === 'buy' ? 'sell' : 'buy'
      const params = new URLSearchParams({ type })
      if (networkFilter) params.set('network', networkFilter)

      const res = await fetch(`/api/p2p/orders?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setOrders((data.orders || []).filter((o: P2POrder) => o.status === 'open'))
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [activeTab, networkFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Check if user is an approved merchant
  useEffect(() => {
    if (!user?.id) return
    const checkMerchant = async () => {
      try {
        const res = await fetch(`/api/p2p/merchant?userId=${user.id}`)
        const data = await res.json()
        if (data.success && data.application?.status === 'approved') {
          setIsMerchant(true)
        }
      } catch {
        /* silent */
      }
    }
    checkMerchant()
  }, [user?.id])

  const handleTakeOrder = async (order: P2POrder) => {
    if (!user?.id) return
    setActionLoading(order.id)
    try {
      const res = await fetch(`/api/p2p/orders/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_order', userId: user.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(
          activeTab === 'buy'
            ? 'تم أخذ طلب الشراء بنجاح! أكمل الدفع لإتمام العملية.'
            : 'تم أخذ طلب البيع بنجاح!'
        )
        setConfirmDialog(null)
        fetchOrders()
      } else {
        toast.error(data.message || 'فشل في أخذ الطلب')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setActionLoading(null)
    }
  }

  // ===================== RENDER =====================

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold gold-text">سوق P2P</h2>
          <p className="text-xs text-muted-foreground">بيع وشراء USDT مباشرة مع التجار الموثقين</p>
        </div>
        <button
          onClick={fetchOrders}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Merchant / Non-Merchant CTA */}
      {isMerchant ? (
        <button className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" />
          إنشاء إعلان جديد
        </button>
      ) : (
        <button
          onClick={() => toast.info('انتقل إلى صفحة التوثيق لتقديم طلب التاجر')}
          className="w-full h-11 bg-gold/10 text-gold font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gold/20 transition-all border border-gold/20"
        >
          <Shield className="w-4 h-4" />
          كن تاجراً
        </button>
      )}

      {/* Tabs: شراء / بيع */}
      <div className="flex gap-2 p-1 glass-card rounded-xl">
        <button
          onClick={() => setActiveTab('buy')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'buy' ? 'gold-gradient text-gray-900' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowDownCircle className="w-4 h-4" />
          شراء USDT
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'sell' ? 'gold-gradient text-gray-900' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowUpCircle className="w-4 h-4" />
          بيع USDT
        </button>
      </div>

      {/* Network Filter */}
      <div className="flex gap-2">
        {['TRC20', 'ERC20', ''].map((net) => (
          <button
            key={net || 'all'}
            onClick={() => setNetworkFilter(net)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              networkFilter === net
                ? net === 'TRC20'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : net === 'ERC20'
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                  : 'bg-gold/10 text-gold border border-gold/20'
                : 'text-muted-foreground bg-white/5 border border-transparent hover:bg-white/10'
            }`}
          >
            {net || 'الكل'}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-44 rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-card p-10 text-center rounded-xl">
          <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد طلبات متاحة حالياً</p>
          <p className="text-xs text-muted-foreground mt-1">حاول تغيير الشبكة أو الفلتر</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <div
              key={order.id}
              className={`glass-card p-4 rounded-xl space-y-3 hover:bg-white/5 transition-colors ${
                i % 2 === 0 ? '' : 'bg-white/[0.02]'
              }`}
            >
              {/* Merchant Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-gray-900 font-bold text-xs">
                    {(order.merchantFullName || order.merchantName || 'ت').charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium">{order.merchantFullName || order.merchantName}</p>
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {timeAgo(order.createdAt)}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                    order.network === 'TRC20'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}
                >
                  {order.network}
                </span>
              </div>

              {/* Amount & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-white/5">
                  <p className="text-[10px] text-muted-foreground">الكمية</p>
                  <p className="text-base font-bold">
                    {order.amount}{' '}
                    <span className="text-xs text-muted-foreground">USDT</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {order.minAmount} - {order.maxAmount}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5">
                  <p className="text-[10px] text-muted-foreground">السعر</p>
                  <p className="text-base font-bold gold-text">
                    {order.price.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">YER / USDT</p>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="flex flex-wrap gap-1">
                {(order.paymentMethods || []).map((m) => (
                  <span
                    key={m}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground"
                  >
                    {PAYMENT_METHOD_LABELS[m] || m}
                  </span>
                ))}
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  if (order.merchantId === user?.id) return
                  setConfirmDialog(order)
                }}
                disabled={order.merchantId === user?.id}
                className={`w-full h-11 rounded-xl font-bold text-sm transition-all ${
                  order.merchantId === user?.id
                    ? 'bg-white/5 text-muted-foreground cursor-not-allowed'
                    : activeTab === 'buy'
                    ? 'gold-gradient text-gray-900 hover:opacity-90'
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20'
                }`}
              >
                {order.merchantId === user?.id
                  ? 'إعلانك'
                  : activeTab === 'buy'
                  ? 'شراء الآن'
                  : 'بيع الآن'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="text-lg font-bold gold-text">
              {activeTab === 'buy' ? 'تأكيد الشراء' : 'تأكيد البيع'}
            </h3>

            <div className="p-3 rounded-lg bg-white/5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الكمية</span>
                <span className="font-bold">{confirmDialog.amount} USDT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">السعر</span>
                <span className="font-bold gold-text">{confirmDialog.price.toLocaleString()} YER</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الإجمالي</span>
                <span className="font-bold text-green-400">
                  {(confirmDialog.amount * confirmDialog.price).toLocaleString()} YER
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الشبكة</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-md ${
                    confirmDialog.network === 'TRC20'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}
                >
                  {confirmDialog.network}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">التاجر</span>
                <span className="font-medium">{confirmDialog.merchantFullName || confirmDialog.merchantName}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleTakeOrder(confirmDialog)}
                disabled={actionLoading === confirmDialog.id}
                className={`flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
                  activeTab === 'buy'
                    ? 'gold-gradient text-gray-900 hover:opacity-90'
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20'
                }`}
              >
                {actionLoading === confirmDialog.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {activeTab === 'buy' ? 'شراء الآن' : 'بيع الآن'}
                  </>
                )}
              </button>
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 h-11 bg-white/10 text-foreground rounded-xl text-sm hover:bg-white/15 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
