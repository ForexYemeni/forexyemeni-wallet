'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Loader2,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Banknote,
  HandCoins,
  MessageSquareWarning,
  ChevronDown,
  ChevronUp,
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
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed'
  escrowAmount: number
  p2pFee: number
  totalAmount: number
  expiresAt: string
  createdAt: string
  buyerId?: string | null
  buyerName?: string | null
  buyerEmail?: string | null
  buyerPaidAt?: string | null
  buyerConfirmedAt?: string | null
  sellerReleasedAt?: string | null
  merchantFullName?: string
  buyerFullName?: string
}

// ===================== STATUS MAP =====================

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  open: { label: 'مفتوح', color: 'text-blue-400 bg-blue-500/10', icon: Clock },
  in_progress: { label: 'جاري التنفيذ', color: 'text-yellow-400 bg-yellow-500/10', icon: Loader2 },
  completed: { label: 'مكتمل', color: 'text-green-400 bg-green-500/10', icon: CheckCircle },
  cancelled: { label: 'ملغي', color: 'text-gray-400 bg-gray-500/10', icon: XCircle },
  disputed: { label: 'نزاع', color: 'text-red-400 bg-red-500/10', icon: AlertTriangle },
}

// ===================== COMPONENT =====================

export default function P2PMyOrders() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<P2POrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [disputeDialog, setDisputeDialog] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/p2p/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'my_orders', userId: user.id }),
      })
      const data = await res.json()
      if (data.success) {
        setOrders(data.orders || [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Filter orders by tab role
  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'buyer') {
      return order.buyerId === user?.id
    }
    return order.merchantId === user?.id
  })

  const handleAction = async (orderId: string, action: string) => {
    if (!user?.id) return
    setActionLoading(orderId)
    try {
      const body: Record<string, unknown> = { action, userId: user.id }
      if (action === 'dispute') {
        body.disputeReason = disputeReason.trim()
      }

      const res = await fetch(`/api/p2p/orders/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        const messages: Record<string, string> = {
          confirm_payment: 'تم تأكيد الدفع بنجاح. بانتظار التاجر.',
          release_funds: 'تم تحرير الأموال بنجاح.',
          dispute: 'تم فتح النزاع بنجاح. سيتم مراجعته من قبل الإدارة.',
          cancel_order: 'تم إلغاء الطلب بنجاح.',
        }
        toast.success(messages[action] || 'تم تنفيذ الإجراء بنجاح')
        setDisputeDialog(null)
        setDisputeReason('')
        fetchOrders()
      } else {
        toast.error(data.message || 'فشل في تنفيذ الإجراء')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setActionLoading(null)
    }
  }

  const getActionButtons = (order: P2POrder) => {
    const isBuyer = order.buyerId === user?.id
    const isMerchant = order.merchantId === user?.id
    const btns: { label: string; action: string; variant: 'green' | 'gold' | 'red' | 'disabled' }[] = []

    if (order.status === 'in_progress') {
      if (isBuyer) {
        btns.push({ label: 'تأكيد الدفع', action: 'confirm_payment', variant: 'green' })
        btns.push({ label: 'نزاع', action: 'dispute', variant: 'red' })
      }
      if (isMerchant) {
        btns.push({ label: 'تحرير الأموال', action: 'release_funds', variant: 'gold' })
        btns.push({ label: 'نزاع', action: 'dispute', variant: 'red' })
      }
    }

    if (order.status === 'open' && isMerchant) {
      btns.push({ label: 'إلغاء', action: 'cancel_order', variant: 'red' })
    }

    if (order.status === 'disputed') {
      btns.push({ label: 'قيد النزاع', action: '', variant: 'disabled' })
    }

    if (order.status === 'completed') {
      btns.push({ label: 'مكتمل ✓', action: '', variant: 'disabled' })
    }

    if (order.status === 'cancelled') {
      btns.push({ label: 'ملغي', action: '', variant: 'disabled' })
    }

    return btns
  }

  const getButtonClasses = (variant: 'green' | 'gold' | 'red' | 'disabled') => {
    switch (variant) {
      case 'green':
        return 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20'
      case 'gold':
        return 'gold-gradient text-gray-900 hover:opacity-90'
      case 'red':
        return 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10'
      case 'disabled':
        return 'bg-white/5 text-muted-foreground cursor-not-allowed'
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold gold-text">طلباتي P2P</h2>
          <p className="text-xs text-muted-foreground">متابعة جميع طلباتك</p>
        </div>
        <button
          onClick={fetchOrders}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs: كمشتري / كمبيع */}
      <div className="flex gap-2 p-1 glass-card rounded-xl">
        <button
          onClick={() => setActiveTab('buyer')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'buyer' ? 'gold-gradient text-gray-900' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          كمشتري
        </button>
        <button
          onClick={() => setActiveTab('seller')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'seller' ? 'gold-gradient text-gray-900' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Banknote className="w-4 h-4" />
          كمبيع
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card p-10 text-center rounded-xl">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد طلبات</p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeTab === 'buyer' ? 'لم تقم بشراء أي طلبات بعد' : 'لم تقم ببيع أي طلبات بعد'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order, i) => {
            const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.open
            const StatusIcon = statusInfo.icon
            const isBuyer = order.buyerId === user?.id
            const isExpanded = expandedOrder === order.id
            const actionButtons = getActionButtons(order)

            return (
              <div
                key={order.id}
                className={`glass-card rounded-xl overflow-hidden transition-all ${
                  i % 2 === 0 ? '' : 'bg-white/[0.02]'
                } ${order.status === 'disputed' ? 'border border-red-500/10' : ''}`}
              >
                {/* Order Header - Always visible */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full p-4 text-right"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md ${
                          order.type === 'sell'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {order.type === 'sell' ? 'بيع' : 'شراء'}
                      </span>
                      <span className="text-[10px] text-muted-foreground" dir="ltr">
                        #{order.id.substring(0, 8)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-[10px] text-muted-foreground">المبلغ</p>
                      <p className="text-sm font-bold">{order.amount} USDT</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-[10px] text-muted-foreground">السعر</p>
                      <p className="text-sm font-bold gold-text">{order.price.toLocaleString()} YER</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {activeTab === 'buyer'
                        ? `البائع: ${order.merchantFullName || order.merchantName}`
                        : `المشتري: ${order.buyerFullName || order.buyerName || '—'}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(order.createdAt)}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <div className="flex items-center justify-center mt-2 text-muted-foreground/40">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3 animate-fade-in">
                    {/* Network & Payment */}
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md ${
                          order.network === 'TRC20'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {order.network}
                      </span>
                      {(order.paymentMethods || []).map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground"
                        >
                          {m === 'bank_transfer'
                            ? 'تحويل بنكي'
                            : m === 'bank_deposit'
                            ? 'إيداع بنكي'
                            : m === 'atm_transfer'
                            ? 'صراف آلي'
                            : m}
                        </span>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">الإجمالي</span>
                      <span className="text-base font-bold gold-text">
                        {(order.amount * order.price).toLocaleString()} YER
                      </span>
                    </div>

                    {/* Timeline (for in_progress orders) */}
                    {order.status === 'in_progress' && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">مراحل الطلب:</p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-[10px] text-muted-foreground">تم الإنشاء</span>
                          </div>
                          <div className="w-4 h-px bg-white/10" />
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                order.buyerPaidAt ? 'bg-green-400' : 'bg-white/20'
                              }`}
                            />
                            <span className="text-[10px] text-muted-foreground">الدفع</span>
                          </div>
                          <div className="w-4 h-px bg-white/10" />
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                order.sellerReleasedAt ? 'bg-green-400' : 'bg-white/20'
                              }`}
                            />
                            <span className="text-[10px] text-muted-foreground">التحرير</span>
                          </div>
                          <div className="w-4 h-px bg-white/10" />
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                order.status === 'completed' ? 'bg-green-400' : 'bg-white/20'
                              }`}
                            />
                            <span className="text-[10px] text-muted-foreground">اكتمل</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {actionButtons.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {actionButtons.map((btn, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              if (btn.variant === 'disabled') return
                              if (btn.action === 'dispute') {
                                setDisputeDialog(order.id)
                                return
                              }
                              handleAction(order.id, btn.action)
                            }}
                            disabled={
                              btn.variant === 'disabled' || actionLoading === order.id
                            }
                            className={`flex-1 min-w-[120px] h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${getButtonClasses(btn.variant)}`}
                          >
                            {actionLoading === order.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                {btn.variant === 'green' && <CheckCircle className="w-3.5 h-3.5" />}
                                {btn.variant === 'gold' && <Banknote className="w-3.5 h-3.5" />}
                                {btn.variant === 'red' && <AlertTriangle className="w-3.5 h-3.5" />}
                                {btn.variant === 'disabled' && <Clock className="w-3.5 h-3.5" />}
                                {btn.label}
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dispute Dialog */}
      {disputeDialog && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setDisputeDialog(null)
            setDisputeReason('')
          }}
        >
          <div
            className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center gap-2 text-red-400">
              <MessageSquareWarning className="w-5 h-5" />
              <h3 className="text-lg font-bold text-red-400">فتح نزاع</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              يرجى شرح سبب النزاع بدقة. سيتم مراجعة الطلب من قبل الإدارة.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={4}
              className="w-full rounded-xl glass-input px-3 py-2 text-sm resize-none"
              placeholder="اكتب سبب النزاع هنا..."
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(disputeDialog, 'dispute')}
                disabled={actionLoading === disputeDialog || !disputeReason.trim()}
                className="flex-1 h-11 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === disputeDialog ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    فتح النزاع
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setDisputeDialog(null)
                  setDisputeReason('')
                }}
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
