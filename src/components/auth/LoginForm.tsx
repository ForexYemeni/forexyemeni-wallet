'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, Wallet } from 'lucide-react'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth, setScreen, setPendingRegistration } = useAuthStore()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (data.success) {
        setAuth(data.user, data.token, data.mustChangePassword)
        if (data.mustChangePassword) {
          toast.warning('⚠️ يجب تغيير كلمة المرور المؤقتة الآن!', { duration: 5000 })
        } else {
          toast.success('تم تسجيل الدخول بنجاح')
        }
      } else if (data.mustChangePassword) {
        toast.error('⚠️ كلمة المرور المؤقتة لم تعد صالحة. يجب تغييرها أولاً.', { duration: 5000 })
      } else if (data.needsVerification) {
        setPendingRegistration({ email, fullName: '', password })
        setScreen('verify-email')
        toast.error('يرجى تفعيل البريد الإلكتروني أولاً')
      } else {
        toast.error(data.message || 'حدث خطأ في تسجيل الدخول')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto space-y-6 p-6">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 mx-auto rounded-2xl gold-gradient flex items-center justify-center gold-glow">
          <Wallet className="w-10 h-10 text-gray-900" />
        </div>
        <div>
          <h1 className="text-2xl font-bold gold-text">فوركس يمني</h1>
          <p className="text-muted-foreground text-sm mt-1">محفظة USDT الرقمية</p>
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">كلمة المرور</Label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
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

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'تسجيل الدخول'
          )}
        </Button>
      </form>

      <div className="space-y-3 text-center">
        <button
          onClick={() => setScreen('forgot-password')}
          className="text-sm text-muted-foreground hover:text-gold transition-colors"
        >
          نسيت كلمة المرور؟
        </button>
        <p className="text-sm text-muted-foreground">
          ليس لديك حساب؟{' '}
          <button
            onClick={() => setScreen('register')}
            className="text-gold font-medium hover:text-gold-light transition-colors"
          >
            إنشاء حساب جديد
          </button>
        </p>
      </div>
    </div>
  )
}
