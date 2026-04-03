'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<'email' | 'otp' | 'new-password'>('email')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
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

  const handleVerifyOtp = async () => {
    if (otp.some(d => !d)) {
      toast.error('يرجى إدخال رمز التحقق كاملاً')
      return
    }

    setLoading(true)
    try {
      // First verify it's a valid OTP (we'll use the reset-password endpoint)
      setStep('new-password')
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
        body: JSON.stringify({ email, code: otp.join(''), newPassword }),
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

  const handleResend = async () => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
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
      handleVerifyOtp()
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto space-y-6 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold gold-text">استعادة كلمة المرور</h1>
        <p className="text-muted-foreground text-sm">
          {step === 'email' && 'أدخل بريدك الإلكتروني لإرسال رمز التحقق'}
          {step === 'otp' && 'أدخل رمز التحقق المرسل إلى بريدك'}
          {step === 'new-password' && 'أدخل كلمة المرور الجديدة'}
        </p>
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
        </form>
      )}

      {step === 'otp' && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gold font-medium text-sm" dir="ltr">{email}</p>
          </div>
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
          <div className="space-y-3">
            <Button
              onClick={handleVerifyOtp}
              disabled={loading || otp.some(d => !d)}
              className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق'}
            </Button>
            <div className="flex items-center justify-between">
              <button onClick={() => setStep('email')} className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
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
      )}

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

      <div className="text-center">
        <button
          onClick={() => setScreen('login')}
          className="text-sm text-muted-foreground hover:text-gold transition-colors flex items-center justify-center gap-1"
        >
          <ArrowRight className="w-3 h-3" />
          العودة لتسجيل الدخول
        </button>
      </div>
    </div>
  )
}
