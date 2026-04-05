'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, Trash2, Edit, Bot, MessageSquare, Check, X, Search, Save } from 'lucide-react'

interface FaqItem {
  id: string
  question: string
  keywords: string[]
  answer: string
  category: string
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: 'general', label: 'عام' },
  { value: 'deposit', label: 'إيداع' },
  { value: 'withdrawal', label: 'سحب' },
  { value: 'kyc', label: 'توثيق' },
  { value: 'account', label: 'حساب' },
  { value: 'fees', label: 'رسوم' },
]

const EMPTY_FORM = {
  question: '',
  keywords: '',
  answer: '',
  category: 'general',
  priority: 0,
  isActive: true,
}

export default function AdminFaqManager() {
  const { user } = useAuthStore()
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  // Bot settings
  const [botEnabled, setBotEnabled] = useState(true)
  const [greeting, setGreeting] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)

  // Fetch all FAQ items (including inactive)
  const fetchItems = async () => {
    try {
      // We need all items (not just active), so use the search with empty query
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: '' }),
      })
      const data = await res.json()
      if (data.success) {
        setItems(data.results || [])
      }
    } catch { /* silent */ }
  }

  // Fetch all items for admin (including inactive) - we use a different approach
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      // Fetch bot settings
      try {
        const settingsRes = await fetch('/api/faq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_bot_settings' }),
        })
        const settingsData = await settingsRes.json()
        if (settingsData.success) {
          setBotEnabled(settingsData.settings.isEnabled)
          setGreeting(settingsData.settings.greeting)
        }
      } catch { /* silent */ }

      // Fetch active items first
      try {
        const res = await fetch('/api/faq')
        const data = await res.json()
        if (data.success) {
          setItems(data.items || [])
        }
      } catch { /* silent */ }

      setLoading(false)
    }
    if (user?.id) init()
  }, [user?.id])

  const handleSaveBotSettings = async () => {
    if (!user?.id) return
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_bot_settings',
          userId: user.id,
          isEnabled: botEnabled,
          greeting,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم تحديث إعدادات البوت')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSettingsLoading(false)
    }
  }

  const openCreateForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const openEditForm = (item: FaqItem) => {
    setForm({
      question: item.question,
      keywords: (item.keywords || []).join('، '),
      answer: item.answer,
      category: item.category,
      priority: item.priority,
      isActive: item.isActive,
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  const handleSaveFaq = async () => {
    if (!user?.id) return
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('السؤال والإجابة مطلوبان')
      return
    }

    setActionLoading(editingId || 'create')
    const keywords = form.keywords
      .split(/[,،\s]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0)

    try {
      const body: Record<string, unknown> = {
        action: editingId ? 'update' : 'create',
        userId: user.id,
        question: form.question.trim(),
        keywords,
        answer: form.answer.trim(),
        category: form.category,
        priority: form.priority,
      }
      if (editingId) body.faqId = editingId

      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(editingId ? 'تم تحديث السؤال' : 'تم إضافة السؤال')
        setShowForm(false)
        setEditingId(null)
        // Refresh - we need to get all items
        const refreshRes = await fetch('/api/faq')
        const refreshData = await refreshRes.json()
        if (refreshData.success) setItems(refreshData.items || [])
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user?.id) return
    if (!confirm('هل أنت متأكد من حذف هذا السؤال؟')) return

    setActionLoading(id)
    try {
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId: user.id, faqId: id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حذف السؤال')
        setItems(prev => prev.filter(i => i.id !== id))
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = async (item: FaqItem) => {
    if (!user?.id) return
    setActionLoading(`toggle-${item.id}`)
    try {
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          userId: user.id,
          faqId: item.id,
          isActive: !item.isActive,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: !i.isActive } : i))
        toast.success(item.isActive ? 'تم تعطيل السؤال' : 'تم تفعيل السؤال')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  // Filter items
  const filteredItems = items.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        (item.keywords || []).some(k => k.toLowerCase().includes(q))
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              إدارة الأسئلة الشائعة
            </h2>
            <p className="text-xs text-muted-foreground">{items.length} سؤال</p>
          </div>
        </div>
        <button
          onClick={openCreateForm}
          className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة سؤال
        </button>
      </div>

      {/* Bot Settings Card */}
      <div className="glass-card p-4 rounded-xl space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          إعدادات البوت
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">تفعيل البوت</p>
            <p className="text-xs text-muted-foreground">إظهار مساعد الدعم للمستخدمين</p>
          </div>
          <Switch
            checked={botEnabled}
            onCheckedChange={setBotEnabled}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">رسالة الترحيب</Label>
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="مرحباً! كيف يمكنني مساعدتك اليوم؟"
            className="min-h-[60px] text-sm glass-input"
            dir="rtl"
          />
        </div>
        <button
          onClick={handleSaveBotSettings}
          disabled={settingsLoading}
          className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {settingsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الإعدادات
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث..."
            className="w-full h-10 pr-9 pl-3 rounded-xl glass-input text-sm"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-10 px-3 rounded-xl glass-input text-sm min-w-[100px]"
        >
          <option value="all">الكل</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="glass-card p-4 rounded-xl space-y-4 animate-scale-in border-emerald-500/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              {editingId ? 'تعديل السؤال' : 'إضافة سؤال جديد'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">السؤال *</Label>
              <Input
                value={form.question}
                onChange={(e) => setForm(prev => ({ ...prev, question: e.target.value }))}
                placeholder="اكتب السؤال هنا..."
                className="glass-input text-sm"
                dir="rtl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">الكلمات المفتاحية (مفصولة بفواصل)</Label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm(prev => ({ ...prev, keywords: e.target.value }))}
                placeholder="مثال: إيداع، تحويل، USDT"
                className="glass-input text-sm"
                dir="rtl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">الإجابة *</Label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm(prev => ({ ...prev, answer: e.target.value }))}
                placeholder="اكتب الإجابة هنا..."
                className="min-h-[80px] text-sm glass-input"
                dir="rtl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">التصنيف</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl glass-input text-sm"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الأولوية (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={form.priority}
                  onChange={(e) => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                  className="glass-input text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveFaq}
                disabled={actionLoading === (editingId || 'create')}
                className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading === (editingId || 'create') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingId ? 'تحديث' : 'إضافة'}
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="h-10 px-4 bg-white/5 hover:bg-white/10 text-muted-foreground rounded-xl text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Items List */}
      {filteredItems.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد أسئلة</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className={`glass-card p-4 rounded-xl transition-colors ${
                !item.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                      item.isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {item.isActive ? 'مفعّل' : 'معطّل'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground">
                      {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">أولوية: {item.priority}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{item.question}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.answer}</p>
                  {(item.keywords && item.keywords.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.keywords.slice(0, 5).map((kw, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/5 text-emerald-400/70">
                          {kw}
                        </span>
                      ))}
                      {item.keywords.length > 5 && (
                        <span className="text-[10px] text-muted-foreground">+{item.keywords.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEditForm(item)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    title="تعديل"
                  >
                    <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(item)}
                    disabled={actionLoading === `toggle-${item.id}`}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    title={item.isActive ? 'تعطيل' : 'تفعيل'}
                  >
                    {actionLoading === `toggle-${item.id}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={actionLoading === item.id}
                    className="w-8 h-8 rounded-lg bg-red-500/5 hover:bg-red-500/15 flex items-center justify-center transition-colors"
                    title="حذف"
                  >
                    {actionLoading === item.id ? (
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
