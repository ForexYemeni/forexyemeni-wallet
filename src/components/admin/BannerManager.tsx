'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Trash2, ImageOff, ChevronUp, ChevronDown, Eye, EyeOff, X, Save, Image as ImageIcon } from 'lucide-react'

interface Banner {
  id: string
  title: string
  description: string
  imageUrl: string
  link: string
  active: boolean
  order: number
  createdAt: string
}

const EMPTY_FORM = {
  title: '',
  description: '',
  imageUrl: '',
  link: '',
  active: true,
}

export default function BannerManager() {
  const { user } = useAuthStore()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const fetchBanners = async () => {
    try {
      const res = await fetch('/api/admin/banners')
      const data = await res.json()
      if (data.success) {
        setBanners(data.banners || [])
      }
    } catch { /* silent */ }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchBanners()
    }
  }, [user?.id])

  const openCreateForm = () => {
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const handleCreateBanner = async () => {
    if (!user?.id) return
    if (!form.title.trim() || !form.imageUrl.trim()) {
      toast.error('العنوان ورابط الصورة مطلوبان')
      return
    }

    setActionLoading('create')
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: form.title.trim(),
          description: form.description.trim(),
          imageUrl: form.imageUrl.trim(),
          link: form.link.trim(),
          active: form.active,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء البانر بنجاح')
        setShowForm(false)
        setForm(EMPTY_FORM)
        fetchBanners()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteBanner = async (bannerId: string) => {
    if (!user?.id) return
    if (!confirm('هل أنت متأكد من حذف هذا البانر؟')) return

    setActionLoading(bannerId)
    try {
      const res = await fetch(`/api/admin/banners?id=${bannerId}&userId=${user.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حذف البانر')
        setBanners(prev => prev.filter(b => b.id !== bannerId))
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = async (banner: Banner) => {
    if (!user?.id) return
    setActionLoading(`toggle-${banner.id}`)

    try {
      // Use POST to update - we need to create a simple update approach
      // Since we only have GET/POST/DELETE, we'll delete and re-create with new active status
      // Actually, let's use the Firestore directly via a POST update
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: banner.title,
          description: banner.description,
          imageUrl: banner.imageUrl,
          link: banner.link,
          active: !banner.active,
          existingBannerId: banner.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, active: !b.active } : b))
        toast.success(banner.active ? 'تم تعطيل البانر' : 'تم تفعيل البانر')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReorder = async (banner: Banner, direction: 'up' | 'down') => {
    if (!user?.id) return
    const sorted = [...banners].sort((a, b) => a.order - b.order)
    const currentIndex = sorted.findIndex(b => b.id === banner.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= sorted.length) return

    const target = sorted[targetIndex]

    // Swap orders via POST (re-create both with swapped order)
    setActionLoading(`reorder-${banner.id}`)
    try {
      // Update by swapping orders - delete both and recreate
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: banner.title,
          description: banner.description,
          imageUrl: banner.imageUrl,
          link: banner.link,
          active: banner.active,
          existingBannerId: banner.id,
          swapOrder: target.order,
        }),
      })
      const data = await res.json()
      if (data.success) {
        // Optimistically update the UI
        setBanners(prev => prev.map(b => {
          if (b.id === banner.id) return { ...b, order: target.order }
          if (b.id === target.id) return { ...b, order: banner.order }
          return b
        }))
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-4 shimmer h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  const sortedBanners = [...banners].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              إدارة البانرات
            </h2>
            <p className="text-xs text-muted-foreground">{banners.length} بانر</p>
          </div>
        </div>
        <button
          onClick={openCreateForm}
          className="h-9 px-4 bg-gold hover:bg-gold-light text-gray-900 font-medium rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة بانر
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass-card p-4 rounded-xl space-y-4 animate-scale-in border-gold/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">إضافة بانر جديد</h3>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">العنوان *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="عنوان البانر..."
                className="glass-input text-sm"
                dir="rtl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">الوصف</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="وصف مختصر للبانر..."
                className="min-h-[60px] text-sm glass-input"
                dir="rtl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">رابط الصورة *</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://example.com/banner.jpg"
                className="glass-input text-sm"
                dir="ltr"
              />
            </div>

            {/* Image Preview */}
            {form.imageUrl && (
              <div className="relative rounded-xl overflow-hidden h-32 bg-white/5">
                <img
                  src={form.imageUrl}
                  alt="معاينة"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">الرابط (اختياري)</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm(prev => ({ ...prev, link: e.target.value }))}
                placeholder="https://example.com/page"
                className="glass-input text-sm"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateBanner}
                disabled={actionLoading === 'create'}
                className="flex-1 h-10 bg-gold hover:bg-gold-light text-gray-900 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading === 'create' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    إضافة
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                className="h-10 px-4 bg-white/5 hover:bg-white/10 text-muted-foreground rounded-xl text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banners List */}
      {sortedBanners.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <ImageIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد بانرات</p>
          <p className="text-xs text-muted-foreground mt-1">أضف بانر جديد لعرضه في الصفحة الرئيسية</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {sortedBanners.map((banner, index) => (
            <div
              key={banner.id}
              className={`glass-card p-4 rounded-xl transition-colors ${
                !banner.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex gap-3">
                {/* Image Preview */}
                <div className="w-24 h-16 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <ImageOff className="w-5 h-5 text-muted-foreground/30 absolute" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                      banner.active
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {banner.active ? 'مفعّل' : 'معطّل'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground">
                      ترتيب: {index + 1}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{banner.title}</p>
                  {banner.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{banner.description}</p>
                  )}
                  {banner.link && (
                    <p className="text-[10px] text-gold mt-0.5 truncate" dir="ltr">{banner.link}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {/* Reorder Up */}
                  <button
                    onClick={() => handleReorder(banner, 'up')}
                    disabled={index === 0 || actionLoading === `reorder-${banner.id}`}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-30"
                    title="تحريك للأعلى"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {/* Reorder Down */}
                  <button
                    onClick={() => handleReorder(banner, 'down')}
                    disabled={index === sortedBanners.length - 1 || actionLoading === `reorder-${banner.id}`}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-30"
                    title="تحريك للأسفل"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {/* Toggle Active */}
                  <button
                    onClick={() => handleToggleActive(banner)}
                    disabled={actionLoading === `toggle-${banner.id}`}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    title={banner.active ? 'تعطيل' : 'تفعيل'}
                  >
                    {actionLoading === `toggle-${banner.id}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    ) : banner.active ? (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-green-400" />
                    )}
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteBanner(banner.id)}
                    disabled={actionLoading === banner.id}
                    className="w-8 h-8 rounded-lg bg-red-500/5 hover:bg-red-500/15 flex items-center justify-center transition-colors"
                    title="حذف"
                  >
                    {actionLoading === banner.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
