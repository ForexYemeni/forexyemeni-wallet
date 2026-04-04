'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react'

const TEMP_PASSWORD = 'admin123admin123admin123'

export default function ForceChangePassword() {
  const { user, token, setAuth, logout } = useAuthStore()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordStrength = (pass: string): { score: number; label: string; color: string } => {
    let score = 0
    if (pass.length >= 8) score++
    if (pass.length >= 12) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 1) return { score, label: 'ضعيفة', color: 'text-red-400' }
    if (score <= 2) return { score, label: 'متوسطة', color: 'text-yellow-400' }
    if (score <= 3) return { score, label: 'جيدة', color: 'text-blue-400' }
    return { score, label: 'قوية جداً', color: 'text-green-400' }
  }

  const strength = passwordStrength(newPassword)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword || !confirmPassword) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }

    if (newPassword === TEMP_PASSWORD) {
      toast.error('لا يمكن استخدام كلمة المرور المؤقتة. اختر كلمة مرور مختلفة.')
      return
    }

    if (newPassword.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('كلمة المرور غير متطابقة')
      return
    }

    if (strength.score < 2) {
      toast.error('كلمة المرور ضعيفة جداً. أضف أحرف كبيرة وأرقام ورموز.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/force-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          newPassword,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('تم تغيير كلمة المرور بنجاح! يمكنك الآن استخدام التطبيق.')
        // Update user state and go to dashboard
        if (user) {
          setAuth({ ...user, mustChangePassword: false }, token || '', false)
        }
      } else {
        toast.error(data.message || 'حدث خطأ في تغيير كلمة المرور')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src="/hero-bg.png" alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/90 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-4 animate-slide-up">
        {/* Warning Icon */}
        <div className="text-center space-y-4 mb-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center animate-pulse-gold">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-400">⚠️ تغيير كلمة المرور مطلوب</h1>
            <p className="text-muted-foreground text-sm mt-2">
              كلمة المرور الحالية مؤقتة ولا يمكن استخدامها مرة أخرى.
              <br />
              <span className="text-foreground/80 font-medium">يجب تغييرها الآن للمتابعة.</span>
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="glass-card p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  placeholder="8 أحرف على الأقل"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="glass-input h-12 text-base pl-10 border-red-500/30 focus:border-gold"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength */}
              {newPassword.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          strength.score >= level
                            ? strength.score <= 1 ? 'bg-red-400'
                              : strength.score <= 2 ? 'bg-yellow-400'
                                : strength.score <= 3 ? 'bg-blue-400'
                                  : 'bg-green-400'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${strength.color}`}>القوة: {strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">تأكيد كلمة المرور</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="أعد كتابة كلمة المرور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`glass-input h-12 text-base pl-10 ${
                    confirmPassword.length > 0 && newPassword !== confirmPassword
                      ? 'border-red-500/50'
                      : confirmPassword.length > 0 && newPassword === confirmPassword
                        ? 'border-green-500/50'
                        : ''
                  }`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword === confirmPassword && (
                <div className="flex items-center gap-1.5 text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-xs">كلمة المرور متطابقة</span>
                </div>
              )}
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400">كلمة المرور غير متطابقة</p>
              )}
            </div>

            {/* Password Requirements */}
            <div className="glass-card p-3 space-y-1.5 bg-white/[0.02]">
              <p className="text-xs font-medium text-muted-foreground mb-2">متطلبات كلمة المرور:</p>
              {[
                { label: '8 أحرف على الأقل', met: newPassword.length >= 8 },
                { label: 'حرف كبير واحد (A-Z)', met: /[A-Z]/.test(newPassword) },
                { label: 'رقم واحد (0-9)', met: /[0-9]/.test(newPassword) },
                { label: 'رمز واحد (!@#$%)', met: /[^A-Za-z0-9]/.test(newPassword) },
                { label: 'غير مساوية لكلمة المرور المؤقتة', met: newPassword.length > 0 && newPassword !== TEMP_PASSWORD },
              ].map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    req.met ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-muted-foreground/40'
                  }`}>
                    {req.met ? '✓' : '○'}
                  </div>
                  <span className={`text-xs ${req.met ? 'text-green-400' : 'text-muted-foreground/60'}`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || strength.score < 2}
              className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'تغيير كلمة المرور الآن'
              )}
            </Button>
          </form>

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full text-center text-sm text-muted-foreground hover:text-red-400 transition-colors py-2"
          >
            تسجيل الخروج والعودة لاحقاً
          </button>
        </div>
      </div>
    </div>
  )
}
