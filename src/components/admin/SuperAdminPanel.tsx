'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Shield, Settings, Bell, Lock, Database, Globe, Eye,
  RefreshCw, Plus, X, Check, AlertTriangle, Megaphone,
  ShieldAlert, ShieldCheck, Monitor, Wifi, WifiOff,
  ToggleLeft, ToggleRight, Trash2, Send, Users, CreditCard,
  KeyRound, Fingerprint, Ban, ChevronDown, ChevronUp,
  Activity, Server, Clock, Zap, Info, AlertCircle,
  MessageSquare, Phone, Mail, ExternalLink,
} from 'lucide-react'

// ===================== TYPES =====================

interface SystemSettings {
  maintenanceMode: boolean
  maintenanceMessage: string
  registrationOpen: boolean
  kycRequired: boolean
  depositFeePercent: number
  withdrawalFeePercent: number
  minDepositAmount: number
  maxDepositAmount: number
  minWithdrawAmount: number
  maxWithdrawAmount: number
  dailyWithdrawLimit: number
  autoApproveDeposit: boolean
  autoApproveWithdrawal: boolean
  platformName: string
  supportEmail: string
  supportPhone: string
  telegramLink: string
  whatsappLink: string
  announcements: Announcement[]
  bannedIPs: string[]
  suspiciousAccounts: SuspiciousAccount[]
}

interface Announcement {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'urgent'
  active: boolean
  createdAt: string
  expiresAt: string | null
}

interface SuspiciousAccount {
  userId: string
  email: string
  reason: string
  detectedAt: string
  resolved: boolean
}

interface LoginAttempt {
  id: string
  userId?: string
  email: string
  ip: string
  deviceName?: string
  success: boolean
  createdAt: string
}

interface DashboardData {
  settings: SystemSettings
  recentLoginAttempts: LoginAttempt[]
  activeSessionsCount: number
  collectionCounts: Record<string, number>
}

// ===================== DEFAULT SETTINGS =====================

const DEFAULT_SETTINGS: SystemSettings = {
  maintenanceMode: false,
  maintenanceMessage: '',
  registrationOpen: true,
  kycRequired: false,
  depositFeePercent: 0,
  withdrawalFeePercent: 0,
  minDepositAmount: 0,
  maxDepositAmount: 0,
  minWithdrawAmount: 0,
  maxWithdrawAmount: 0,
  dailyWithdrawLimit: 0,
  autoApproveDeposit: false,
  autoApproveWithdrawal: false,
  platformName: 'ForexYemeni',
  supportEmail: '',
  supportPhone: '',
  telegramLink: '',
  whatsappLink: '',
  announcements: [],
  bannedIPs: [],
  suspiciousAccounts: [],
}

// ===================== MAIN COMPONENT =====================

type SectionKey = 'overview' | 'settings' | 'announcements' | 'security' | 'data'

