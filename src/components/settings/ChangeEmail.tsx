'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Shield, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'

interface ChangeEmailProps {
  onClose: () => void
}

export default function ChangeEmail({ onClose }: ChangeEmailProps) {
  const { user, updateUser, token } = useAuthStore()

  const [step, setStep] = useState<'enter_email' | 'enter_code' | 'success'>('enter_email')
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Mask email: m***@gmail.com
  const maskEmail = (email: string) => {
    if (!email) return ''
    const [local, domain] = email.split('@')
    if (!domain) return email
    const firstChar = local.charAt(0)
    return `${firstChar}***@${domain}`
  }

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !password) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      toast.error('صيغة البريد الإلكتروني غير صحيحة')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/user/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_code',
          userId: user?.id,
          newEmail,
          password,
          token,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setStep('enter_code')
        setCountdown(60)
        setPassword('')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      toast.error('يرجى إدخال رمز التحقق المكون من 6 أرقام')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/user/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          userId: user?.id,
          code: fullCode,
          token,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setStep('success')
        // Update user email in store
        if (data.newEmail) {
          updateUser({ email: data.newEmail, emailVerified: true })
        }
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!newEmail) return
    setLoading(true)
    try {
      const res = await fetch('/api/user/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_code',
          userId: user?.id,
          newEmail,
          password: '', // Resend doesn't need password on backend, but let's handle gracefully
          token,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إعادة إرسال الرمز')
        setCountdown(60)
        setCode(['', '', '', '', '', ''])
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeInput = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      if (nextInput) nextInput.focus()
    }
  }, [code])

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      if (prevInput) prevInput.focus()
    }
  }

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setCode(pasted.split(''))
      const lastInput = document.getElementById('otp-5')
      if (lastInput) lastInput.focus()
    }
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="glass-card p-6 space-y-6 animate-fade-in">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-green-400">تم تغيير البريد الإلكتروني بنجاح</h3>
          <p className="text-sm text-muted-foreground">
            تم تحديث بريدك الإلكتروني الجديد
          </p>
        </div>
        <Button
          onClick={onClose}
          className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
        >
          العودة للإعدادات
        </Button>
      </div>
    )
  }

  // Enter code step
  if (step === 'enter_code') {
    return (
      <div className="glass-card p-5 space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('enter_email')}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-gold" />
            </div>
            <h3 className="text-sm font-bold">التحقق من البريد الجديد</h3>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed text-center">
          تم إرسال رمز التحقق إلى بريدك الإلكتروني الجديد
        </p>

        {/* OTP Inputs */}
        <form onSubmit={handleVerifyCode} className="space-y-5">
          <div className="flex justify-center gap-2" dir="ltr" onPaste={handleCodePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeInput(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                className="w-11 h-14 text-center text-xl font-bold rounded-xl glass-input border border-white/10 focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all"
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Countdown & Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-xs text-muted-foreground">
                إعادة الإرسال بعد <span className="text-gold font-bold">{countdown}</span> ثانية
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="text-xs text-gold hover:text-gold/80 font-medium transition-colors disabled:opacity-50"
              >
                إعادة إرسال الرمز
              </button>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || code.join('').length !== 6}
            className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد التغيير'}
          </Button>
        </form>
      </div>
    )
  }

  // Enter email step (default)
  return (
    <div className="glass-card p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
            <Mail className="w-4 h-4 text-gold" />
          </div>
          <h3 className="text-sm font-bold">تغيير البريد الإلكتروني</h3>
        </div>
      </div>

      {/* Current email display */}
      <div className="p-3 rounded-xl bg-white/5 space-y-1">
        <p className="text-xs text-muted-foreground">البريد الحالي</p>
        <p className="text-sm font-medium" dir="ltr">{maskEmail(user?.email || '')}</p>
      </div>

      <form onSubmit={handleSendCode} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">البريد الإلكتروني الجديد</Label>
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="glass-input h-12 text-base"
            dir="ltr"
            placeholder="example@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">كلمة المرور</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input h-12 text-base"
            dir="ltr"
            placeholder="أدخل كلمة المرور للتأكيد"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إرسال رمز التحقق'}
        </Button>
      </form>
    </div>
  )
}
