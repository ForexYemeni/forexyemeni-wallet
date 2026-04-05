'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  Shield,
  AlertTriangle,
  RefreshCw,
  Store,
  Users,
  Gavel,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Banknote,
  Clock,
  BadgeCheck,
  Ban,
} from 'lucide-react'

// ===================== TYPES =====================

interface MerchantApplication {
  id: string
  userId: string
  userFullName: string
  userEmail: string
  userPhone: string
  idPhotoUrl: string
  selfiePhotoUrl: string
  addressProofUrl: string
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason: string | null
  appliedAt: string
  reviewedAt: string | null
  user: {
    id: string
    email: string
    fullName: string | null
    phone: string | null
    status: string
  } | null
}

interface P2PAdminOrder {
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
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed'
  escrowAmount: number
  createdAt: string
  buyerId?: string | null
  buyerName?: string | null
  merchantFullName?: string
  buyerFullName?: string
  disputes?: Array<{
    id: string
    reason: string
    status: string
  }>
}

// ===================== STATUS MAP =====================

const MERCHANT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'معلق', color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20' },
  approved: { label: 'مقبول', color: 'text-green-400 bg-green-500/10 border border-green-500/20' },
  rejected: { label: 'مرفوض', color: 'text-red-400 bg-red-500/10 border border-red-500/20' },
}

const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'مفتوح', color: 'text-blue-400 bg-blue-500/10 border border-blue-500/20' },
  in_progress: { label: 'جاري', color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20' },
  completed: { label: 'مكتمل', color: 'text-green-400 bg-green-500/10 border border-green-500/20' },
  cancelled: { label: 'ملغي', color: 'text-gray-400 bg-gray-500/10 border border-gray-500/20' },
  disputed: { label: 'نزاع', color: 'text-red-400 bg-red-500/10 border border-red-500/20' },
}

const ORDER_STATUS_FILTERS = [
  { key: '', label: 'الكل' },
  { key: 'open', label: 'مفتوح' },
  { key: 'in_progress', label: 'جاري' },
  { key: 'completed', label: 'مكتمل' },
  { key: 'cancelled', label: 'ملغي' },
  { key: 'disputed', label: 'نزاع' },
]

// ===================== MAIN COMPONENT =====================

