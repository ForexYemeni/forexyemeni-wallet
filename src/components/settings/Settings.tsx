import { apiFetch } from '@/lib/api-client'
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Settings,
  User,
  Lock,
  LogOut,
  Bell,
  Shield,
  ShieldCheck,
  ChevronLeft,
  Loader2,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Mail,
  Hash,
  Copy,
  Check as CheckIcon,
} from 'lucide-react'
import {
  getNotificationSoundSettings,
  saveNotificationSoundSettings,
  NOTIFICATION_CATEGORIES,
  type NotificationSoundSettings,
  type NotificationCategory,
} from '@/lib/notification-settings'
import { playNotificationSound } from '@/lib/notification-sound'
import TwoFactorSettings from '@/components/auth/TwoFactorSettings'
import ChangeEmail from '@/components/settings/ChangeEmail'

export default function SettingsPage() {
  const { user, logout, updateUser, setScreen } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'security' | 'notifications' | 'about'>('profile')
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [loading, setLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [show2FASettings, setShow2FASettings] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [copiedAccount, setCopiedAccount] = useState(false)
  // Developer mode: show FCM debug after 7 taps on app name
  const [devTapCount, setDevTapCount] = useState(0)
  const [showDevTools, setShowDevTools] = useState(false)
  const handleDevTap = useCallback(() => {
    setDevTapCount(prev => {
      const next = prev + 1
      if (next >= 7) {
        setShowDevTools(true)
        toast.success('🔧 تم تفعيل وضع المطور', { duration: 2000 })
        return 0
      }
      return next
    })
  }, [])

  // Notification sound settings
  const [soundSettings, setSoundSettings] = useState<NotificationSoundSettings>(() => getNotificationSoundSettings())

  const handleToggleMaster = useCallback(() => {
    const updated = { ...soundSettings, soundEnabled: !soundSettings.soundEnabled }
    setSoundSettings(updated)
    saveNotificationSoundSettings(updated)
    toast.success(updated.soundEnabled ? 'تم تفعيل أصوات الإشعارات' : 'تم إيقاف أصوات الإشعارات')
    if (updated.soundEnabled) playNotificationSound('general').catch(() => {})
  }, [soundSettings])



  const handleToggleCategory = useCallback((category: NotificationCategory) => {
    const updated = {
      ...soundSettings,
      categories: { ...soundSettings.categories, [category]: !soundSettings.categories[category] },
    }
    setSoundSettings(updated)
    saveNotificationSoundSettings(updated)
    const cat = NOTIFICATION_CATEGORIES.find(c => c.key === category)
    toast.success(updated.categories[category] ? `تم تفعيل صوت ${cat?.label}` : `تم إيقاف صوت ${cat?.label}`)
  }, [soundSettings])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      updateUser({ fullName })
      toast.success('تم تحديث الملف الشخصي')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }
    if (newPassword.length < 8) {
      toast.error('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم تغيير كلمة المرور بنجاح')
        setCurrentPassword('')
        setNewPassword('')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setLogoutDialogOpen(false)
    logout()
    toast.success('تم تسجيل الخروج بنجاح')
  }

  const tabs = [
    { key: 'profile', label: 'الملف الشخصي', icon: User },
    { key: 'password', label: 'كلمة المرور', icon: Lock },
    { key: 'security', label: 'الأمان', icon: Shield },
    { key: 'notifications', label: 'الإشعارات', icon: Bell },
    { key: 'about', label: 'حول', icon: Settings },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center gold-glow">
          <Settings className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h1 className="text-lg font-bold">الإعدادات</h1>
          <p className="text-xs text-muted-foreground">إدارة حسابك وتفضيلاتك</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all haptic-btn ${
              activeTab === tab.key
                ? 'bg-gold/10 text-gold border border-gold/25 shadow-[0_0_12px_rgba(240,185,11,0.12)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Card — always visible at top */}
      <div className="glass-card profile-card p-5 space-y-4">
        <div className="relative flex items-center gap-4 pt-2">
          <div className="relative z-10 w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center text-gray-900 font-bold text-xl shadow-lg shadow-gold/20">
            {(user?.fullName || user?.email || 'م').charAt(0).toUpperCase()}
          </div>
          <div className="relative z-10 flex-1 min-w-0">
            <p className="text-base font-bold truncate">{user?.fullName || 'مستخدم'}</p>
            <p className="text-xs text-muted-foreground truncate" dir="ltr">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {user?.kycStatus === 'approved' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium border border-green-500/20">متحقق</span>
              )}
              {user?.kycStatus !== 'approved' && user?.kycStatus !== 'none' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-medium border border-yellow-500/20">بانتظار المراجعة</span>
              )}
              {user?.accountNumber && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium border border-blue-500/20 font-mono" dir="ltr">#{user.accountNumber}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && !showChangeEmail && (
        <div className="space-y-3 animate-fade-in">
          <form onSubmit={handleUpdateProfile} className="glass-card p-5 space-y-4 section-card gold-accent">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-gold" />
              <h3 className="text-sm font-bold">المعلومات الشخصية</h3>
            </div>
            <div className="float-label-group">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="float-label-input"
                placeholder=" "
              />
              <label className="float-label">الاسم الكامل</label>
            </div>
            <div className="float-label-group">
              <input
                value={user?.email || ''}
                disabled
                className="float-label-input pl-12 opacity-60"
                dir="ltr"
              />
              <label className="float-label active">البريد الإلكتروني</label>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <button
                  type="button"
                  onClick={() => setShowChangeEmail(true)}
                  className="text-xs text-gold hover:text-gold/80 font-medium transition-colors"
                >
                  تغيير
                </button>
              </div>
            </div>
            <div className="float-label-group">
              <input
                value={user?.phone ? `+967 ${user.phone}` : 'غير محدد'}
                disabled
                className="float-label-input opacity-60"
                dir="ltr"
              />
              <label className="float-label active">رقم الهاتف</label>
            </div>
            {user?.accountNumber && (
              <div className="float-label-group">
                <input
                  value={String(user.accountNumber)}
                  disabled
                  className="float-label-input pl-12 opacity-60 font-mono font-bold"
                  dir="ltr"
                />
                <label className="float-label active">رقم الحساب</label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(String(user.accountNumber!))
                    setCopiedAccount(true)
                    toast.success('تم نسخ رقم الحساب')
                    setTimeout(() => setCopiedAccount(false), 2000)
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                >
                  {copiedAccount ? <CheckIcon className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gold" />}
                </button>
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 gold-glow haptic-btn"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التغييرات'}
            </Button>
          </form>

          {/* Quick Actions */}
          <div className="space-y-2">
            <button
              onClick={() => setShowChangeEmail(true)}
              className="w-full glass-card p-4 rounded-xl flex items-center justify-between section-card gold-accent hover:bg-white/[0.03] transition-all haptic-btn"
            >
              <div className="flex items-center gap-3 pr-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-gold" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">تغيير البريد الإلكتروني</p>
                  <p className="text-[11px] text-muted-foreground">تحديث البريد الإلكتروني</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'profile' && showChangeEmail && (
        <ChangeEmail onClose={() => setShowChangeEmail(false)} />
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="glass-card p-5 space-y-4 animate-fade-in section-card red-accent">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-bold">تغيير كلمة المرور</h3>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="float-label-group">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="float-label-input pl-12"
                dir="ltr"
              />
              <label className="float-label active">كلمة المرور الحالية</label>
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="float-label-group">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="float-label-input pl-12"
                dir="ltr"
              />
              <label className="float-label active">كلمة المرور الجديدة</label>
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="info-banner-gold p-3">
              <p className="text-xs text-muted-foreground">يجب أن تكون كلمة المرور الجديدة 8 أحرف على الأقل وتمزيج أحرف كبيرة وصغيرة وأرقام</p>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 gold-glow haptic-btn"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تغيير كلمة المرور'}
            </Button>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && !show2FASettings && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-bold">الأمان والحماية</h3>
          </div>

          {/* 2FA Status Card */}
          <button
            onClick={() => setShow2FASettings(true)}
            className="w-full glass-card p-4 rounded-xl flex items-center justify-between section-card green-accent hover:bg-white/[0.03] transition-all haptic-btn"
          >
            <div className="flex items-center gap-3 pr-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                user?.twoFactorEnabled ? 'bg-green-500/10' : 'bg-white/5'
              }`}>
                {user?.twoFactorEnabled ? (
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                ) : (
                  <Shield className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-bold">المصادقة الثنائية</p>
                <p className="text-[11px] text-muted-foreground">
                  {user?.twoFactorEnabled ? 'مفعلة — حسابك محمي' : 'غير مفعلة — قم بتفعيلها للحماية'}
                </p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="info-banner-blue p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              المصادقة الثنائية تضيف طبقة حماية إضافية لحسابك. عند تفعيلها، سيتم إرسال رمز تحقق إلى بريدك الإلكتروني في كل مرة تسجل الدخول.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'security' && show2FASettings && (
        <TwoFactorSettings onClose={() => setShow2FASettings(false)} />
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-3 animate-fain-in">
          {/* View notifications */}
          <button
            onClick={() => setScreen('notifications')}
            className="w-full glass-card p-4 flex items-center justify-between rounded-xl section-card blue-accent hover:bg-white/[0.03] transition-all haptic-btn"
          >
            <div className="flex items-center gap-3 pr-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-bold">عرض جميع الإشعارات</p>
                <p className="text-[11px] text-muted-foreground">آخر التحديثات والتنبيهات</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Push Notifications (FCM) - always visible */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h3 className="text-sm font-bold">الإشعارات الفورية (FCM)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">تسجيل جهازك لاستقبال إشعارات الدفع</p>
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  toast.loading('جاري تسجيل جهاز الإشعارات...', { id: 'fcm-reg' })
                  const { forceReregisterFCM, getFCMDebugInfo } = await import('@/lib/fcm-push')
                  const result = await forceReregisterFCM()
                  const info = getFCMDebugInfo()
                  const w = window as any
                  const capExists = !!w.Capacitor
                  const capPlatform = w.Capacitor?.getPlatform?.() || '?'
                  const capPlugins = capExists ? Object.keys(w.Capacitor.Plugins || {}) : []

                  let diagnostic = `النتيجة: ${result}\n`
                  diagnostic += `Capacitor: ${capExists ? '✅ ' + capPlatform : '❌ غير موجود'}\n`
                  diagnostic += `الإضافات: ${capPlugins.length > 0 ? capPlugins.join(', ') : 'لا توجد'}\n`
                  diagnostic += `الحالة: ${info.registered ? '✅ مسجّل' : '❌ غير مسجّل'}`

                  toast.dismiss('fcm-reg')
                  if (info.registered) {
                    toast.success('تم تسجيل جهاز الإشعارات بنجاح ✅', { duration: 5000 })
                  } else {
                    toast.error(diagnostic, { duration: 10000 })
                  }
                } catch (e: any) {
                  toast.dismiss('fcm-reg')
                  toast.error('خطأ: ' + (e?.message || String(e)), { duration: 8000 })
                }
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-gold/5 hover:bg-gold/10 transition-colors border border-gold/10"
            >
              <span className="text-sm font-medium">📱 تسجيل جهاز الإشعارات</span>
              <span className="text-xs text-gold">اضغط للتسجيل</span>
            </button>

            <button
              onClick={async () => {
                try {
                  const res = await apiFetch('/api/notifications/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user!.id }),
                  })
                  const data = await res.json()
                  if (data.success) {
                    toast.success('تم الإرسال إلى ' + (data.debug?.pushResult?.successCount || '?') + ' جهاز — راقب شريط الإشعارات', { duration: 5000 })
                  } else {
                    toast.error(data.message || 'فشل', { duration: 8000 })
                  }
                } catch {
                  toast.error('حدث خطأ')
                }
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-green-500/5 hover:bg-green-500/10 transition-colors border border-green-500/10"
            >
              <span className="text-sm font-medium">🔔 اختبار إرسال إشعار</span>
              <span className="text-xs text-green-400">اختبار</span>
            </button>
          </div>

          {/* Sound settings */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${soundSettings.soundEnabled ? 'bg-gold/10' : 'bg-white/5'}`}>
                  {soundSettings.soundEnabled ? (
                    <Volume2 className="w-5 h-5 text-gold" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold">أصوات الإشعارات</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {soundSettings.soundEnabled ? 'جميع الأصوات مفعّلة' : 'جميع الأصوات متوقفة'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleMaster}
                className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                  soundSettings.soundEnabled
                    ? 'bg-gold shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                    : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                    soundSettings.soundEnabled ? 'left-5.5' : 'left-0.5'
                  }`}
                  style={{ left: soundSettings.soundEnabled ? '22px' : '2px' }}
                />
              </button>
            </div>

            {/* Test sound button */}
            <button
              onClick={async () => {
                try {
                  await playNotificationSound('general')
                  toast.success('تم تشغيل صوت الإشعارات ✓')
                } catch {
                  toast.error('فشل تشغيل الصوت')
                }
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-gold/5 hover:bg-gold/10 transition-colors border border-gold/10"
            >
              <span className="text-sm font-medium">🔔 اختبار صوت الإشعارات</span>
              <Volume2 className="w-4 h-4 text-gold" />
            </button>

            {/* Developer Tools (hidden — enable via 7 taps on app name in About tab) */}
            {showDevTools && (<>
              {/* Close dev tools */}
              <button
                onClick={() => { setShowDevTools(false); setDevTapCount(0); toast.success('تم إغلاق وضع المطور', { duration: 1500 }) }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-red-500/5 hover:bg-red-500/10 transition-colors border border-red-500/10"
              >
                <span className="text-sm font-medium">🔒 إغلاق وضع المطور</span>
                <span className="text-xs text-red-400">close</span>
              </button>

              {/* FCM Registration Debug */}
              <button
                onClick={async () => {
                  try {
                    const { getFCMDebugInfo } = await import('@/lib/fcm-push')
                    const info = getFCMDebugInfo()
                    const w = window as any
                    const capacitorInfo = w.Capacitor ? `Platform: ${w.Capacitor.getPlatform?.() || '?'} | Plugins: ${Object.keys(w.Capacitor.Plugins || {}).join(', ') || 'none'}` : 'Capacitor NOT found'
                    toast.info(`${capacitorInfo} | ${info.lastResult}`, { duration: 8000 })
                  } catch (e: any) {
                    toast.error('Debug: ' + (e?.message || String(e)))
                  }
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 transition-colors border border-orange-500/10"
              >
                <span className="text-sm font-medium">🔧 تشخيص FCM (اضغط لعرض الحالة)</span>
                <span className="text-xs text-orange-400">debug</span>
              </button>

              {/* Test notification (server + FCM) */}
              {user?.id && (
                <button
                  onClick={async () => {
                    try {
                      const res = await apiFetch('/api/notifications/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.id }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        toast.success('تم الإرسال إلى ' + (data.debug?.pushResult?.successCount || '?') + ' جهاز — راقب شريط الإشعارات')
                      } else {
                        toast.error(data.message || 'فشل', { duration: 8000 })
                      }
                    } catch {
                      toast.error('حدث خطأ')
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gold/5 hover:bg-gold/10 transition-colors border border-gold/10"
                >
                  <span className="text-sm font-medium">📱 اختبار إشعار كامل (FCM)</span>
                  <Volume2 className="w-4 h-4 text-gold" />
                </button>
              )}
            </>)}

            {/* Per-category toggles */}
            {soundSettings.soundEnabled && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <p className="text-xs text-muted-foreground mb-3">تحكم بأصوات كل نوع من الإشعارات:</p>
                {NOTIFICATION_CATEGORIES.map((cat) => {
                  const isOn = soundSettings.categories[cat.key]
                  return (
                    <div
                      key={cat.key}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 transition-colors"
                    >
                      <div className="flex-1 ml-3">
                        <p className="text-sm font-medium">{cat.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                      </div>
                      <button
                        onClick={() => handleToggleCategory(cat.key)}
                        className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
                          isOn
                            ? 'bg-green-500/80'
                            : 'bg-white/10'
                        }`}
                      >
                        <span
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300"
                          style={{ left: isOn ? '20px' : '2px' }}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="glass-card p-5 space-y-4 animate-fade-in section-card gold-accent">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-bold">حول التطبيق</h3>
          </div>
          <div className="space-y-0">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
                  <span className="text-gold font-bold text-xs">FY</span>
                </div>
                <span className="text-sm">التطبيق</span>
              </div>
              <span className="font-bold gold-text cursor-pointer select-none" onClick={handleDevTap}>فوركس يمني</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Hash className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm text-muted-foreground">الإصدار</span>
              </div>
              <span className="text-sm font-medium">v3.7.0</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <span className="text-green-400 font-bold text-xs">USDT</span>
                </div>
                <span className="text-sm text-muted-foreground">الشبكة</span>
              </div>
              <span className="text-sm font-medium">TRC20</span>
            </div>
          </div>
        </div>
      )}

      {/* Logout */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogTrigger asChild>
          <button
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all haptic-btn"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">تسجيل الخروج</span>
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="glass-card bg-background/95 backdrop-blur-xl border-red-500/20 text-right" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
              <LogOut className="w-5 h-5" />
              تسجيل الخروج
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
              هل أنت متأكد من رغبتك في تسجيل الخروج؟
              <br />
              ستحتاج إلى إدخال البريد الإلكتروني وكلمة المرور مرة أخرى للوصول إلى حسابك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-3 sm:gap-0">
            <AlertDialogAction
              onClick={handleLogout}
              className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all haptic-btn"
            >
              نعم، خروج
            </AlertDialogAction>
            <AlertDialogCancel
              className="flex-1 h-11 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all"
            >
              إلغاء
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
