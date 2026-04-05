'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Tag,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Gift,
  Users,
  DollarSign,
  Clock,
  X,
} from 'lucide-react'

interface Promo {
  id: string
  code: string
  type: string
  value: number
  maxUses: number | null
  usedCount: number
  totalRewarded: number
  expiresAt: string | null
  description: string
  isActive: boolean
  createdAt: string
}

export default function PromoManager() {
  const { user } = useAuthStore()
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [code, setCode] = useState('')
  const [type, setType] = useState<'fixed' | 'percentage'>('fixed')
  const [value, setValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [description, setDescription] = useState('')

  const fetchPromos = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_all', adminId: user.id }),
      })
      const data = await res.json()
      if (data.success) setPromos(data.promos || [])
    } catch {
      toast.error('خطأ في تحميل الأكواد')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchPromos() }, [fetchPromos])

  const handleCreate = async () => {
    if (!code.trim() || !value) {
      toast.error('الكود والقيمة مطلوبان')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          adminId: user?.id,
          code: code.trim(),
          type,
          value: parseFloat(value),
          maxUses: maxUses || null,
          expiresAt: expiresAt || null,
          description: description.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء الكود الترويجي')
        setShowForm(false)
        setCode('')
        setValue('')
        setMaxUses('')
        setExpiresAt('')
        setDescription('')
        fetchPromos()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في إنشاء الكود')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (promoId: string, promoCode: string) => {
    if (!confirm(`هل أنت متأكد من حذف الكود ${promoCode}؟`)) return
    setDeleting(promoId)
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', adminId: user?.id, promoId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حذف الكود')
        fetchPromos()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في حذف الكود')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'بدون انتهاء'
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <Tag className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold">الأكواد الترويجية</h2>
            <p className="text-xs text-muted-foreground">{promos.length} كود ترويجي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchPromos} disabled={loading} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg gold-gradient text-gray-900 text-xs font-bold hover:opacity-90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            كود جديد
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass-card p-5 rounded-xl space-y-4 border border-gold/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold gold-text flex items-center gap-2">
              <Plus className="w-4 h-4" />
              إنشاء كود ترويجي
            </h3>
            <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">الكود</label>
              <input
                type="text"
                placeholder="WELCOME50"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full h-10 rounded-lg glass-input px-3 text-sm font-mono"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">النوع</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'fixed' | 'percentage')}
                className="w-full h-10 rounded-lg glass-input px-3 text-sm"
              >
                <option value="fixed">مبلغ ثابت (USDT)</option>
                <option value="percentage">نسبة مئوية (%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                {type === 'fixed' ? 'المبلغ (USDT)' : 'النسبة (%)'}
              </label>
              <input
                type="number"
                placeholder={type === 'fixed' ? '50' : '10'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full h-10 rounded-lg glass-input px-3 text-sm"
                dir="ltr"
                min="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">الحد الأقصى للاستخدام</label>
              <input
                type="number"
                placeholder="مثلاً 100"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="w-full h-10 rounded-lg glass-input px-3 text-sm"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">تاريخ الانتهاء (اختياري)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full h-10 rounded-lg glass-input px-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">الوصف (اختياري)</label>
            <input
              type="text"
              placeholder="مكافأة ترحيبية"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-10 rounded-lg glass-input px-3 text-sm"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={submitting || !code.trim() || !value}
            className="w-full h-10 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إنشاء الكود
          </button>
        </div>
      )}

      {/* Promo List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-20 rounded-xl" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">لا توجد أكواد ترويجية</p>
        </div>
      ) : (
        <div className="space-y-2">
          {promos.map((promo) => {
            const expired = isExpired(promo.expiresAt)
            return (
              <div key={promo.id} className={`glass-card p-4 rounded-xl space-y-3 ${expired ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${promo.type === 'fixed' ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                      <Gift className={`w-5 h-5 ${promo.type === 'fixed' ? 'text-green-400' : 'text-blue-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold font-mono gold-text" dir="ltr">{promo.code}</p>
                      <p className="text-xs text-muted-foreground">{promo.description || 'بدون وصف'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(promo.id, promo.code)}
                    disabled={deleting === promo.id}
                    className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors text-red-400"
                  >
                    {deleting === promo.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs">
                  <span className={`px-2 py-1 rounded-md ${promo.type === 'fixed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {promo.type === 'fixed' ? `${promo.value} USDT` : `${promo.value}%`}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {promo.usedCount}{promo.maxUses ? ` / ${promo.maxUses}` : ''}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="w-3 h-3" />
                    {promo.totalRewarded?.toFixed(2) || '0'} USDT
                  </span>
                  <span className={`flex items-center gap-1 ${expired ? 'text-red-400' : 'text-muted-foreground'}`}>
                    <Clock className="w-3 h-3" />
                    {formatDate(promo.expiresAt)}
                  </span>
                  {expired && <span className="text-red-400 text-[10px]">منتهي</span>}
                  {!promo.isActive && <span className="text-yellow-400 text-[10px]">معطّل</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
