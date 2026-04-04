'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Eye, EyeOff, ShieldCheck, Phone } from 'lucide-react'

type Step = 'email' | 'otp' | 'new-password' | 'admin-otp' | 'admin-pin' | 'admin-new-password' | 'admin-no-pin' | 'admin-phone-number' | 'admin-new-email' | 'admin-new-email-otp' | 'admin-new-email-pin' | 'admin-new-email-password'

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [adminPin, setAdminPin] = useState('')
  const [adminNumber, setAdminNumber] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [adminUserId, setAdminUserId] = useState('')
  const [adminHasPhone, setAdminHasPhone] = useState(false)
  const { setScreen } = useAuthStore()

  useState(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true)
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  })

  const resetCountdown = () => {
    setCountdown(60)
    setCanResend(false)
  }

  // === NORMAL USER FLOW ===

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('يرجى إدخال البريد الإلكتروني')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (data.success) {
        if (data.isAdmin) {
          // Admin account - use PIN-based flow
          setAdminUserId(data.userId)
          if (data.hasPIN) {
            setStep('admin-otp')
            toast.success(data.message)
          } else {
            // Admin has no PIN set
            setAdminHasPhone(!!data.hasPhone)
            setStep('admin-no-pin')
          }
        } else {
          // Normal user flow
          setStep('otp')
          toast.success(data.message)
        }
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.some(d => !d)) {
      toast.error('يرجى إدخال رمز التحقق كاملاً')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp.join(''), isAdmin: false, newPassword }),
      })
      const data = await res.json()

      if (data.success) {
        setStep('new-password')
      } else {
        toast.error(data.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp.join(''), isAdmin: false, newPassword }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('تم تغيير كلمة المرور بنجاح')
        setScreen('login')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  // === ADMIN FLOW ===

  // Admin: after entering email, verify OTP then show PIN
  const handleAdminVerifyOtp = async () => {
    if (otp.some(d => !d)) {
      toast.error('يرجى إدخال رمز التحقق كاملاً')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp.join(''), isAdmin: true }),
      })
      const data = await res.json()

      if (data.success && data.otpVerified) {
        setStep('admin-pin')
        toast.success('تم التحقق من الرمز. أدخل رمز PIN.')
      } else {
        toast.error(data.message || 'رمز التحقق غير صحيح')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  // Admin: enter PIN + new password to reset
  const handleAdminResetWithPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminPin || adminPin.length < 4) {
      toast.error('يرجى إدخال رمز PIN (4 أرقام على الأقل)')
      return
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_reset_with_pin',
          userId: adminUserId,
          email,
          pin: adminPin,
          newPassword,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('تم تغيير كلمة المرور بنجاح')
        setScreen('login')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  // Admin: recovery with phone number - step 1: verify phone number against admin account
  const handleAdminCheckPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminNumber) {
      toast.error('يرجى إدخال رقم الإدارة')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNumber }),
      })
      const data = await res.json()

      if (data.success) {
        setAdminUserId(data.adminId)
        if (!data.hasPIN) {
          toast.error('لم يتم تعيين رمز PIN في حساب الإدارة. لا يمكن الاستعادة بالرقم بدون PIN.')
          return
        }
        toast.success('تم التحقق من الرقم. أدخل البريد الإلكتروني الجديد.')
        setStep('admin-new-email')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  // Admin: recovery with phone number - send OTP to new email
  const handleAdminSendNewEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail) {
      toast.error('يرجى إدخال البريد الإلكتروني الجديد')
      return
    }

    setLoading(true)
    try {
      // Use forgot-password API to send OTP to the new email
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      })
      const data = await res.json()

      if (data.success) {
        setStep('admin-new-email-otp')
        setOtp(['', '', '', '', '', ''])
        toast.success('تم إرسال رمز التحقق إلى البريد الإلكتروني الجديد')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  // Admin: verify new email OTP
  const handleAdminVerifyNewEmailOtp = async () => {
    if (otp.some(d => !d)) {
      toast.error('يرجى إدخال رمز التحقق كاملاً')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, code: otp.join(''), isAdmin: true }),
      })
      const data = await res.json()

      if (data.success && data.otpVerified) {
        setStep('admin-new-email-pin')
        toast.success('تم التحقق من البريد الإلكتروني الجديد. أدخل رمز PIN.')
      } else {
        toast.error(data.message || 'رمز التحقق غير صحيح')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  // Admin: recovery with phone number - final step: PIN + new password
  const handleAdminResetWithNumber = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminPin || adminPin.length < 4) {
      toast.error('يرجى إدخال رمز PIN (4 أرقام على الأقل)')
      return
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_reset_with_number',
          userId: adminUserId,
          adminNumber,
          newEmail,
          pin: adminPin,
          newPassword,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('تم استعادة الحساب بنجاح. يمكنك الدخول بالبريد الجديد.')
        setScreen('login')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async (resendEmail?: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail || email }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إعادة إرسال رمز التحقق')
        resetCountdown()
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }

  const handleChangeOtp = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      document.getElementById(`forgot-otp-${index + 1}`)?.focus()
    }
  }

  const handleKeyDownOtp = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`forgot-otp-${index - 1}`)?.focus()
    }
    if (e.key === 'Enter' && otp.every(d => d)) {
      // Dispatch based on current step
      if (step === 'admin-otp') handleAdminVerifyOtp()
      else if (step === 'admin-new-email-otp') handleAdminVerifyNewEmailOtp()
      else handleVerifyOtp()
    }
  }

  const renderOtpInputs = () => (
    <div className="flex justify-center gap-2" dir="ltr">
      {otp.map((digit, index) => (
        <input
          key={index}
          id={`forgot-otp-${index}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChangeOtp(index, e.target.value)}
          onKeyDown={(e) => handleKeyDownOtp(index, e)}
          className="otp-input-custom"
        />
      ))}
    </div>
  )

  const renderResendButton = (resendEmail?: string) => (
    <div className="flex items-center justify-between">
      <button onClick={() => step === 'admin-pin' || step === 'admin-new-email-pin' ? setStep('email') : setStep('email')} className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
        <ArrowRight className="w-3 h-3" />
        رجوع
      </button>
      {canResend ? (
        <button onClick={() => handleResend(resendEmail)} className="text-sm text-gold hover:text-gold-light transition-colors">
          إعادة الإرسال
        </button>
      ) : (
        <span className="text-sm text-muted-foreground">إعادة الإرسال بعد {countdown} ثانية</span>
      )}
    </div>
  )

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto space-y-6 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold gold-text">استعادة كلمة المرور</h1>
        <p className="text-muted-foreground text-sm">
          {step === 'email' && 'أدخل بريدك الإلكتروني لإرسال رمز التحقق'}
          {step === 'otp' && 'أدخل رمز التحقق المرسل إلى بريدك'}
          {step === 'new-password' && 'أدخل كلمة المرور الجديدة'}
          {step === 'admin-otp' && 'حساب إدارة: أدخل رمز التحقق المرسل إلى بريدك'}
          {step === 'admin-pin' && 'أدخل رمز PIN لإثبات هويتك'}
          {step === 'admin-no-pin' && 'حساب الإدارة: لا يمكن الاستعادة'}
          {step === 'admin-phone-number' && 'أدخل رقم الإدارة المضاف في التطبيق'}
          {step === 'admin-new-email' && 'أدخل البريد الإلكتروني الجديد'}
          {step === 'admin-new-email-otp' && 'أدخل رمز التحقق المرسل إلى البريد الجديد'}
          {step === 'admin-new-email-pin' && 'أدخل رمز PIN ثم كلمة المرور الجديدة'}
        </p>
      </div>

      {/* === STEP: EMAIL INPUT === */}
      {step === 'email' && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">البريد الإلكتروني</Label>
            <Input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input h-12 text-base"
              dir="ltr"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال رمز التحقق'}
          </Button>
        </form>
      )}

      {/* === NORMAL USER: OTP === */}
      {step === 'otp' && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gold font-medium text-sm" dir="ltr">{email}</p>
          </div>
          {renderOtpInputs()}
          <div className="space-y-3">
            <Button
              onClick={handleVerifyOtp}
              disabled={loading || otp.some(d => !d)}
              className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق'}
            </Button>
            {renderResendButton()}
          </div>
        </div>
      )}

      {/* === NORMAL USER: NEW PASSWORD === */}
      {step === 'new-password' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">كلمة المرور الجديدة</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="8 أحرف على الأقل"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input h-12 text-base pl-10"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تغيير كلمة المرور'}
          </Button>
        </form>
      )}

      {/* === ADMIN: NO PIN SET - ACCOUNT LOCKED === */}
      {step === 'admin-no-pin' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3">
            <div className="flex items-center gap-2 text-red-400">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-bold text-sm">حساب الإدارة محمي</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              حساب الإدارة يستخدم نظام أمان متقدم (PIN). لم يتم تعيين رمز PIN بعد، لذلك لا يمكن تغيير كلمة المرور عبر البريد الإلكتروني فقط.
            </p>
            {!adminUserId && (
              <p className="text-xs text-muted-foreground">
                إذا تذكرت كلمة المرور، يمكنك الدخول وتعيين رمز PIN من الإعدادات.
              </p>
            )}
          </div>
          {adminHasPhone && (
            <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 text-xs space-y-2">
              <p className="text-gold font-medium">
                💡 لا يوجد رمز PIN، لذلك لا يمكن الاستعادة بالرقم حالياً.
              </p>
              <p className="text-muted-foreground">
                يجب تعيين رمز PIN أولاً من الإعدادات لتتمكن من استعادة الحساب بالرقم عند فقدان البريد.
              </p>
            </div>
          )}
          <Button
            onClick={() => setScreen('login')}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all"
          >
            العودة لتسجيل الدخول
          </Button>
        </div>
      )}

      {/* === ADMIN: VERIFY EMAIL OTP === */}
      {step === 'admin-otp' && (
        <div className="space-y-6">
          <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 text-xs text-gold text-center">
            🔒 حساب إدارة - مطلوب رمز PIN بعد التحقق
          </div>
          <div className="text-center">
            <p className="text-gold font-medium text-sm" dir="ltr">{email}</p>
          </div>
          {renderOtpInputs()}
          <div className="space-y-3">
            <Button
              onClick={handleAdminVerifyOtp}
              disabled={loading || otp.some(d => !d)}
              className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق من الرمز'}
            </Button>
            {renderResendButton()}
          </div>
          <div className="text-center">
            <button
              onClick={() => {
                setStep('admin-phone-number')
                setOtp(['', '', '', '', '', ''])
              }}
              className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center justify-center gap-1"
            >
              <Phone className="w-3 h-3" />
              فقدت البريد الإلكتروني؟ استعادة بالرقم
            </button>
          </div>
        </div>
      )}

      {/* === ADMIN: ENTER PIN + NEW PASSWORD === */}
      {step === 'admin-pin' && (
        <form onSubmit={handleAdminResetWithPin} className="space-y-4">
          <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 text-xs text-gold text-center">
            🔒 أدخل رمز PIN لكلمة المرور الجديدة
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">رمز PIN</Label>
            <Input
              type="password"
              maxLength={8}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              className="glass-input h-12 text-base text-center tracking-[0.3em] font-mono"
              placeholder="••••"
              dir="ltr"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">كلمة المرور الجديدة (8 أحرف على الأقل)</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="أدخل كلمة المرور الجديدة"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input h-12 text-base pl-10"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading || !adminPin || adminPin.length < 4 || !newPassword || newPassword.length < 8}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تغيير كلمة المرور'}
          </Button>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep('email')} className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              رجوع
            </button>
          </div>
        </form>
      )}

      {/* === ADMIN: PHONE NUMBER RECOVERY === */}
      {step === 'admin-phone-number' && (
        <form onSubmit={handleAdminCheckPhone} className="space-y-4">
          <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 text-xs text-gold text-center">
            📱 استعادة حساب الإدارة بالرقم المسجل
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">رقم الإدارة (المضاف في التطبيق)</Label>
            <Input
              type="tel"
              value={adminNumber}
              onChange={(e) => setAdminNumber(e.target.value)}
              className="glass-input h-12 text-base"
              placeholder="967XXXXXXXX"
              dir="ltr"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !adminNumber}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'التحقق من الرقم'}
          </Button>
          <button onClick={() => setStep('email')} className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            رجوع
          </button>
        </form>
      )}

      {/* === ADMIN: NEW EMAIL INPUT === */}
      {step === 'admin-new-email' && (
        <form onSubmit={handleAdminSendNewEmailOtp} className="space-y-4">
          <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 text-xs text-gold text-center">
            📧 سيتم إرسال رمز التحقق إلى البريد الجديد
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">البريد الإلكتروني الجديد</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="glass-input h-12 text-base"
              placeholder="new@email.com"
              dir="ltr"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !newEmail}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال رمز التحقق للبريد الجديد'}
          </Button>
          <button onClick={() => setStep('admin-phone-number')} className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            رجوع
          </button>
        </form>
      )}

      {/* === ADMIN: VERIFY NEW EMAIL OTP === */}
      {step === 'admin-new-email-otp' && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gold font-medium text-sm" dir="ltr">{newEmail}</p>
          </div>
          {renderOtpInputs()}
          <div className="space-y-3">
            <Button
              onClick={handleAdminVerifyNewEmailOtp}
              disabled={loading || otp.some(d => !d)}
              className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق من الرمز'}
            </Button>
            {renderResendButton(newEmail)}
          </div>
        </div>
      )}

      {/* === ADMIN: NEW EMAIL PIN + PASSWORD (FINAL STEP) === */}
      {step === 'admin-new-email-pin' && (
        <form onSubmit={handleAdminResetWithNumber} className="space-y-4">
          <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 text-xs text-gold text-center">
            🔒 أدخل رمز PIN وكلمة المرور الجديدة
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">رمز PIN</Label>
            <Input
              type="password"
              maxLength={8}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              className="glass-input h-12 text-base text-center tracking-[0.3em] font-mono"
              placeholder="••••"
              dir="ltr"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">كلمة المرور الجديدة (8 أحرف على الأقل)</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="أدخل كلمة المرور الجديدة"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input h-12 text-base pl-10"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-xs text-blue-400 text-center">
            سيتم تحديث البريد الإلكتروني إلى: <span dir="ltr">{newEmail}</span>
          </div>
          <Button
            type="submit"
            disabled={loading || !adminPin || adminPin.length < 4 || !newPassword || newPassword.length < 8}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'استعادة الحساب وتغيير كلمة المرور'}
          </Button>
          <button onClick={() => setStep('admin-new-email-otp')} className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            رجوع
          </button>
        </form>
      )}

      {/* Back to login (shown on non-flow steps) */}
      {(step === 'email' || step === 'admin-no-pin') && (
        <div className="text-center">
          <button
            onClick={() => setScreen('login')}
            className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center justify-center gap-1"
          >
            <ArrowRight className="w-3 h-3" />
            العودة لتسجيل الدخول
          </button>
        </div>
      )}
    </div>
  )
}
