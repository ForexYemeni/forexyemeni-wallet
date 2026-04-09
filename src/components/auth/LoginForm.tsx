'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, Wallet, Smartphone, ShieldAlert, Lock, X, TriangleAlert } from 'lucide-react'
import { generateDeviceFingerprint, getDeviceName } from '@/lib/device-fingerprint'
import { playSuccessSound, playAlertSound, vibrate } from '@/lib/notification-sound'
import TwoFactorVerify from '@/components/auth/TwoFactorVerify'
import SecretRecoveryPanel from '@/components/auth/SecretRecoveryPanel'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<{ message: string; remaining: number } | null>(null)
  const [twoFAPending, setTwoFAPending] = useState<{ userId: string; pendingToken: string } | null>(null)
  const { setAuth, setScreen, setPendingRegistration, clearForLock } = useAuthStore()

  const dismissError = useCallback(() => setLoginError(null), [])

  // Auto-dismiss error after 6 seconds
  useEffect(() => {
    if (!loginError) return
    const timer = setTimeout(dismissError, 6000)
    return () => clearTimeout(timer)
  }, [loginError, dismissError])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }

    setLoading(true)
    try {
      // Generate device fingerprint
      let deviceFingerprint = ''
      let deviceName = ''
      try {
        deviceFingerprint = await generateDeviceFingerprint()
        deviceName = getDeviceName()
      } catch {
        // Fingerprint generation failed - continue without it
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceFingerprint, deviceName }),
      })
      const data = await res.json()

      if (data.success && data.requires2FA) {
        setTwoFAPending({ userId: data.userId, pendingToken: data.pendingToken })
        toast.info(data.message, { duration: 5000 })
      } else if (data.success) {
        setLoginError(null)
        setAuth(data.user, data.token, data.mustChangePassword)
        if (data.mustChangePassword) {
          toast.warning('⚠️ يجب تغيير كلمة المرور المؤقتة الآن!', { duration: 5000 })
        } else {
          toast.success('مرحباً بك، تم تسجيل الدخول بنجاح!')
          playSuccessSound('general').catch(() => {})
          vibrate([200, 100, 200])
        }
      } else if (data.lockedDevice) {
        toast.error(data.message, { duration: 8000 })
        playAlertSound('general').catch(() => {})
        clearForLock()
        setPendingRegistration({ email, fullName: '', password })
      } else if (data.mustChangePassword) {
        toast.error('⚠️ كلمة المرور المؤقتة لم تعد صالحة. يجب تغييرها أولاً.', { duration: 5000 })
        playAlertSound('general').catch(() => {})
      } else if (data.needsVerification) {
        setPendingRegistration({ email, fullName: '', password })
        setScreen('verify-email')
        toast.error('يرجى تفعيل البريد الإلكتروني أولاً')
      } else {
        const remaining = data.remaining ?? null
        setLoginError({ message: data.message || 'حدث خطأ في تسجيل الدخول', remaining })
        playAlertSound('general').catch(() => {})
      }
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  const handle2FASuccess = (token: string, userData: any) => {
    setTwoFAPending(null)
    setAuth(userData, token)
    toast.success('مرحباً بك، تم تسجيل الدخول بنجاح!')
    playSuccessSound('general').catch(() => {})
    vibrate([200, 100, 200])
  }

  const handle2FABack = () => {
    setTwoFAPending(null)
  }

  // Show 2FA verification screen
  if (twoFAPending) {
    return (
      <TwoFactorVerify
        userId={twoFAPending.userId}
        pendingToken={twoFAPending.pendingToken}
        onSuccess={handle2FASuccess}
        onBack={handle2FABack}
      />
    )
  }

  const isLocked = loginError?.remaining === 0
  const isCritical = loginError && loginError.remaining !== null && loginError.remaining <= 1
  const isWarning = loginError && loginError.remaining !== null && loginError.remaining <= 3

  return (
    <>
      {/* ===== CENTERED LOGIN ERROR MODAL ===== */}
      {loginError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
          onClick={dismissError}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal Card */}
          <div
            className="relative w-full max-w-xs sm:max-w-sm rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            style={{
              animation: 'scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              background: isLocked
                ? 'linear-gradient(145deg, rgba(239,68,68,0.15) 0%, rgba(15,23,42,0.97) 100%)'
                : isCritical
                ? 'linear-gradient(145deg, rgba(239,68,68,0.1) 0%, rgba(15,23,42,0.97) 100%)'
                : isWarning
                ? 'linear-gradient(145deg, rgba(249,115,22,0.1) 0%, rgba(15,23,42,0.97) 100%)'
                : 'linear-gradient(145deg, rgba(245,158,11,0.1) 0%, rgba(15,23,42,0.97) 100%)',
              border: isLocked
                ? '1px solid rgba(239,68,68,0.3)'
                : isCritical
                ? '1px solid rgba(239,68,68,0.2)'
                : isWarning
                ? '1px solid rgba(249,115,22,0.2)'
                : '1px solid rgba(245,158,11,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={dismissError}
              className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Animated Icon */}
            <div className="relative flex justify-center">
              <div
                className={`w-20 h-20 rounded-3xl flex items-center justify-center ${
                  isLocked
                    ? 'bg-red-500/20 shadow-lg shadow-red-500/20'
                    : isCritical
                    ? 'bg-red-500/15 shadow-lg shadow-red-500/10'
                    : isWarning
                    ? 'bg-orange-500/15 shadow-lg shadow-orange-500/10'
                    : 'bg-amber-500/15 shadow-lg shadow-amber-500/10'
                }`}
                style={{ animation: 'shake 0.5s ease-in-out 0.3s' }}
              >
                {isLocked ? (
                  <Lock className="w-9 h-9 text-red-400" />
                ) : isCritical ? (
                  <TriangleAlert className="w-9 h-9 text-red-400" />
                ) : (
                  <ShieldAlert className={`w-9 h-9 ${isWarning ? 'text-orange-400' : 'text-amber-400'}`} />
                )}
              </div>
              {/* Pulse ring */}
              <div
                className={`absolute inset-0 rounded-3xl ${
                  isLocked ? 'bg-red-500/10' : isWarning ? 'bg-orange-500/10' : 'bg-amber-500/10'
                }`}
                style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}
              />
            </div>

            {/* Error Message */}
            <div className="space-y-1">
              <h3
                className={`text-lg font-bold ${
                  isLocked || isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-amber-400'
                }`}
              >
                {isLocked ? 'تم قفل الحساب' : 'كلمة المرور غير صحيحة'}
              </h3>
              {!isLocked && (
                <p className="text-sm text-muted-foreground">تحقق من كلمة المرور وحاول مرة أخرى</p>
              )}
              {isLocked && (
                <p className="text-sm text-muted-foreground">تم قفل الحساب مؤقتاً لحمايتك</p>
              )}
            </div>

            {/* Remaining Attempts Dots */}
            {loginError.remaining !== null && loginError.remaining > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="flex flex-col items-center gap-1">
                      <div
                        className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                          n <= loginError.remaining
                            ? isCritical
                              ? 'bg-red-400 shadow-md shadow-red-400/30'
                              : isWarning
                              ? 'bg-orange-400 shadow-md shadow-orange-400/30'
                              : 'bg-amber-400 shadow-md shadow-amber-400/30'
                            : 'bg-white/10'
                        }`}
                        style={{
                          animation: n <= loginError.remaining ? 'dotPop 0.3s ease-out' : 'none',
                          animationDelay: `${n * 0.05}s`,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p
                  className={`text-sm font-bold ${
                    isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-amber-400'
                  }`}
                >
                  متبقي {loginError.remaining} من 5 محاولات
                </p>
                {loginError.remaining <= 2 && (
                  <p className="text-xs text-red-400/80 bg-red-500/10 px-3 py-1.5 rounded-full inline-block mx-auto">
                    ⚠️ سيتم قفل الحساب لمدة 15 دقيقة
                  </p>
                )}
              </div>
            )}

            {/* Locked Message */}
            {isLocked && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className="w-3.5 h-3.5 rounded-full bg-red-500/40"
                      style={{ animation: 'dotPop 0.3s ease-out', animationDelay: `${n * 0.05}s` }}
                    />
                  ))}
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-2">
                  <p className="text-red-400 text-sm font-bold">🔒 القفل لمدة 15 دقيقة</p>
                  <p className="text-xs text-muted-foreground">انتظر 15 دقيقة أو غيّر الشبكة (WiFi ↔ بيانات) للمحاولة مرة أخرى</p>
                </div>
              </div>
            )}

            {/* Dismiss Button */}
            <button
              onClick={dismissError}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                isLocked
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20'
                  : isCritical
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/15'
                  : isWarning
                  ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/15'
                  : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/15'
              }`}
            >
              حاول مرة أخرى
            </button>
          </div>
        </div>
      )}

      {/* Login Form */}
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

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground">
          <Smartphone className="w-4 h-4 text-gold flex-shrink-0" />
          <span>يتم التحقق من جهازك تلقائياً لحماية حسابك</span>
        </div>

        <div className="space-y-3 text-center">
          <SecretRecoveryPanel currentProjectId="forexyemeni-wallet-52bef" />
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

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.85) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px) rotate(-2deg); }
          30% { transform: translateX(8px) rotate(2deg); }
          45% { transform: translateX(-6px) rotate(-1deg); }
          60% { transform: translateX(6px) rotate(1deg); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
        @keyframes dotPop {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </>
  )
}
