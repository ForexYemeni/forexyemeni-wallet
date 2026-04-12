'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, ArrowRight, Gift, Mail, UserPlus, UserCheck, User, Lock, Check } from 'lucide-react'
import FloatingLabelInput from '@/components/ui/FloatingLabelInput'
import PinDots from '@/components/ui/PinDots'

const REGISTER_STEPS = [
  { key: 'email', label: 'البريد الإلكتروني', icon: Mail },
  { key: 'otp', label: 'التحقق', icon: UserCheck },
  { key: 'details', label: 'البيانات و PIN', icon: UserPlus },
]

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
      // Generate a random temporary password (will be replaced in step 3)
      const tempPassword = crypto.randomUUID().slice(0, 16) + '!Xy'
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName: '', password: tempPassword }),
      })
      const data = await res.json()

      if (data.success) {
        setPendingRegistration({ email, fullName: '', password: tempPassword })
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

  const getStepIndex = () => {
    switch (step) {
      case 'email': return 0
      case 'otp': return 1
      case 'details': return 2
      default: return 0
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto space-y-5 p-6 stagger-children">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-20 h-20 mx-auto rounded-2xl gold-gradient flex items-center justify-center gold-glow">
          <UserPlus className="w-10 h-10 text-gray-900" />
        </div>
        <div>
          <h1 className="text-2xl font-bold gold-text">إنشاء حساب جديد</h1>
          <p className="text-muted-foreground text-sm mt-1">أنشئ حسابك في محفظة فوركس يمني</p>
        </div>
      </div>

      {/* Step Progress Bar */}
      <div className="step-progress-bar">
        {REGISTER_STEPS.map((s, i) => {
          const currentIdx = getStepIndex()
          const isCompleted = i < currentIdx
          const isActive = i === currentIdx
          return (
            <div key={s.key} className="flex items-center">
              <div className="step-progress-item">
                <div className={`step-progress-circle ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className={`step-progress-label ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}>
                  {s.label}
                </span>
              </div>
              {i < REGISTER_STEPS.length - 1 && (
                <div className={`step-progress-connector ${isCompleted ? 'filled' : isActive ? 'current' : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {step === 'email' && (
        <form onSubmit={handleSendOtp} className="space-y-4 animate-fade-in">
          <FloatingLabelInput
            label="البريد الإلكتروني"
            type="email"
            placeholder=" "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
            dir="ltr"
            autoComplete="off"
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال رمز التحقق'}
          </Button>

          <div className="text-center pt-1">
            <p className="text-sm text-muted-foreground">
              لديك حساب بالفعل؟{' '}
              <button
                onClick={() => setScreen('login')}
                className="text-gold font-semibold hover:text-gold-light transition-colors underline underline-offset-2 decoration-gold/30 hover:decoration-gold"
              >
                تسجيل الدخول
              </button>
            </p>
          </div>
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

  useEffect(() => {
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
  }, [])

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

  // Circular progress for countdown
  const circumference = 2 * Math.PI * 14
  const progressOffset = circumference * (1 - countdown / 60)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Envelope icon */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center gold-glow">
          <Mail className="w-8 h-8 text-gold" />
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            أدخل رمز التحقق المرسل إلى
          </p>
          <p className="text-gold font-medium text-sm" dir="ltr">{email}</p>
        </div>
      </div>

      {/* OTP Inputs */}
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

      {/* Countdown Timer with Circular Progress */}
      {!canResend && (
        <div className="flex items-center justify-center gap-3">
          <div className="relative w-9 h-9">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2.5"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="#F0B90B"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gold">
              {countdown}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">ثانية متبقية</span>
        </div>
      )}

      {/* Didn't receive? */}
      <div className="glass-card p-3 text-center space-y-2">
        <p className="text-sm text-muted-foreground">لم تستلم الرمز؟</p>
        {canResend ? (
          <button
            onClick={handleResend}
            className="text-sm text-gold font-semibold hover:text-gold-light transition-colors"
          >
            إعادة إرسال رمز التحقق
          </button>
        ) : (
          <span className="text-xs text-muted-foreground/60">انتظر حتى ينتهي المؤقت</span>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          onClick={() => onVerify(otp.join(''))}
          disabled={loading || otp.some(d => !d)}
          className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق'}
        </Button>

        <button
          onClick={onBack}
          className="w-full text-sm text-muted-foreground hover:text-gold transition-colors flex items-center justify-center gap-1 py-1"
        >
          <ArrowRight className="w-3 h-3" />
          رجوع
        </button>
      </div>
    </div>
  )
}

function CompleteRegistration({ email }: { email: string }) {
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter')
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const { setAuth, setPendingRegistration } = useAuthStore()
  const formRef = useRef<HTMLFormElement>(null)
  const pinSectionRef = useRef<HTMLDivElement>(null)

  const isPinValid = pin.length >= 6 && /^\d+$/.test(pin)
  const isPinMatch = pin.length >= 6 && pin === confirmPin
  const canSubmit = fullName && password.length >= 8 && termsAccepted && pin.length >= 6 && confirmPin.length >= 6 && pin === confirmPin

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

  // Auto-scroll to PIN section when password is entered
  useEffect(() => {
    if (password.length >= 8 && pinSectionRef.current) {
      pinSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [password.length >= 8])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent form submission on Enter key
    if (e.key === 'Enter') {
      e.preventDefault()
    }
  }

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
    if (pin.length < 6 || !/^\d+$/.test(pin)) {
      toast.error('رمز PIN مكون من 6 أرقام على الأقل')
      return
    }
    if (pin !== confirmPin) {
      toast.error('رمز PIN غير متطابق')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, password, pin }),
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

  const passwordRules = [
    { label: '8 أحرف على الأقل', met: password.length >= 8 },
    { label: 'حرف كبير', met: /[A-Z]/.test(password) },
    { label: 'رقم', met: /\d/.test(password) },
    { label: 'رمز خاص', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ]

  const getStrengthLevel = () => {
    const met = passwordRules.filter(r => r.met).length
    if (met === 0 || password.length === 0) return { level: 0, textColor: 'text-muted-foreground', label: '' }
    if (met <= 1) return { level: 1, textColor: 'text-red-400', label: 'ضعيفة' }
    if (met <= 2) return { level: 2, textColor: 'text-amber-400', label: 'متوسطة' }
    if (met <= 3) return { level: 3, textColor: 'text-blue-400', label: 'جيدة' }
    return { level: 4, textColor: 'text-green-400', label: 'قوية جداً' }
  }
  const strength = getStrengthLevel()

  return (
    <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-4 animate-fade-in pb-2" style={{ scrollbarWidth: 'thin' }}>
    <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
      {/* Full Name */}
      <FloatingLabelInput
        label="الاسم الكامل"
        placeholder=" "
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        icon={<User className="w-5 h-5" />}
        autoComplete="off"
      />

      {/* Password */}
      <div className="float-label-group">
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder=" "
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="float-label-input pr-10 pl-12"
          dir="ltr"
          autoComplete="new-password"
        />
        <label className={`float-label ${password ? 'active' : ''}`}>
          كلمة المرور
        </label>
        <div className="float-label-icon">
          <Lock className="w-5 h-5" />
        </div>
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        {/* Password Strength Bar */}
        {password.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            <div className="pwd-strength-bar">
              {[0, 1, 2, 3].map((seg) => (
                <div key={seg} className={`pwd-strength-segment ${seg < strength.level ? 'active' : ''} ${seg < strength.level ? strength.level <= 1 ? 'weak' : strength.level <= 2 ? 'medium' : 'strong' : ''}`} />
              ))}
            </div>
            <p className={`text-xs font-medium ${strength.textColor} text-center`}>{strength.label}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {passwordRules.map((rule, i) => (
                <div key={i} className={`flex items-center gap-1.5 text-[11px] transition-colors ${rule.met ? 'text-green-400' : 'text-muted-foreground/50'}`}>
                  {rule.met ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PIN Setup */}
      <div ref={pinSectionRef} className="space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-gold/10 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-gold" />
          </div>
          <Label className="text-sm text-muted-foreground">
            رمز PIN
          </Label>
          <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-semibold">مطلوب</span>
        </div>

        {pinStep === 'enter' ? (
          <div className="space-y-3">
            <PinDots
              value={pin}
              onChange={(val) => {
                setPin(val)
                if (val.length >= 6) {
                  setTimeout(() => setPinStep('confirm'), 300)
                }
              }}
              isError={pin.length >= 6 && !/^\d+$/.test(pin)}
            />
            <p className="text-[11px] text-muted-foreground text-center">أدخل رمز PIN مكون من 6 أرقام</p>
          </div>
        ) : (
          <div className="space-y-3">
            <PinDots
              value={confirmPin}
              onChange={(val) => {
                setConfirmPin(val)
              }}
              isError={confirmPin.length >= 6 && pin !== confirmPin}
              isSuccess={confirmPin.length >= 6 && pin === confirmPin}
            />
            <p className="text-[11px] text-muted-foreground text-center">
              {confirmPin.length >= 6 && pin === confirmPin
                ? <span className="text-green-400">✓ متطابق</span>
                : confirmPin.length >= 6 && pin !== confirmPin
                  ? <span className="text-red-400">✗ غير متطابق</span>
                  : 'أعد إدخال رمز PIN للتأكيد'}
            </p>
            <button
              type="button"
              onClick={() => { setPinStep('enter'); setConfirmPin('') }}
              className="text-[11px] text-gold hover:underline block mx-auto"
            >
              تغيير رمز PIN
            </button>
          </div>
        )}
      </div>

      {/* Referral Code */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-gold/10 flex items-center justify-center">
            <Gift className="w-3.5 h-3.5 text-gold" />
          </div>
          <Label className="text-sm text-muted-foreground">
            كود الدعوة
          </Label>
          <span className="px-1.5 py-0.5 rounded-md bg-gold/10 text-gold text-[10px] font-semibold">اختياري</span>
        </div>
        <Input
          placeholder="أدخل كود الدعوة"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          className="glass-input h-11 text-sm"
          dir="ltr"
        />
      </div>

      {/* Terms & Conditions */}
      <div className="flex items-start gap-2.5 py-1">
        <button
          type="button"
          onClick={() => setTermsAccepted(!termsAccepted)}
          className={`terms-checkbox mt-0.5 ${termsAccepted ? 'checked' : ''}`}
        >
          {termsAccepted && <Check className="w-3 h-3" />}
        </button>
        <span className="text-xs text-muted-foreground leading-relaxed">
          أوافق على{' '}
          <button type="button" className="text-gold hover:underline">شروط الاستخدام</button>
          {' '}و{' '}
          <button type="button" className="text-gold hover:underline">سياسة الخصوصية</button>
        </span>
      </div>

      <Button
        type="submit"
        disabled={loading || !canSubmit}
        className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إنشاء الحساب'}
      </Button>
    </form>
    </div>
  )
}