export default function AdminP2P() {
  const { user } = useAuthStore()

  const [tab, setTab] = useState<'merchants' | 'orders'>('merchants')

  // Merchant applications state
  const [applications, setApplications] = useState<MerchantApplication[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  // P2P Orders state
  const [orders, setOrders] = useState<P2PAdminOrder[]>([])
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('')
  const [orderSearch, setOrderSearch] = useState<string>('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  // Shared state
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Dialog state
  const [rejectDialog, setRejectDialog] = useState<MerchantApplication | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [resolveDialog, setResolveDialog] = useState<P2PAdminOrder | null>(null)
  const [resolveNote, setResolveNote] = useState('')

  // ===================== FETCH FUNCTIONS =====================

  const fetchMerchantApplications = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/admin/p2p/merchants', {
        headers: { 'x-user-id': user.id },
      })
      const data = await res.json()
      if (data.success) {
        setApplications(data.applications || [])
        setPendingCount(data.pendingCount || 0)
      }
    } catch {
      /* silent */
    }
  }, [user?.id])

  const fetchP2POrders = useCallback(async () => {
    if (!user?.id) return
    try {
      const params = new URLSearchParams()
      if (orderStatusFilter) params.set('status', orderStatusFilter)
      const url = `/api/admin/p2p/orders${params.toString() ? `?${params.toString()}` : ''}`

      const res = await fetch(url, {
        headers: { 'x-user-id': user.id },
      })
      const data = await res.json()
      if (data.success) {
        setOrders(data.orders || [])
      }
    } catch {
      /* silent */
    }
  }, [user?.id, orderStatusFilter])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchMerchantApplications(), fetchP2POrders()])
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loading) {
      fetchP2POrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter])

  // ===================== MERCHANT ACTIONS =====================

  const handleApproveMerchant = async (application: MerchantApplication) => {
    if (!user?.id) return
    setActionLoading(application.id)
    try {
      const res = await fetch('/api/admin/p2p/merchants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          action: 'approve',
          adminId: user.id,
          applicationId: application.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم قبول طلب التاجر بنجاح')
        fetchMerchantApplications()
      } else {
        toast.error(data.message || 'فشل في قبول الطلب')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectMerchant = async () => {
    if (!rejectDialog || !user?.id || !rejectReason.trim()) return
    setActionLoading(rejectDialog.id)
    try {
      const res = await fetch('/api/admin/p2p/merchants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          action: 'reject',
          adminId: user.id,
          applicationId: rejectDialog.id,
          rejectionReason: rejectReason.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم رفض طلب التاجر')
        setRejectDialog(null)
        setRejectReason('')
        fetchMerchantApplications()
      } else {
        toast.error(data.message || 'فشل في رفض الطلب')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setActionLoading(null)
    }
  }

  // ===================== ORDER ACTIONS =====================

  const handleResolveDispute = async (order: P2PAdminOrder, actionType: 'release' | 'refund') => {
    if (!user?.id) return
    setActionLoading(order.id)
    try {
      const res = await fetch('/api/admin/p2p/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          action: 'resolve_dispute',
          adminId: user.id,
          orderId: order.id,
          action_type: actionType,
          resolution: resolveNote.trim() || (actionType === 'release' ? 'تم تحرير الأموال للمشتري' : 'تم استرداد الأموال للمشتري'),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(
          actionType === 'release'
            ? 'تم تحرير الأموال للمشتري بنجاح'
            : 'تم استرداد الأموال بنجاح'
        )
        setResolveDialog(null)
        setResolveNote('')
        fetchP2POrders()
      } else {
        toast.error(data.message || 'فشل في حل النزاع')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setActionLoading(null)
    }
  }

  // ===================== HELPERS =====================

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredOrders = orders.filter((o) => {
    if (!orderSearch.trim()) return true
    const q = orderSearch.toLowerCase()
    return (
      o.id.toLowerCase().includes(q) ||
      (o.merchantFullName || o.merchantName || '').toLowerCase().includes(q) ||
      (o.buyerFullName || o.buyerName || '').toLowerCase().includes(q)
    )
  })

  // ===================== RENDER =====================

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Tabs */}
      <div className="flex gap-2 p-1 glass-card rounded-xl">
        <button
          onClick={() => setTab('merchants')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'merchants' ? 'gold-gradient text-gray-900' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Store className="w-4 h-4" />
          طلبات التجار
          {pendingCount > 0 && (
            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('orders')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'orders' ? 'gold-gradient text-gray-900' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Gavel className="w-4 h-4" />
          الطلبات
        </button>
      </div>

      {/* ==================== LOADING ==================== */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-36 rounded-xl" />
          ))}
        </div>
      ) : tab === 'merchants' ? (
        /* ==================== MERCHANT APPLICATIONS TAB ==================== */
        <div className="space-y-3">
          {applications.length === 0 ? (
            <div className="glass-card p-10 text-center rounded-xl">
              <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد طلبات توثيق</p>
            </div>
          ) : (
            applications.map((app, i) => {
              const statusInfo = MERCHANT_STATUS_MAP[app.status] || MERCHANT_STATUS_MAP.pending

              return (
                <div
                  key={app.id}
                  className={`glass-card p-4 rounded-xl space-y-3 ${
                    i % 2 === 0 ? '' : 'bg-white/[0.02]'
                  } ${app.status === 'pending' ? 'border border-yellow-500/10' : ''}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-gray-900 font-bold text-sm">
                        {(app.userFullName || app.user?.fullName || '?').charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {app.userFullName || app.user?.fullName || 'غير معروف'}
                        </p>
                        <p className="text-[10px] text-muted-foreground" dir="ltr">
                          {app.user?.email || app.userEmail || '—'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-lg font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Meta Info */}
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(app.appliedAt)}
                    </span>
                    {app.user?.phone && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {app.user.phone}
                      </span>
                    )}
                  </div>

                  {/* Photo Thumbnails */}
                  <div className="flex gap-2">
                    {app.idPhotoUrl && (
                      <div
                        onClick={() => setPreviewImage(app.idPhotoUrl)}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:border-gold/30 transition-colors"
                      >
                        <img
                          src={app.idPhotoUrl}
                          alt="الهوية"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {app.selfiePhotoUrl && (
                      <div
                        onClick={() => setPreviewImage(app.selfiePhotoUrl)}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:border-gold/30 transition-colors"
                      >
                        <img
                          src={app.selfiePhotoUrl}
                          alt="سيلفي"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {app.addressProofUrl && (
                      <div
                        onClick={() => setPreviewImage(app.addressProofUrl)}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:border-gold/30 transition-colors"
                      >
                        <img
                          src={app.addressProofUrl}
                          alt="إثبات سكن"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Rejection Reason (if rejected) */}
                  {app.status === 'rejected' && app.rejectionReason && (
                    <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                      <p className="text-[10px] text-red-400 mb-0.5">سبب الرفض:</p>
                      <p className="text-xs text-muted-foreground">{app.rejectionReason}</p>
                    </div>
                  )}

                  {/* Approved indicator */}
                  {app.status === 'approved' && (
                    <div className="flex items-center gap-1.5 text-green-400 text-xs">
                      <CheckCircle className="w-4 h-4" />
                      تم القبول ✓
                    </div>
                  )}

                  {/* Action Buttons (pending only) */}
                  {app.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveMerchant(app)}
                        disabled={actionLoading === app.id}
                        className="flex-1 h-10 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg hover:bg-green-500/30 border border-green-500/20 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {actionLoading === app.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            قبول
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setRejectDialog(app)
                          setRejectReason('')
                        }}
                        disabled={actionLoading === app.id}
                        className="flex-1 h-10 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 border border-red-500/10 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* ==================== P2P ORDERS TAB ==================== */
        <div className="space-y-3">
          {/* Status Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {ORDER_STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setOrderStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                  orderStatusFilter === f.key
                    ? 'bg-gold/10 text-gold border border-gold/20'
                    : 'text-muted-foreground bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                {f.label}
                {f.key !== '' && (
                  <span className="mr-1 text-[10px]">
                    ({orders.filter((o) => o.status === f.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="بحث بالاسم أو رقم الطلب..."
              className="w-full h-10 rounded-xl glass-input px-3 pr-9 text-xs"
              dir="rtl"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="glass-card p-10 text-center rounded-xl">
              <Gavel className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد طلبات</p>
            </div>
          ) : (
            filteredOrders.map((order, i) => {
              const statusInfo = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP.open
              const isExpanded = expandedOrder === order.id

              return (
                <div
                  key={order.id}
                  className={`glass-card rounded-xl overflow-hidden transition-all ${
                    i % 2 === 0 ? '' : 'bg-white/[0.02]'
                  } ${order.status === 'disputed' ? 'border border-red-500/10' : ''}`}
                >
                  {/* Order Row */}
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full p-4 text-right"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${statusInfo.color}`}>
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
                        <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                          #{order.id.substring(0, 8)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-white/5">
                        <p className="text-[10px] text-muted-foreground">المبلغ</p>
                        <p className="text-xs font-bold">{order.amount} USDT</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5">
                        <p className="text-[10px] text-muted-foreground">السعر</p>
                        <p className="text-xs font-bold gold-text">{order.price.toLocaleString()}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5">
                        <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                        <p className="text-xs font-bold">
                          {(order.amount * order.price).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Store className="w-3 h-3" />
                        <span>{order.merchantFullName || order.merchantName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.buyerFullName && (
                          <span>
                            <Users className="w-3 h-3 inline ml-0.5" />
                            {order.buyerFullName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(order.createdAt)}
                        </span>
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
                      {/* Network */}
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

                      {/* Dispute Info */}
                      {order.status === 'disputed' && order.disputes && order.disputes.length > 0 && (
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 space-y-1">
                          <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            تفاصيل النزاع
                          </p>
                          {order.disputes.map((d) => (
                            <p key={d.id} className="text-xs text-muted-foreground">
                              السبب: {d.reason}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Disputed Order Resolution Buttons */}
                      {order.status === 'disputed' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setResolveDialog(order)
                              setResolveNote('')
                            }}
                            className="flex-1 h-10 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg hover:bg-green-500/30 border border-green-500/20 flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            تحرير للمشتري
                          </button>
                          <button
                            onClick={() => {
                              setResolveDialog(order)
                              setResolveNote('')
                            }}
                            className="flex-1 h-10 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-lg hover:bg-orange-500/30 border border-orange-500/20 flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            استرداد
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ==================== REJECT MERCHANT DIALOG ==================== */}
      {rejectDialog && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setRejectDialog(null)}
        >
          <div
            className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="w-5 h-5" />
              <h3 className="text-lg font-bold">رفض طلب التوثيق</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              تريد رفض طلب التوثيق لـ{' '}
              <span className="font-medium text-foreground">
                {rejectDialog.userFullName || rejectDialog.user?.fullName}
              </span>
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl glass-input px-3 py-2 text-sm resize-none"
              placeholder="اكتب سبب الرفض..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleRejectMerchant}
                disabled={actionLoading === rejectDialog.id || !rejectReason.trim()}
                className="flex-1 h-11 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === rejectDialog.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    تأكيد الرفض
                  </>
                )}
              </button>
              <button
                onClick={() => setRejectDialog(null)}
                className="flex-1 h-11 bg-white/10 text-foreground rounded-xl text-sm hover:bg-white/15 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RESOLVE DISPUTE DIALOG ==================== */}
      {resolveDialog && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setResolveDialog(null)}
        >
          <div
            className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="text-lg font-bold gold-text flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              حل النزاع
            </h3>

            {/* Order Info */}
            <div className="p-3 rounded-lg bg-white/5 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الطلب</span>
                <span className="font-mono text-xs" dir="ltr">
                  #{resolveDialog.id.substring(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المبلغ</span>
                <span className="font-bold">{resolveDialog.amount} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الإجمالي</span>
                <span className="font-bold gold-text">
                  {(resolveDialog.amount * resolveDialog.price).toLocaleString()} YER
                </span>
              </div>
            </div>

            {/* Dispute reason if available */}
            {resolveDialog.disputes && resolveDialog.disputes.length > 0 && (
              <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                <p className="text-[10px] text-muted-foreground">سبب النزاع:</p>
                <p className="text-xs text-red-300">
                  {resolveDialog.disputes[0]?.reason || 'غير محدد'}
                </p>
              </div>
            )}

            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl glass-input px-3 py-2 text-sm resize-none"
              placeholder="ملاحظة اختيارية..."
            />

            {/* Resolution Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleResolveDispute(resolveDialog, 'release')}
                disabled={actionLoading === resolveDialog.id}
                className="flex-1 h-11 bg-green-500/20 text-green-400 text-sm font-bold rounded-xl hover:bg-green-500/30 border border-green-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {actionLoading === resolveDialog.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Banknote className="w-4 h-4" />
                    تحرير للمشتري
                  </>
                )}
              </button>
              <button
                onClick={() => handleResolveDispute(resolveDialog, 'refund')}
                disabled={actionLoading === resolveDialog.id}
                className="flex-1 h-11 bg-orange-500/20 text-orange-400 text-sm font-bold rounded-xl hover:bg-orange-500/30 border border-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {actionLoading === resolveDialog.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    استرداد
                  </>
                )}
              </button>
            </div>
            <button
              onClick={() => {
                setResolveDialog(null)
                setResolveNote('')
              }}
              className="w-full h-10 bg-white/10 text-foreground rounded-xl text-sm hover:bg-white/15 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ==================== IMAGE PREVIEW MODAL ==================== */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full animate-scale-in">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 left-0 text-white text-sm hover:text-gold transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              إغلاق
            </button>
            <img
              src={previewImage}
              alt="معاينة"
              className="w-full rounded-xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  )
}