export default function SuperAdminPanel() {
  const { user } = useAuthStore()
  const [activeSection, setActiveSection] = useState<SectionKey>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([])

  // Dialog states
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false)
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'info' as 'info' | 'warning' | 'urgent', expiresAt: '' })
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', target: 'all' as 'all' | 'active' | 'merchants' })
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [showBanIpDialog, setShowBanIpDialog] = useState(false)
  const [banIpInput, setBanIpInput] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  // ===================== FETCH DATA =====================

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/super-admin?adminId=${user.id}`)
      const data = await res.json()
      if (data.success) {
        setDashboardData(data.data)
        setSettings(data.data?.settings || DEFAULT_SETTINGS)
        setLoginAttempts(data.data?.recentLoginAttempts || [])
      } else {
        toast.error(data.message || 'خطأ في تحميل البيانات')
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // ===================== ACTION HANDLERS =====================

  const handleUpdateSettings = async (updates: Partial<SystemSettings>) => {
    if (!user?.id) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, action: 'update_settings', ...updates }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم تحديث الإعدادات')
        setSettings(prev => ({ ...prev, ...updates }))
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleMaintenance = async () => {
    if (!user?.id) return
    const newVal = !settings.maintenanceMode
    if (!newVal || confirm('هل تريد تفعيل وضع الصيانة؟ سيتم منع جميع المستخدمين من تسجيل الدخول.')) {
      setSaving(true)
      try {
        const res = await fetch('/api/admin/super-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId: user.id, action: 'toggle_maintenance' }),
        })
        const data = await res.json()
        if (data.success) {
          setSettings(prev => ({ ...prev, maintenanceMode: newVal }))
          toast.success(newVal ? 'تم تفعيل وضع الصيانة' : 'تم إيقاف وضع الصيانة')
        } else {
          toast.error(data.message)
        }
      } catch {
        toast.error('خطأ')
      } finally {
        setSaving(false)
      }
    }
  }

  const handleCreateAnnouncement = async () => {
    if (!user?.id || !announcementForm.title.trim() || !announcementForm.message.trim()) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          action: 'create_announcement',
          title: announcementForm.title.trim(),
          message: announcementForm.message.trim(),
          type: announcementForm.type,
          expiresAt: announcementForm.expiresAt || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء الإعلان')
        setShowAnnouncementDialog(false)
        setAnnouncementForm({ title: '', message: '', type: 'info', expiresAt: '' })
        fetchData()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    if (!user?.id || !confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, action: 'delete_announcement', announcementId: id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حذف الإعلان')
        fetchData()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ')
    }
  }

  const handleToggleAnnouncement = async (id: string) => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, action: 'toggle_announcement', announcementId: id }),
      })
      if (res.ok) fetchData()
    } catch { /* silent */ }
  }

  const handleBroadcast = async () => {
    if (!user?.id || !broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }
    setBroadcastLoading(true)
    try {
      const res = await fetch('/api/admin/super-admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, ...broadcastForm }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`تم إرسال الإشعار إلى ${data.sentCount || 0} مستخدم`)
        setShowBroadcastDialog(false)
        setBroadcastForm({ title: '', message: '', target: 'all' })
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الإرسال')
    } finally {
      setBroadcastLoading(false)
    }
  }

  const handleBanIp = async () => {
    if (!user?.id || !banIpInput.trim()) {
      toast.error('يرجى إدخال عنوان IP')
      return
    }
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, action: 'ban_ip', ip: banIpInput.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حظر IP')
        setShowBanIpDialog(false)
        setBanIpInput('')
        fetchData()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ')
    }
  }

  const handleUnbanIp = async (ip: string) => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, action: 'unban_ip', ip }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إلغاء حظر IP')
        fetchData()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ')
    }
  }

  const handleResolveSuspicious = async (userId: string) => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, action: 'resolve_suspicious', userId }),
      })
      if (res.ok) fetchData()
    } catch { /* silent */ }
  }

  // ===================== SECTION TABS =====================

  const sections: { key: SectionKey; label: string; icon: any }[] = [
    { key: 'overview', label: 'نظرة عامة', icon: Monitor },
    { key: 'settings', label: 'إعدادات النظام', icon: Settings },
    { key: 'announcements', label: 'الإعلانات', icon: Megaphone },
    { key: 'security', label: 'الأمان', icon: Lock },
    { key: 'data', label: 'البيانات', icon: Database },
  ]

  const collectionCounts = dashboardData?.collectionCounts || {}
  const suspiciousAccounts = settings.suspiciousAccounts || []

  // ===================== RENDER =====================

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-purple-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold gold-text">لوحة التحكم الخارقة</h2>
            <p className="text-xs text-muted-foreground">تحكم كامل بكل تفاصيل المنصة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} disabled={loading} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${settings.maintenanceMode ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
            {settings.maintenanceMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            {settings.maintenanceMode ? 'وضع الصيانة' : 'النظام يعمل'}
          </div>
        </div>
      </div>

      {/* Maintenance Mode Banner */}
      {settings.maintenanceMode && (
        <div className="glass-card p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-400">وضع الصيانة مفعّل</p>
              <p className="text-xs text-muted-foreground">{settings.maintenanceMessage || 'المنصة تحت الصيانة حالياً'}</p>
            </div>
          </div>
          <button onClick={handleToggleMaintenance} disabled={saving} className="text-xs px-3 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'إيقاف'}
          </button>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {sections.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0 ${
              activeSection === s.key ? 'bg-gold/10 text-gold border border-gold/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
            }`}>
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div>
          {/* ===================== OVERVIEW ===================== */}
          {activeSection === 'overview' && (
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-muted-foreground">المستخدمون</span>
                  </div>
                  <p className="text-xl font-bold">{(collectionCounts['users'] || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">حساب مسجّل</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-muted-foreground">الإيداعات</span>
                  </div>
                  <p className="text-xl font-bold">{(collectionCounts['deposits'] || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">عملية إيداع</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-muted-foreground">السحوبات</span>
                  </div>
                  <p className="text-xl font-bold">{(collectionCounts['withdrawals'] || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">عملية سحب</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-muted-foreground">الجلسات النشطة</span>
                  </div>
                  <p className="text-xl font-bold">{(dashboardData?.activeSessionsCount || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">جهاز متصل</p>
                </div>
              </div>

              {/* Platform Status Cards */}
              <div className="glass-card p-4 rounded-xl space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Server className="w-4 h-4 text-gold" />
                  حالة المنصة
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatusCard label="وضع الصيانة" active={!settings.maintenanceMode} activeText="مُعطّل" inactiveText="مفعّل" />
                  <StatusCard label="التسجيل" active={settings.registrationOpen} activeText="مفتوح" inactiveText="مغلق" />
                  <StatusCard label="توثيق الهوية" active={settings.kycRequired} activeText="مطلوب" inactiveText="اختياري" />
                  <StatusCard label="التأكيد التلقائي للإيداع" active={settings.autoApproveDeposit} activeText="مفعّل" inactiveText="مُعطّل" />
                  <StatusCard label="التأكيد التلقائي للسحب" active={settings.autoApproveWithdrawal} activeText="مفعّل" inactiveText="مُعطّل" />
                  <StatusCard label="IP محظورة" active={settings.bannedIPs?.length > 0} activeText={`${settings.bannedIPs?.length || 0} IP`} inactiveText="لا يوجد" />
                </div>
              </div>

              {/* Recent Login Attempts */}
              <div className="glass-card p-4 rounded-xl space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-purple-400" />
                  آخر محاولات تسجيل الدخول
                </h3>
                {loginAttempts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات</p>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {loginAttempts.slice(0, 15).map((attempt) => (
                      <div key={attempt.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${attempt.success ? 'bg-green-400' : 'bg-red-400'}`} />
                          <div>
                            <p className="text-xs font-medium" dir="ltr">{attempt.email}</p>
                            <p className="text-[10px] text-muted-foreground" dir="ltr">{attempt.ip}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${attempt.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {attempt.success ? 'نجاح' : 'فشل'}
                          </span>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {attempt.createdAt ? new Date(attempt.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suspicious Accounts */}
              {suspiciousAccounts.length > 0 && (
                <div className="glass-card p-4 rounded-xl space-y-3 border border-orange-500/20">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-orange-400">
                    <ShieldAlert className="w-4 h-4" />
                    حسابات مشبوهة ({suspiciousAccounts.filter(a => !a.resolved).length} نشطة)
                  </h3>
                  <div className="space-y-1.5">
                    {suspiciousAccounts.filter(a => !a.resolved).slice(0, 5).map((account) => (
                      <div key={account.userId} className="flex items-center justify-between p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/10">
                        <div>
                          <p className="text-xs font-medium" dir="ltr">{account.email}</p>
                          <p className="text-[10px] text-orange-400">{account.reason}</p>
                        </div>
                        <button onClick={() => handleResolveSuspicious(account.userId)} className="text-[10px] px-2 py-1 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20">
                          تم الحل
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="glass-card p-4 rounded-xl space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gold" />
                  إجراءات سريعة
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleToggleMaintenance} disabled={saving}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-medium transition-all ${settings.maintenanceMode ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                    {settings.maintenanceMode ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    {settings.maintenanceMode ? 'إيقاف الصيانة' : 'تفعيل الصيانة'}
                  </button>
                  <button onClick={() => setShowBroadcastDialog(true)}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all">
                    <Megaphone className="w-4 h-4" />
                    إرسال إشعار عام
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== SETTINGS ===================== */}
          {activeSection === 'settings' && (
            <div className="space-y-4">
              {/* Registration & KYC */}
              <SettingsCard title="التسجيل والتحقق" icon={Users}>
                <ToggleRow label="فتح التسجيل الجديد" description="السماح للمستخدمين الجديد بالتسجيل في المنصة"
                  checked={settings.registrationOpen} onChange={(v) => handleUpdateSettings({ registrationOpen: v })} disabled={saving} />
                <ToggleRow label="توثيق الهوية إجباري" description="يتطلب من جميع المستخدمين توثيق هويتهم قبل استخدام المنصة"
                  checked={settings.kycRequired} onChange={(v) => handleUpdateSettings({ kycRequired: v })} disabled={saving} />
              </SettingsCard>

              {/* Automation */}
              <SettingsCard title="التأكيد التلقائي" icon={Zap}>
                <ToggleRow label="تأكيد تلقائي للإيداعات" description="تأكيد الإيداعات تلقائياً عند استلامها بدون مراجعة يدوية"
                  checked={settings.autoApproveDeposit} onChange={(v) => handleUpdateSettings({ autoApproveDeposit: v })} disabled={saving} />
                <ToggleRow label="تأكيد تلقائي للسحوبات" description="تنفيذ السحوبات تلقائياً بدون مراجعة يدوية"
                  checked={settings.autoApproveWithdrawal} onChange={(v) => handleUpdateSettings({ autoApproveWithdrawal: v })} disabled={saving} />
              </SettingsCard>

              {/* Fees */}
              <SettingsCard title="الرسوم" icon={CreditCard}>
                <NumberRow label="رسوم الإيداع (%)" value={settings.depositFeePercent} onChange={(v) => handleUpdateSettings({ depositFeePercent: v })} disabled={saving} min={0} max={100} step={0.1} />
                <NumberRow label="رسوم السحب (%)" value={settings.withdrawalFeePercent} onChange={(v) => handleUpdateSettings({ withdrawalFeePercent: v })} disabled={saving} min={0} max={100} step={0.1} />
              </SettingsCard>

              {/* Limits */}
              <SettingsCard title="الحدود المالية" icon={Globe}>
                <NumberRow label="الحد الأدنى للإيداع (USDT)" value={settings.minDepositAmount} onChange={(v) => handleUpdateSettings({ minDepositAmount: v })} disabled={saving} min={0} step={1} />
                <NumberRow label="الحد الأقصى للإيداع (USDT)" value={settings.maxDepositAmount} onChange={(v) => handleUpdateSettings({ maxDepositAmount: v })} disabled={saving} min={0} step={1} placeholder="0 = بلا حد" />
                <NumberRow label="الحد الأدنى للسحب (USDT)" value={settings.minWithdrawAmount} onChange={(v) => handleUpdateSettings({ minWithdrawAmount: v })} disabled={saving} min={0} step={1} />
                <NumberRow label="الحد الأقصى للسحب (USDT)" value={settings.maxWithdrawAmount} onChange={(v) => handleUpdateSettings({ maxWithdrawAmount: v })} disabled={saving} min={0} step={1} placeholder="0 = بلا حد" />
                <NumberRow label="الحد اليومي للسحب (USDT)" value={settings.dailyWithdrawLimit} onChange={(v) => handleUpdateSettings({ dailyWithdrawLimit: v })} disabled={saving} min={0} step={1} placeholder="0 = بلا حد" />
              </SettingsCard>

              {/* Platform Info */}
              <SettingsCard title="معلومات المنصة" icon={Info}>
                <TextRow label="اسم المنصة" value={settings.platformName} onChange={(v) => handleUpdateSettings({ platformName: v })} disabled={saving} placeholder="ForexYemeni" />
                <TextRow label="البريد الإلكتروني للدعم" value={settings.supportEmail} onChange={(v) => handleUpdateSettings({ supportEmail: v })} disabled={saving} type="email" placeholder="support@example.com" />
                <TextRow label="رقم الهاتف للدعم" value={settings.supportPhone} onChange={(v) => handleUpdateSettings({ supportPhone: v })} disabled={saving} placeholder="+967..." />
                <TextRow label="رابط تيليجرام" value={settings.telegramLink} onChange={(v) => handleUpdateSettings({ telegramLink: v })} disabled={saving} placeholder="https://t.me/..." />
                <TextRow label="رابط واتساب" value={settings.whatsappLink} onChange={(v) => handleUpdateSettings({ whatsappLink: v })} disabled={saving} placeholder="https://wa.me/..." />
              </SettingsCard>

              {/* Maintenance */}
              <SettingsCard title="وضع الصيانة" icon={AlertTriangle}>
                <ToggleRow label="تفعيل وضع الصيانة" description="منع المستخدمين من تسجيل الدخول وعرض رسالة صيانة"
                  checked={settings.maintenanceMode} onChange={(v) => handleToggleMaintenance()} disabled={saving} />
                {settings.maintenanceMode && (
                  <div className="space-y-2 pt-2">
                    <label className="text-xs text-muted-foreground">رسالة الصيانة</label>
                    <textarea value={settings.maintenanceMessage} onChange={(e) => setSettings(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
                      onBlur={() => handleUpdateSettings({ maintenanceMessage: settings.maintenanceMessage })}
                      className="w-full h-20 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground resize-none"
                      placeholder="المنصة تحت الصيانة حالياً، سنعود قريباً..." />
                  </div>
                )}
              </SettingsCard>
            </div>
          )}

          {/* ===================== ANNOUNCEMENTS ===================== */}
          {activeSection === 'announcements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{settings.announcements?.length || 0} إعلان</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowBroadcastDialog(true)} className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium">
                    <Send className="w-3.5 h-3.5" />
                    إرسال إشعار
                  </button>
                  <button onClick={() => setShowAnnouncementDialog(true)} className="flex items-center gap-1.5 px-3 h-9 rounded-lg gold-gradient text-gray-900 hover:opacity-90 transition-all text-xs font-medium">
                    <Plus className="w-3.5 h-3.5" />
                    إعلان جديد
                  </button>
                </div>
              </div>

              {(!settings.announcements || settings.announcements.length === 0) ? (
                <div className="glass-card p-8 text-center">
                  <Megaphone className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">لا توجد إعلانات</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">أنشئ إعلان جديد لإشعار المستخدمين</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {settings.announcements.map((ann) => {
                    const typeConfig = ann.type === 'urgent' ? { bg: 'bg-red-500/5 border-red-500/10', text: 'text-red-400', label: 'عاجل', icon: AlertTriangle }
                      : ann.type === 'warning' ? { bg: 'bg-yellow-500/5 border-yellow-500/10', text: 'text-yellow-400', label: 'تحذير', icon: AlertCircle }
                      : { bg: 'bg-blue-500/5 border-blue-500/10', text: 'text-blue-400', label: 'معلومات', icon: Info }

                    const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date()

                    return (
                      <div key={ann.id} className={`glass-card p-4 rounded-xl border ${typeConfig.bg} ${!ann.active || isExpired ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${typeConfig.bg} ${typeConfig.text}`}>
                              <typeConfig.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeConfig.bg} ${typeConfig.text}`}>
                                  {typeConfig.label}
                                </span>
                                {!ann.active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400">مُعطّل</span>}
                                {isExpired && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400">منتهي</span>}
                              </div>
                              <p className="text-sm font-medium">{ann.title}</p>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ann.message}</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1">
                                {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('ar-YE') : ''}
                                {ann.expiresAt && ` • ينتهي: ${new Date(ann.expiresAt).toLocaleDateString('ar-YE')}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button onClick={() => handleToggleAnnouncement(ann.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title={ann.active ? 'تعطيل' : 'تفعيل'}>
                              {ann.active ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                            <button onClick={() => handleDeleteAnnouncement(ann.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors" title="حذف">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===================== SECURITY ===================== */}
          {activeSection === 'security' && (
            <div className="space-y-4">
              {/* Banned IPs */}
              <div className="glass-card p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-400" />
                    عناوين IP المحظورة
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{settings.bannedIPs?.length || 0}</span>
                  </h3>
                  <button onClick={() => setShowBanIpDialog(true)} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs">
                    <Plus className="w-3 h-3" /> حظر IP
                  </button>
                </div>
                {(!settings.bannedIPs || settings.bannedIPs.length === 0) ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد عناوين محظورة</p>
                ) : (
                  <div className="space-y-1.5">
                    {settings.bannedIPs.map((ip) => (
                      <div key={ip} className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                        <div className="flex items-center gap-2">
                          <Ban className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs font-mono" dir="ltr">{ip}</span>
                        </div>
                        <button onClick={() => handleUnbanIp(ip)} className="text-[10px] px-2 py-1 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20">
                          إلغاء الحظر
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Login Attempts Analysis */}
              <div className="glass-card p-4 rounded-xl space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-purple-400" />
                  تحليل محاولات الدخول
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-lg font-bold">{loginAttempts.length}</p>
                    <p className="text-[10px] text-muted-foreground">إجمالي</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-500/5">
                    <p className="text-lg font-bold text-green-400">{loginAttempts.filter(a => a.success).length}</p>
                    <p className="text-[10px] text-muted-foreground">ناجحة</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-500/5">
                    <p className="text-lg font-bold text-red-400">{loginAttempts.filter(a => !a.success).length}</p>
                    <p className="text-[10px] text-muted-foreground">فاشلة</p>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                  {loginAttempts.slice(0, 20).map((attempt) => (
                    <div key={attempt.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${attempt.success ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-[11px] font-mono truncate" dir="ltr">{attempt.email}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">{attempt.ip}</span>
                        <span className="text-[9px] text-muted-foreground">
                          {attempt.createdAt ? new Date(attempt.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suspicious Accounts */}
              <div className="glass-card p-4 rounded-xl space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                  الحسابات المشبوهة
                </h3>
                {suspiciousAccounts.length === 0 ? (
                  <div className="text-center py-4">
                    <ShieldCheck className="w-8 h-8 text-green-400/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">لا توجد حسابات مشبوهة</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {suspiciousAccounts.map((account) => (
                      <div key={account.userId} className={`flex items-center justify-between p-2.5 rounded-lg ${account.resolved ? 'bg-gray-500/5 opacity-50' : 'bg-orange-500/5 border border-orange-500/10'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {account.resolved ? <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> : <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" dir="ltr">{account.email}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{account.reason}</p>
                          </div>
                        </div>
                        {!account.resolved && (
                          <button onClick={() => handleResolveSuspicious(account.userId)} className="text-[10px] px-2 py-1 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 flex-shrink-0">
                            تم الحل
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== DATA ===================== */}
          {activeSection === 'data' && (
            <div className="space-y-4">
              {/* Collection Statistics */}
              <div className="glass-card p-4 rounded-xl space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  إحصائيات قاعدة البيانات
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(collectionCounts).map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                      <span className="text-xs text-muted-foreground">{getCollectionLabel(name)}</span>
                      <span className="text-xs font-bold">{(count || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Summary */}
              <div className="glass-card p-4 rounded-xl space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gold" />
                  ملخص البيانات
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                    <span className="text-xs text-muted-foreground">إجمالي المستندات</span>
                    <span className="text-xs font-bold">{Object.values(collectionCounts).reduce((a, b) => a + b, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                    <span className="text-xs text-muted-foreground">عدد المجموعات</span>
                    <span className="text-xs font-bold">{Object.keys(collectionCounts).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                    <span className="text-xs text-muted-foreground">الجلسات النشطة</span>
                    <span className="text-xs font-bold text-green-400">{(dashboardData?.activeSessionsCount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== DIALOGS ===================== */}

      {/* Announcement Dialog */}
      {showAnnouncementDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowAnnouncementDialog(false)}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4 animate-scale-in max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto">
                <Megaphone className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold gold-text">إعلان جديد</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">العنوان</label>
                <input value={announcementForm.title} onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full h-10 rounded-lg glass-input px-3 text-sm" placeholder="عنوان الإعلان..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">المحتوى</label>
                <textarea value={announcementForm.message} onChange={(e) => setAnnouncementForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full h-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground resize-none" placeholder="نص الإعلان..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">النوع</label>
                  <select value={announcementForm.type} onChange={(e) => setAnnouncementForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground">
                    <option value="info">معلومات</option>
                    <option value="warning">تحذير</option>
                    <option value="urgent">عاجل</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">تاريخ الانتهاء (اختياري)</label>
                  <input type="date" value={announcementForm.expiresAt} onChange={(e) => setAnnouncementForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                    className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground" />
                </div>
              </div>
              <button onClick={handleCreateAnnouncement} disabled={saving || !announcementForm.title.trim() || !announcementForm.message.trim()}
                className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'نشر الإعلان'}
              </button>
              <button onClick={() => setShowAnnouncementDialog(false)} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground rounded-xl text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Dialog */}
      {showBroadcastDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBroadcastDialog(false)}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-blue-500/20 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
                <Send className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-blue-400">إرسال إشعار عام</h3>
              <p className="text-xs text-muted-foreground">سيتم إرسال إشعار للمستخدمين المستهدفين</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">العنوان</label>
                <input value={broadcastForm.title} onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full h-10 rounded-lg glass-input px-3 text-sm" placeholder="عنوان الإشعار..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">المحتوى</label>
                <textarea value={broadcastForm.message} onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full h-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground resize-none" placeholder="نص الإشعار..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">الفئة المستهدفة</label>
                <select value={broadcastForm.target} onChange={(e) => setBroadcastForm(prev => ({ ...prev, target: e.target.value as any }))}
                  className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground">
                  <option value="all">جميع المستخدمين</option>
                  <option value="active">المستخدمون النشطون فقط</option>
                  <option value="merchants">التجار فقط</option>
                </select>
              </div>
              <button onClick={handleBroadcast} disabled={broadcastLoading || !broadcastForm.title.trim() || !broadcastForm.message.trim()}
                className="w-full h-11 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50">
                {broadcastLoading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'إرسال الإشعار'}
              </button>
              <button onClick={() => setShowBroadcastDialog(false)} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground rounded-xl text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Ban IP Dialog */}
      {showBanIpDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBanIpDialog(false)}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-red-500/20 w-full max-w-sm rounded-2xl p-6 space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                <Ban className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-red-400">حظر عنوان IP</h3>
            </div>
            <div className="space-y-3">
              <input value={banIpInput} onChange={(e) => setBanIpInput(e.target.value)} type="text" dir="ltr"
                className="w-full h-12 rounded-lg glass-input px-4 text-sm font-mono" placeholder="مثال: 192.168.1.1" />
              <button onClick={handleBanIp} disabled={!banIpInput.trim()}
                className="w-full h-11 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all disabled:opacity-50">
                حظر
              </button>
              <button onClick={() => setShowBanIpDialog(false)} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground rounded-xl text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== SUB-COMPONENTS =====================

function StatusCard({ label, active, activeText, inactiveText }: { label: string; active: boolean; activeText: string; inactiveText: string }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-medium ${active ? 'text-green-400' : 'text-red-400'}`}>
        {active ? activeText : inactiveText}
      </span>
    </div>
  )
}

function SettingsCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true)
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gold" />
          <span className="text-sm font-bold">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">{children}</div>}
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
      <div className="flex-1 mr-3">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!checked)} disabled={disabled} className="flex-shrink-0">
        {checked ? (
          <ToggleRight className="w-8 h-8 text-gold" />
        ) : (
          <ToggleLeft className="w-8 h-8 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}

function NumberRow({ label, value, onChange, disabled, min = 0, max, step = 1, placeholder }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean; min?: number; max?: number; step?: number; placeholder?: string }) {
  const [localValue, setLocalValue] = useState(value.toString())
  const [editing, setEditing] = useState(false)

  useEffect(() => { setLocalValue(value.toString()) }, [value])

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 gap-3">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <input
        type="number"
        value={editing ? localValue : value}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false)
          const num = parseFloat(localValue) || 0
          onChange(Math.max(min, max !== undefined ? Math.min(num, max) : num))
        }}
        disabled={disabled}
        min={min} max={max} step={step}
        placeholder={placeholder}
        className="w-28 h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-foreground text-left font-mono"
        dir="ltr"
      />
    </div>
  )
}

function TextRow({ label, value, onChange, disabled, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; type?: string; placeholder?: string }) {
  const [localValue, setLocalValue] = useState(value)
  const [editing, setEditing] = useState(false)

  useEffect(() => { setLocalValue(value) }, [value])

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 gap-3">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <input
        type={type}
        value={editing ? localValue : value}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false)
          onChange(localValue)
        }}
        disabled={disabled}
        placeholder={placeholder}
        className="w-48 h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-foreground text-left"
        dir="ltr"
      />
    </div>
  )
}

function getCollectionLabel(name: string): string {
  const labels: Record<string, string> = {
    users: 'المستخدمون',
    deposits: 'الإيداعات',
    withdrawals: 'السحوبات',
    transactions: 'المعاملات',
    kycRecords: 'سجلات KYC',
    notifications: 'الإشعارات',
    chats: 'المحادثات',
    chatMessages: 'رسائل المحادثات',
    otpCodes: 'رموز التحقق',
    paymentMethods: 'طرق الدفع',
    userPaymentMethods: 'طرق الدفع المستخدمة',
    faqBot: 'أسئلة البوت',
    referrals: 'الدعوات',
    referralCommissions: 'عمولات الدعوات',
    merchants: 'التجار',
    p2pListings: 'إعلانات P2P',
    p2pTrades: 'صفقات P2P',
    userDevices: 'أجهزة المستخدمين',
    loginAttempts: 'محاولات الدخول',
    auditLog: 'سجل العمليات',
    systemSettings: 'إعدادات النظام',
  }
  return labels[name] || name
}
