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
  Phone,
  MessageCircle,
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

// Telegram SVG icon
const TelegramIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
)

// WhatsApp SVG icon
const WhatsAppIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

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
  // Support info state
  const [supportInfo, setSupportInfo] = useState<{ email: string; phone: string; telegram: string; whatsapp: string } | null>(null)

  // Fetch support info on mount
  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const res = await fetch('/api/support-info')
        const data = await res.json()
        if (data.success && data.support) {
          setSupportInfo(data.support)
        }
      } catch {
        // silent
      }
    }
    fetchSupport()
  }, [])

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

  // Support info items for rendering
  const supportItems = supportInfo
    ? [
        supportInfo.email ? { key: 'email', label: 'البريد الإلكتروني', value: supportInfo.email, href: `mailto:${supportInfo.email}`, icon: Mail, color: '#3B82F6' } : null,
        supportInfo.phone ? { key: 'phone', label: 'الهاتف', value: supportInfo.phone, href: `tel:${supportInfo.phone}`, icon: Phone, color: '#10B981' } : null,
        supportInfo.telegram ? { key: 'telegram', label: 'تيلجرام', value: supportInfo.telegram, href: supportInfo.telegram, icon: TelegramIcon, color: '#0088cc' } : null,
        supportInfo.whatsapp ? { key: 'whatsapp', label: 'واتساب', value: supportInfo.whatsapp, href: supportInfo.whatsapp, icon: WhatsAppIcon, color: '#25D366' } : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string; href: string; icon: any; color: string }>
    : []

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
      const res = await fetch('/api/user/change-password', {
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold">الإعدادات</h1>
          <p className="text-sm text-muted-foreground">إدارة حسابك وتفضيلاتك</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs transition-all ${
              activeTab === tab.key
                ? 'bg-gold/10 text-gold border border-gold/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && !showChangeEmail && (
        <div className="glass-card p-5 space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold">المعلومات الشخصية</h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">الاسم الكامل</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="glass-input h-12 text-base"
                placeholder="أدخل اسمك الكامل"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">البريد الإلكتروني</Label>
                <button
                  type="button"
                  onClick={() => setShowChangeEmail(true)}
                  className="text-xs text-gold hover:text-gold/80 font-medium transition-colors"
                >
                  تغيير
                </button>
              </div>
              <Input
                value={user?.email || ''}
                disabled
                className="glass-input h-12 text-base opacity-60"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">رقم الهاتف</Label>
              <Input
                value={user?.phone ? `+967 ${user.phone}` : 'غير محدد'}
                disabled
                className="glass-input h-12 text-base opacity-60"
                dir="ltr"
              />
            </div>
            {user?.accountNumber && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">رقم الحساب</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={String(user.accountNumber)}
                    disabled
                    className="glass-input h-12 text-base opacity-60 font-mono font-bold"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(String(user.accountNumber!))
                      setCopiedAccount(true)
                      toast.success('تم نسخ رقم الحساب')
                      setTimeout(() => setCopiedAccount(false), 2000)
                    }}
                    className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center hover:bg-gold/20 transition-colors flex-shrink-0"
                  >
                    {copiedAccount ? (
                      <CheckIcon className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gold" />
                    )}
                  </button>
                </div>
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التغييرات'}
            </Button>
          </form>

          {/* Change Email Button */}
          <div className="pt-3 border-t border-white/5">
            <button
              onClick={() => setShowChangeEmail(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-gold" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">تغيير البريد الإلكتروني</p>
                  <p className="text-xs text-muted-foreground">تحديث البريد الإلكتروني المرتبط بحسابك</p>
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
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold">تغيير كلمة المرور</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">كلمة المرور الحالية</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="glass-input h-12 text-base pl-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="glass-input h-12 text-base pl-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تغيير كلمة المرور'}
            </Button>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && !show2FASettings && (
        <div className="glass-card p-5 space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold">الأمان والحماية</h3>

          {/* 2FA Status Card */}
          <button
            onClick={() => setShow2FASettings(true)}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                user?.twoFactorEnabled ? 'bg-green-500/10' : 'bg-white/5'
              }`}>
                {user?.twoFactorEnabled ? (
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                ) : (
                  <Shield className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">المصادقة الثنائية</p>
                <p className="text-xs text-muted-foreground">
                  {user?.twoFactorEnabled ? 'مفعلة - حسابك محمي' : 'غير مفعلة - قم بتفعيلها للحماية'}
                </p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>

          <p className="text-xs text-muted-foreground leading-relaxed">
            المصادقة الثنائية تضيف طبقة حماية إضافية لحسابك. عند تفعيلها، سيتم إرسال رمز تحقق إلى بريدك الإلكتروني في كل مرة تسجل الدخول.
          </p>
        </div>
      )}

      {activeTab === 'security' && show2FASettings && (
        <TwoFactorSettings onClose={() => setShow2FASettings(false)} />
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-4 animate-fade-in">
          {/* View notifications */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-bold">الإشعارات</h3>
            <button
              onClick={() => setScreen('notifications')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-sm">عرض جميع الإشعارات</span>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
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
                      const res = await fetch('/api/notifications/test', {
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
        <div className="space-y-4 animate-fade-in">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-bold">حول التطبيق</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">التطبيق</span>
                <span className="font-medium gold-text cursor-pointer select-none" onClick={handleDevTap}>فوركس يمني</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الإصدار</span>
                <span>3.6.2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الشبكة</span>
                <span>USDT TRC20</span>
              </div>
            </div>
          </div>

          {/* Support Info Section */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-bold">الدعم والمساعدة</h3>
            {supportItems.length > 0 ? (
              <div className="space-y-2">
                {supportItems.map((item) => (
                  <a
                    key={item.key}
                    href={item.href}
                    target={item.key === 'email' || item.key === 'phone' ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <item.icon size={18} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-bold">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate" dir="ltr" style={{ textAlign: 'right' }}>{item.value}</p>
                    </div>
                    <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                لا توجد معلومات دعم متاحة حالياً
              </p>
            )}
          </div>
        </div>
      )}

      {/* Logout with Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogTrigger asChild>
          <button
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
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
              className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all"
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
