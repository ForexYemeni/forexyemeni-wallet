'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Shield, Mail, Key, Clock, RefreshCw, ArrowLeft } from 'lucide-react'

interface TwoFactorVerifyProps {
  userId: string
  pendingToken: string
  onSuccess: (token: string, user: any) => void
  onBack: () => void
}

export default function TwoFactorVerify({ userId, pendingToken, onSuccess, onBack }: TwoFactorVerifyProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [backupCode, setBackupCode] = useState('')
  const [showBackupInput, setShowBackupInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleCodeChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pasted = value.slice(0, 6).split('')
      const newCode = [...code]
      pasted.forEach((char, i) => {
        if (index + i < 6) newCode[index + i] = char
      })
      setCode(newCode)
      const nextIndex = Math.min(index + pasted.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [code])

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const codeToVerify = showBackupInput ? backupCode.trim() : code.join('')

    if (!codeToVerify) {
      toast.error('يرجى إدخال رمز التحقق')
      return
    }

    if (!showBackupInput && codeToVerify.length !== 6) {
      toast.error('يرجى إدخال الرمز كاملاً')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: codeToVerify,
          token: pendingToken,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('تم التحقق بنجاح!')
        onSuccess(data.token, data.user)
      } else {
        toast.error(data.message || 'رمز التحقق غير صحيح')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || resendLoading) return

    setResendLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token: pendingToken,
          action: 'send',
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('تم إعادة إرسال رمز التحقق')
        setCountdown(60)
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        toast.error(data.message || 'حدث خطأ')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-20 h-20 mx-auto rounded-2xl gold-gradient flex items-center justify-center gold-glow">
          <Shield className="w-10 h-10 text-gray-900" />
        </div>
        <div>
          <h1 className="text-2xl font-bold gold-text">المصادقة الثنائية</h1>
          <p className="text-muted-foreground text-sm mt-1">تم إرسال رمز التحقق إلى بريدك الإلكتروني</p>
        </div>
      </div>

      {/* Code Input */}
      {!showBackupInput ? (
        <div className="space-y-4">
          <div className="flex justify-center gap-3 dir-ltr" dir="ltr">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-xl font-bold glass-input rounded-xl border-2 border-white/10 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
                disabled={loading}
              />
            ))}
          </div>

          {/* Countdown and Resend */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                {countdown > 0
                  ? `يمكنك إعادة الإرسال بعد ${countdown} ثانية`
                  : 'يمكنك إعادة إرسال الرمز الآن'}
              </span>
            </div>
            <button
              onClick={handleResend}
              disabled={countdown > 0 || resendLoading}
              className="flex items-center justify-center gap-2 mx-auto text-sm text-gold hover:text-gold-light transition-colors disabled:text-muted-foreground disabled:cursor-not-allowed"
            >
              {resendLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              إعادة إرسال الرمز
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Input
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="glass-input h-14 text-center text-lg font-mono tracking-wider"
              dir="ltr"
              disabled={loading}
            />
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            أدخل كود الاسترداد إذا لم تتمكن من الوصول إلى بريدك الإلكتروني
          </p>
        </div>
      )}

      {/* Toggle backup code */}
      <button
        onClick={() => setShowBackupInput(!showBackupInput)}
        className="flex items-center justify-center gap-2 mx-auto text-sm text-muted-foreground hover:text-gold transition-colors"
      >
        <Key className="w-4 h-4" />
        {showBackupInput ? 'إدخال رمز البريد الإلكتروني' : 'استخدام كود استرداد'}
      </button>

      {/* Submit */}
      <Button
        onClick={handleVerify}
        disabled={loading}
        className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <span className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            تحقق
          </span>
        )}
      </Button>

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center justify-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        العودة لتسجيل الدخول
      </button>
    </div>
  )
}
