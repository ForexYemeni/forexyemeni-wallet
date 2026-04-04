'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Shield, Loader2, Eye, EyeOff, Check, X } from 'lucide-react'

export default function SetPinScreen() {
  const { user, token, setAuth, logout } = useAuthStore()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)

  const isValid = /^\d{4,6}$/.test(pin)
  const isMatch = pin === confirmPin && pin.length > 0

  const requirements = [
    { label: '4-6 أرقام', met: /^\d{4,6}$/.test(pin) },
    { label: 'تطابق الرمز', met: isMatch },
  ]

  const handleSubmit = async () => {
    if (!isValid || !isMatch) {
      toast.error('يرجى إدخال رمز صحيح ومطابق')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, pin }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إعداد رمز PIN بنجاح')
        setAuth({ ...user!, hasPin: true, mustChangePassword: false } as any, token || '')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في إعداد الرمز')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src="/hero-bg.png" alt="" className="w-full h-full object-cover opacity-30" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-4 animate-slide-up">
        <div className="glass-card p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl gold-gradient flex items-center justify-center gold-glow">
              <Shield className="w-8 h-8 text-gray-900" />
            </div>
            <h2 className="text-xl font-bold gold-text">إعداد رمز الحماية (PIN)</h2>
            <p className="text-sm text-muted-foreground">سيتم استخدام هذا الرمز عند إجراء عمليات السحب لتأمين حسابك</p>
          </div>

          {/* PIN Input */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">رمز PIN</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="أدخل 4-6 أرقام"
                  className="w-full h-12 rounded-xl glass-input px-4 pr-10 text-sm tracking-widest text-center text-lg"
                  dir="ltr"
                  maxLength={6}
                />
                <button onClick={() => setShowPin(!showPin)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" type="button">
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">تأكيد رمز PIN</label>
              <input
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="أعد إدخال الرمز"
                className="w-full h-12 rounded-xl glass-input px-4 text-sm tracking-widest text-center text-lg"
                dir="ltr"
                maxLength={6}
              />
            </div>

            {/* Requirements checklist */}
            <div className="space-y-2">
              {requirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {req.met ? <Check className="w-3.5 h-3.5 text-green-400" /> : <X className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className={req.met ? 'text-green-400' : 'text-muted-foreground'}>{req.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !isValid || !isMatch}
            className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تأكيد إعداد الرمز'}
          </button>

          {/* Logout */}
          <div className="text-center">
            <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
