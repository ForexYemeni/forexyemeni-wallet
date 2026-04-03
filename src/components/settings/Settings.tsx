'use client'

import { useState } from 'react'
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
  ChevronLeft,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'

export default function SettingsPage() {
  const { user, logout, updateUser, setScreen } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'notifications' | 'about'>('profile')
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [loading, setLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

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
      toast.success('تم تغيير كلمة المرور بنجاح')
      setCurrentPassword('')
      setNewPassword('')
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
    { key: 'notifications', label: 'الإشعارات', icon: Bell },
    { key: 'about', label: 'حول', icon: Shield },
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
      {activeTab === 'profile' && (
        <div className="glass-card p-5 space-y-4">
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
              <Label className="text-sm text-muted-foreground">البريد الإلكتروني</Label>
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
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التغييرات'}
            </Button>
          </form>
        </div>
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

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold">الإشعارات</h3>
          <button
            onClick={() => setScreen('notifications')}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="text-sm">عرض الإشعارات</span>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="p-3 rounded-xl bg-gold/5 text-xs text-muted-foreground">
            يتم إرسال إشعارات الإيداع والسحب والتحقق تلقائياً إلى حسابك.
          </div>
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold">حول التطبيق</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">التطبيق</span>
              <span className="font-medium gold-text">فوركس يمني</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإصدار</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الشبكة</span>
              <span>USDT TRC20</span>
            </div>
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
