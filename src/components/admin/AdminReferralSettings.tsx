'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Users,
  Gift,
  DollarSign,
  Loader2,
  Save,
  TrendingUp,
  Power,
  PowerOff,
  Settings,
  Percent,
  Hash,
  Layers,
} from 'lucide-react'

interface ReferralSettings {
  isEnabled: boolean
  commissionType: string
  commissionLevels: number[]
  minDepositForCommission: number
  maxLevels: number
}

interface AdminReferralStats {
  totalReferrals: number
  totalCommissionsPaid: number
  totalCommissionAmount: number
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'المستوى 1 (دعوات مباشرة)',
  2: 'المستوى 2',
  3: 'المستوى 3',
  4: 'المستوى 4',
  5: 'المستوى 5',
}

export default function AdminReferralSettings() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<ReferralSettings>({
    isEnabled: false,
    commissionType: 'percentage',
    commissionLevels: [3, 1, 0.5],
    minDepositForCommission: 10,
    maxLevels: 3,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<AdminReferralStats | null>(null)

  useEffect(() => {
    fetchSettings()
    fetchStats()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/referral?action=get_settings')
      const data = await res.json()
      if (data.success) {
        setSettings(prev => ({
          ...prev,
          isEnabled: data.settings.isEnabled,
          commissionType: data.settings.commissionType,
          commissionLevels: data.settings.commissionLevels,
          maxLevels: data.settings.maxLevels,
        }))
      }
    } catch {
      toast.error('خطأ في تحميل الإعدادات')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/referral?action=get_settings')
      // Fetch admin stats via a separate call
      const statsRes = await fetch(`/api/referral?action=admin_stats`)
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        if (statsData.success) setStats(statsData.stats)
      }
    } catch {
      // silent
    }
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          adminId: user.id,
          settings: {
            isEnabled: settings.isEnabled,
            commissionType: settings.commissionType,
            commissionLevels: settings.commissionLevels,
            minDepositForCommission: settings.minDepositForCommission,
            maxLevels: settings.maxLevels,
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حفظ الإعدادات بنجاح')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const updateLevel = (index: number, value: number) => {
    const newLevels = [...settings.commissionLevels]
    while (newLevels.length <= index) newLevels.push(0)
    newLevels[index] = value
    setSettings(prev => ({ ...prev, commissionLevels: newLevels }))
  }

  const handleMaxLevelsChange = (newMax: number) => {
    setSettings(prev => ({
      ...prev,
      maxLevels: newMax,
      commissionLevels: prev.commissionLevels.slice(0, newMax),
    }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-6 shimmer h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center gold-glow">
            <Gift className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold gold-text">إعدادات برنامج الدعوات</h2>
            <p className="text-xs text-muted-foreground">إدارة نظام العمولات والدعوات</p>
          </div>
        </div>
      </div>

      {/* Toggle On/Off */}
      <div className="glass-card p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.isEnabled ? (
              <Power className="w-5 h-5 text-green-400" />
            ) : (
              <PowerOff className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">حالة البرنامج</p>
              <p className="text-xs text-muted-foreground">
                {settings.isEnabled ? 'البرنامج مفعل ونشط' : 'البرنامج متوقف'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSettings(prev => ({ ...prev, isEnabled: !prev.isEnabled }))}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.isEnabled ? 'bg-green-500' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                settings.isEnabled ? 'left-1' : 'left-8'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Commission Type */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold gold-text flex items-center gap-2">
          <Settings className="w-4 h-4" />
          نوع العمولة
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSettings(prev => ({ ...prev, commissionType: 'percentage' }))}
            className={`p-3 rounded-xl border text-sm font-medium transition-all ${
              settings.commissionType === 'percentage'
                ? 'border-gold/30 bg-gold/10 text-gold'
                : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            <Percent className="w-5 h-5 mx-auto mb-1" />
            نسبة مئوية
          </button>
          <button
            onClick={() => setSettings(prev => ({ ...prev, commissionType: 'fixed' }))}
            className={`p-3 rounded-xl border text-sm font-medium transition-all ${
              settings.commissionType === 'fixed'
                ? 'border-gold/30 bg-gold/10 text-gold'
                : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            <Hash className="w-5 h-5 mx-auto mb-1" />
            مبلغ ثابت
          </button>
        </div>
      </div>

      {/* Commission Levels */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold gold-text flex items-center gap-2">
          <Layers className="w-4 h-4" />
          مستويات العمولة
        </h3>

        {/* Max Levels */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">عدد المستويات</span>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => handleMaxLevelsChange(n)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  settings.maxLevels >= n
                    ? 'bg-gold/10 text-gold border border-gold/20'
                    : 'bg-white/5 text-muted-foreground border border-white/5'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Level inputs */}
        <div className="space-y-2">
          {Array.from({ length: settings.maxLevels }, (_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <span className="text-xs text-muted-foreground">
                {LEVEL_LABELS[i + 1] || `المستوى ${i + 1}`}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={settings.commissionLevels[i] ?? 0}
                  onChange={(e) => updateLevel(i, parseFloat(e.target.value) || 0)}
                  className="w-20 h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-center text-foreground focus:outline-none focus:border-gold/30"
                  dir="ltr"
                />
                <span className="text-[10px] text-muted-foreground w-8">
                  {settings.commissionType === 'percentage' ? '%' : '$'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Min Deposit */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold gold-text flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          الحد الأدنى للإيداع
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">الحد الأدنى لتطبيق العمولة</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              min="0"
              value={settings.minDepositForCommission}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                minDepositForCommission: parseFloat(e.target.value) || 0,
              }))}
              className="w-24 h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-center text-foreground focus:outline-none focus:border-gold/30"
              dir="ltr"
            />
            <span className="text-xs text-muted-foreground">USDT</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          إحصائيات عامة
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-white/5 text-center">
            <Users className="w-5 h-5 text-gold mx-auto mb-1" />
            <p className="text-lg font-bold">{stats?.totalReferrals || 0}</p>
            <p className="text-[10px] text-muted-foreground">إجمالي الدعوات</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 text-center">
            <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-400">{(stats?.totalCommissionAmount || 0).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">USDT إجمالي العمولات</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            جاري الحفظ...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            حفظ الإعدادات
          </>
        )}
      </button>
    </div>
  )
}
