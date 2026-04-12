'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, Wallet, Smartphone, ShieldAlert, Lock, X, TriangleAlert, Mail, UserPlus } from 'lucide-react'
import { generateDeviceFingerprint, getDeviceName } from '@/lib/device-fingerprint'
import { playSuccessSound, playAlertSound, vibrate } from '@/lib/notification-sound'
import TwoFactorVerify from '@/components/auth/TwoFactorVerify'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<{ message: string; remaining: number | null; emailNotFound?: boolean } | null>(null)
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
      } else if (data.emailNotFound) {
        setLoginError({ message: data.message || 'البريد الإلكتروني غير مسجل', remaining: null, emailNotFound: true })
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
  const isEmailNotFound = loginError?.emailNotFound === true
  const isCritical = !isEmailNotFound && loginError && loginError.remaining !== null && loginError.remaining <= 1
  const isWarning = !isEmailNotFound && loginError && loginError.remaining !== null && loginError.remaining <= 3

  // Password strength indicator
  const getPasswordStrength = () => {
    const len = password.length
    if (len === 0) return { width: '0%', color: 'transparent', visible: false }
    if (len <= 3) return { width: '20%', color: '#ef4444', visible: true }
    if (len <= 7) return { width: '60%', color: '#f59e0b', visible: true }
    return { width: '100%', color: '#10b981', visible: true }
  }
  const pwdStrength = getPasswordStrength()

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
              background: isEmailNotFound
                ? 'linear-gradient(145deg, rgba(59,130,246,0.12) 0%, rgba(15,23,42,0.97) 100%)'
                : isLocked
                ? 'linear-gradient(145deg, rgba(239,68,68,0.15) 0%, rgba(15,23,42,0.97) 100%)'
                : isCritical
                ? 'linear-gradient(145deg, rgba(239,68,68,0.1) 0%, rgba(15,23,42,0.97) 100%)'
                : isWarning
                ? 'linear-gradient(145deg, rgba(249,115,22,0.1) 0%, rgba(15,23,42,0.97) 100%)'
                : 'linear-gradient(145deg, rgba(245,158,11,0.1) 0%, rgba(15,23,42,0.97) 100%)',
              border: isEmailNotFound
                ? '1px solid rgba(59,130,246,0.3)'
                : isLocked
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
                  isEmailNotFound
                    ? 'bg-blue-500/20 shadow-lg shadow-blue-500/20'
                    : isLocked
                    ? 'bg-red-500/20 shadow-lg shadow-red-500/20'
                    : isCritical
                    ? 'bg-red-500/15 shadow-lg shadow-red-500/10'
                    : isWarning
                    ? 'bg-orange-500/15 shadow-lg shadow-orange-500/10'
                    : 'bg-amber-500/15 shadow-lg shadow-amber-500/10'
                }`}
                style={{ animation: 'shakeError 0.5s ease-in-out 0.3s' }}
              >
                {isEmailNotFound ? (
                  <UserPlus className="w-9 h-9 text-blue-400" />
                ) : isLocked ? (
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
                style={{ animation: 'successRipple 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}
              />
            </div>

            {/* Error Message */}
            <div className="space-y-1">
              <h3
                className={`text-lg font-bold ${
                  isEmailNotFound
                    ? 'text-blue-400'
                    : isLocked || isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-amber-400'
                }`}
              >
                {isEmailNotFound ? 'البريد غير مسجل' : isLocked ? 'تم قفل الحساب' : 'كلمة المرور غير صحيحة'}
              </h3>
              {!isLocked && !isEmailNotFound && (
                <p className="text-sm text-muted-foreground">تحقق من كلمة المرور وحاول مرة أخرى</p>
              )}
              {isLocked && (
                <p className="text-sm text-muted-foreground">تم قفل الحساب مؤقتاً لحمايتك</p>
              )}
              {isEmailNotFound && (
                <>
                  <p className="text-sm text-muted-foreground" dir="ltr">{email}</p>
                  <p className="text-sm text-muted-foreground">ليس مسجلاً في النظام. هل تريد إنشاء حساب جديد؟</p>
                </>
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
                          animation: n <= loginError.remaining ? 'successRipple 0.3s ease-out' : 'none',
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
                      style={{ animation: 'successRipple 0.3s ease-out', animationDelay: `${n * 0.05}s` }}
                    />
                  ))}
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-2">
                  <p className="text-red-400 text-sm font-bold">🔒 القفل لمدة 15 دقيقة</p>
                  <p className="text-xs text-muted-foreground">انتظر 15 دقيقة أو غيّر الشبكة (WiFi ↔ بيانات) للمحاولة مرة أخرى</p>
                </div>
              </div>
            )}

            {/* Dismiss / Action Button */}
            {isEmailNotFound ? (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setLoginError(null)
                    setPendingRegistration({ email, fullName: '', password })
                    setScreen('register')
                  }}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gold hover:bg-gold-light text-gray-900"
                >
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    إنشاء حساب جديد
                  </span>
                </button>
                <button
                  onClick={dismissError}
                  className="w-full py-2.5 rounded-xl text-sm transition-all text-muted-foreground hover:text-foreground"
                >
                  تسجيل دخول ببريد آخر
                </button>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}

      {/* Login Form */}
      <div className="animate-slide-up w-full max-w-sm mx-auto space-y-6 p-6 relative">
        {/* Floating Particles Background */}
        <div className="login-particles">
          <div className="login-particle" style={{ width: 6, height: 6, top: '10%', left: '15%', '--duration': '5s', '--delay': '0s', '--drift': '15px' } as React.CSSProperties} />
          <div className="login-particle" style={{ width: 4, height: 4, top: '25%', left: '70%', '--duration': '7s', '--delay': '1s', '--drift': '-20px' } as React.CSSProperties} />
          <div className="login-particle" style={{ width: 5, height: 5, top: '55%', left: '30%', '--duration': '6s', '--delay': '2s', '--drift': '25px' } as React.CSSProperties} />
          <div className="login-particle" style={{ width: 3, height: 3, top: '70%', left: '80%', '--duration': '8s', '--delay': '0.5s', '--drift': '-15px' } as React.CSSProperties} />
          <div className="login-particle" style={{ width: 5, height: 5, top: '40%', left: '55%', '--duration': '6.5s', '--delay': '3s', '--drift': '20px' } as React.CSSProperties} />
          <div className="login-particle" style={{ width: 4, height: 4, top: '85%', left: '20%', '--duration': '7.5s', '--delay': '1.5s', '--drift': '-10px' } as React.CSSProperties} />
        </div>
        {/* ===== Enhanced Header with Animated Background ===== */}
        <div className="text-center space-y-4 animate-fade-in">
          {/* Logo area with animated background glow */}
          <div className="relative flex justify-center">
            {/* Subtle animated background glow */}
            <div
              className="absolute w-32 h-32 rounded-full opacity-40 animate-pulse-gold"
              style={{
                background: 'radial-gradient(circle, rgba(240, 185, 11, 0.15) 0%, transparent 70%)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
            {/* Decorative gold dots */}
            <div
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: 'rgba(240, 185, 11, 0.5)',
                top: '0px',
                right: '12px',
                animation: 'pulse-gold 2.5s ease-in-out infinite',
                animationDelay: '0s',
              }}
            />
            <div
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: 'rgba(240, 185, 11, 0.4)',
                top: '8px',
                right: '56px',
                animation: 'pulse-gold 3s ease-in-out infinite',
                animationDelay: '0.5s',
              }}
            />
            <div
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: 'rgba(240, 185, 11, 0.4)',
                bottom: '8px',
                left: '12px',
                animation: 'pulse-gold 2.8s ease-in-out infinite',
                animationDelay: '1s',
              }}
            />
            <div
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: 'rgba(240, 185, 11, 0.3)',
                top: '24px',
                left: '4px',
                animation: 'pulse-gold 3.2s ease-in-out infinite',
                animationDelay: '1.5s',
              }}
            />
            <div
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: 'rgba(240, 185, 11, 0.3)',
                bottom: '0px',
                right: '36px',
                animation: 'pulse-gold 2.6s ease-in-out infinite',
                animationDelay: '0.8s',
              }}
            />
            {/* Main logo */}
            <div className="relative w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center gold-glow animate-pulse-gold">
              <Wallet className="w-10 h-10 text-gray-900" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold gold-text">فوركس يمني</h1>
            <p className="text-muted-foreground text-sm mt-1">محفظة USDT الرقمية</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* ===== Email Field - Floating Label ===== */}
          <div className="float-label-group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="float-label-input pl-12"
              dir="ltr"
              placeholder=" "
              autoComplete="email"
            />
            <label className={`float-label ${email ? 'active' : ''}`}>
              البريد الإلكتروني
            </label>
            <div className="float-label-icon">
              <Mail className="w-[18px] h-[18px]" />
            </div>
          </div>

          {/* ===== Password Field - Floating Label ===== */}
          <div className="float-label-group">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="float-label-input pl-12"
              dir="ltr"
              placeholder=" "
              autoComplete="current-password"
            />
            <label className={`float-label ${password ? 'active' : ''}`}>
              كلمة المرور
            </label>
            <div className="float-label-icon">
              <Lock className="w-[18px] h-[18px]" />
            </div>
            {/* Show/Hide password button */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors z-10"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* ===== Password Strength Indicator (visual only) ===== */}
          {pwdStrength.visible && (
            <div className="animate-fade-in flex items-center gap-2 px-1" style={{ animationDuration: '0.15s' }}>
              <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: pwdStrength.width,
                    background: pwdStrength.color,
                    boxShadow: `0 0 8px ${pwdStrength.color}40`,
                  }}
                />
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow tap-effect"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'تسجيل الدخول'
            )}
          </Button>
        </form>

        {/* ===== Security Notice - Glass Card ===== */}
        <div className="glass-card p-3.5 flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-gold" />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Smartphone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground leading-relaxed">
              يتم التحقق من جهازك تلقائياً لحماية حسابك
            </span>
          </div>
        </div>

        {/* ===== Links Section ===== */}
        <div className="space-y-3 text-center animate-fade-in">
          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-transparent px-3 text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                أو
              </span>
            </div>
          </div>

          <button
            onClick={() => setScreen('forgot-password')}
            className="text-sm text-muted-foreground hover:text-gold transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(240,185,11,0.3)]"
          >
            نسيت كلمة المرور؟
          </button>
          <p className="text-sm text-muted-foreground">
            ليس لديك حساب؟{' '}
            <button
              onClick={() => setScreen('register')}
              className="text-gold font-medium hover:text-gold-light transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(240,185,11,0.3)]"
            >
              إنشاء حساب جديد
            </button>
          </p>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/40 pt-2 pb-4">الإصدار 3.7.0</p>
      </div>
    </>
  )
}
