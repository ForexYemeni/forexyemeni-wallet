'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, ArrowRight, Gift } from 'lucide-react'

export default function RegisterForm() {
  const [step, setStep] = useState<'email' | 'otp' | 'details'>('email')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setScreen, setPendingRegistration } = useAuthStore()

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('يرجى إدخال البريد الإلكتروني')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName: '', password: 'temppass123' }),
      })
      const data = await res.json()

      if (data.success) {
        setPendingRegistration({ email, fullName: '', password: 'temppass123' })
        setStep('otp')
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (code: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()

      if (data.success) {
        setStep('details')
        toast.success('تم تفعيل البريد الإلكتروني بنجاح')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في التحقق')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto space-y-6 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold gold-text">إنشاء حساب جديد</h1>
        <p className="text-muted-foreground text-sm">أنشئ حسابك في محفظة فوركس يمني</p>
      </div>

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

          <p className="text-sm text-muted-foreground text-center">
            لديك حساب بالفعل؟{' '}
            <button onClick={() => setScreen('login')} className="text-gold font-medium hover:text-gold-light transition-colors">
              تسجيل الدخول
            </button>
          </p>
        </form>
      )}

      {step === 'otp' && (
        <OtpStep email={email} loading={loading} onVerify={handleVerifyOtp} onBack={() => setStep('email')} />
      )}

      {step === 'details' && (
        <CompleteRegistration email={email} />
      )}
    </div>
  )
}

function OtpStep({ email, loading, onVerify, onBack }: {
  email: string
  loading: boolean
  onVerify: (code: string) => void
  onBack: () => void
}) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)

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

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
    if (e.key === 'Enter' && otp.every(d => d)) {
      onVerify(otp.join(''))
    }
  }

  const handleResend = async () => {
    try {
      const res = await fetch('/api/auth/resend-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إعادة إرسال رمز التحقق إلى بريدك الإلكتروني')
        setCountdown(60)
        setCanResend(false)
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-muted-foreground text-sm">
          أدخل رمز التحقق المرسل إلى
        </p>
        <p className="text-gold font-medium text-sm" dir="ltr">{email}</p>
      </div>

      <div className="flex justify-center gap-2" dir="ltr">
        {otp.map((digit, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="otp-input-custom"
          />
        ))}
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => onVerify(otp.join(''))}
          disabled={loading || otp.some(d => !d)}
          className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق'}
        </Button>

        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            رجوع
          </button>
          {canResend ? (
            <button onClick={handleResend} className="text-sm text-gold hover:text-gold-light transition-colors">
              إعادة الإرسال
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">إعادة الإرسال بعد {countdown} ثانية</span>
          )}
        </div>
      </div>
    </div>
  )
}

function CompleteRegistration({ email }: { email: string }) {
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth, setPendingRegistration } = useAuthStore()

  // Pre-fill referral code from URL ?ref=CODE
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      if (ref) {
        setReferralCode(ref.trim().toUpperCase())
      }
    } catch {}
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName || !password) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }
    if (password.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, password }),
      })
      const data = await res.json()

      if (data.success && data.user) {
        setAuth(data.user, data.token)
        setPendingRegistration(null)
        toast.success('مرحباً بك! تم إنشاء حسابك بنجاح')

        // Apply referral code if provided
        if (referralCode.trim()) {
          try {
            await fetch('/api/referral', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'apply_code', userId: data.user.id, referralCode: referralCode.trim() }),
            })
          } catch {
            // Referral code application is non-blocking
          }
        }
      } else {
        toast.error(data.message || 'حدث خطأ في إنشاء الحساب')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">الاسم الكامل</Label>
        <Input
          placeholder="أدخل اسمك الكامل"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="glass-input h-12 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">كلمة المرور</Label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="8 أحرف على الأقل"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

      {/* Referral Code - Optional */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5 text-gold" />
          كود الدعوة
          <span className="text-muted-foreground/60 text-xs">(اختياري)</span>
        </Label>
        <Input
          placeholder="أدخل كود الدعوة"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          className="glass-input h-12 text-base"
          dir="ltr"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إنشاء الحساب'}
      </Button>
    </form>
  )
}
