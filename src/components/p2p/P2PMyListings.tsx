'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Plus, Pause, Play, Trash2, Loader2, RefreshCw, AlertTriangle, RotateCw } from 'lucide-react'
import P2PCreateListing from './P2PCreateListing'

interface Listing {
  id: string
  type: 'sell' | 'buy'
  amount: number
  price: number
  currency: string
  minAmount: number
  maxAmount: number
  paymentMethods: string[]
  network: string
  status: string
  totalTrades: number
  successRate: number
  createdAt: string
}

export default function P2PMyListings() {
  const { user, updateUser } = useAuthStore()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingMerchant, setCheckingMerchant] = useState(true)
  const [isMerchant, setIsMerchant] = useState(false)
  const [merchantCheckFailed, setMerchantCheckFailed] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Use merchantId from store directly
  const effectiveMerchantId = user?.merchantId

  // If user already has merchantId, skip the API check
  useEffect(() => {
    if (!user?.id) return

    // Fast path: user already has merchantId in store from login
    if (user.merchantId) {
      setIsMerchant(true)
      setCheckingMerchant(false)
      return
    }

    // Slow path: check API for merchant status
    const checkMerchant = async () => {
      setCheckingMerchant(true)
      setMerchantCheckFailed(false)
      try {
        const res = await fetch(`/api/p2p/merchant?userId=${user.id}`)
        const data = await res.json()
        if (data.success && data.hasApplication && data.application?.status === 'approved') {
          setIsMerchant(true)
          if (!user?.merchantId) {
            updateUser({ merchantId: data.application.id })
          }
        } else {
          setIsMerchant(false)
        }
      } catch (err) {
        setMerchantCheckFailed(true)
        // Don't set isMerchant to false on API error - let the user retry
      } finally {
        setCheckingMerchant(false)
      }
    }
    checkMerchant()
  }, [user?.id, user?.merchantId])

  const fetchListings = useCallback(async () => {
    if (!effectiveMerchantId) { setLoading(false); return }
    setLoading(true)
    try {
      // Use merchantId query param to get ALL listings (including paused) for this merchant
      const res = await fetch(`/api/p2p/listings?merchantId=${effectiveMerchantId}`)
      const data = await res.json()
      if (data.success) {
        setListings(data.listings || [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [effectiveMerchantId])

  useEffect(() => { fetchListings() }, [fetchListings])

  const handleAction = async (id: string, action: 'pause' | 'activate' | 'delete') => {
    if (action === 'delete') {
      if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return
      setActionLoading(id)
      try {
        const res = await fetch(`/api/p2p/listings/${id}`, { method: 'DELETE', headers: { 'x-user-id': user?.id || '' } })
        const data = await res.json()
        if (data.success) { toast.success('تم حذف الإعلان'); fetchListings() }
        else toast.error(data.message)
      } catch { toast.error('خطأ') }
      finally { setActionLoading(null) }
      return
    }

    setActionLoading(id)
    try {
      const res = await fetch(`/api/p2p/listings/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) { toast.success(action === 'pause' ? 'تم إيقاف الإعلان' : 'تم تفعيل الإعلان'); fetchListings() }
      else toast.error(data.message)
    } catch { toast.error('خطأ') }
    finally { setActionLoading(null) }
  }

  if (checkingMerchant) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    )
  }

  // Merchant check failed - show retry instead of blocking
  if (merchantCheckFailed && !effectiveMerchantId) {
    return (
      <div className="glass-card p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto" />
        <p className="text-sm text-muted-foreground">تعذر التحقق من حالة التاجر</p>
        <button
          onClick={() => {
            setCheckingMerchant(true)
            setMerchantCheckFailed(false)
            // Re-trigger the merchant check by updating user?.id dependency
            window.location.reload()
          }}
          className="inline-flex items-center gap-2 px-4 h-10 gold-gradient text-gray-900 font-bold text-xs rounded-xl hover:opacity-90 transition-all"
        >
          <RotateCw className="w-4 h-4" />
          إعادة المحاولة
        </button>
      </div>
    )
  }

  // Not a merchant and no merchantId
  if (!isMerchant && !effectiveMerchantId) {
    return (
      <div className="glass-card p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">يجب أن تكون تاجر موثق لإنشاء إعلانات</p>
        <p className="text-xs text-muted-foreground mt-2">قم بتقديم طلب التوثيق من تبويب "التوثيق"</p>
      </div>
    )
  }

  if (showCreate) {
    return <P2PCreateListing onCreated={() => { setShowCreate(false); fetchListings() }} onBack={() => setShowCreate(false)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold gold-text">إعلاناتي</h2>
        <div className="flex gap-2">
          <button onClick={fetchListings} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 h-9 gold-gradient text-gray-900 font-bold text-xs rounded-xl hover:opacity-90 transition-all">
            <Plus className="w-4 h-4" />
            إعلان جديد
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="glass-card p-4 shimmer h-28 rounded-xl" />)}</div>
      ) : listings.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm text-muted-foreground">لا توجد إعلانات. قم بإنشاء إعلانك الأول!</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 gold-gradient text-gray-900 font-bold text-xs rounded-xl hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            إنشاء إعلان جديد
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing, i) => (
            <div key={listing.id} className={`glass-card p-4 rounded-xl space-y-3 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md ${listing.type === 'sell' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {listing.type === 'sell' ? 'بيع' : 'شراء'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md ${listing.status === 'active' ? 'status-approved' : listing.status === 'paused' ? 'status-pending' : 'status-rejected'}`}>
                    {listing.status === 'active' ? 'نشط' : listing.status === 'paused' ? 'متوقف' : listing.status}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5">{listing.network}</span>
                </div>
                <div className="flex gap-1">
                  {listing.status === 'active' ? (
                    <button onClick={() => handleAction(listing.id, 'pause')} disabled={actionLoading === listing.id} className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center hover:bg-yellow-500/20 transition-colors">
                      {actionLoading === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5 text-yellow-400" />}
                    </button>
                  ) : (
                    <button onClick={() => handleAction(listing.id, 'activate')} disabled={actionLoading === listing.id} className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center hover:bg-green-500/20 transition-colors">
                      {actionLoading === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-green-400" />}
                    </button>
                  )}
                  <button onClick={() => handleAction(listing.id, 'delete')} disabled={actionLoading === listing.id} className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors">
                    {actionLoading === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <p className="text-[10px] text-muted-foreground">الكمية</p>
                  <p className="text-sm font-bold">{listing.amount} USDT</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <p className="text-[10px] text-muted-foreground">السعر</p>
                  <p className="text-sm font-bold gold-text">{listing.price.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <p className="text-[10px] text-muted-foreground">الصفقات</p>
                  <p className="text-sm font-bold">{listing.totalTrades}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
