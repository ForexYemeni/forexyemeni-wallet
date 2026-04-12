'use client'

import { useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Shield, Loader2, Check, X, Lock, ChevronDown, AlertTriangle } from 'lucide-react'
import PinDots from '@/components/ui/PinDots'
import StepProgress from '@/components/ui/StepProgress'

const STEPS = [
  { key: 'enter', label: 'أدخل الرمز' },
  { key: 'confirm', label: 'تأكيد الرمز' },
]

export default function SetPinScreen() {
  const { user, token, setAuth, logout } = useAuthStore()
  const [step, setStep] = useState<'enter' | 'confirm'>('enter')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [pinError, setPinError] = useState(false)
  const [mismatchError, setMismatchError] = useState(false)
  const [showSecurityTips, setShowSecurityTips] = useState(false)

  const isValid = /^\d{4,6}$/.test(pin)
  const isMatch = pin === confirmPin && pin.length > 0

  const requirements = [
    { label: '4-6 أرقام', met: /^\d{4,6}$/.test(pin) },
    { label: 'تطابق الرمز', met: isMatch },
  ]

  const handlePinComplete = useCallback(
    (value: string) => {
      setPin(value)
      // Validate minimum length
      if (value.length < 4) {
        setPinError(true)
        return
      }
      setPinError(false)
      // Short delay before transitioning to confirm step
      setTimeout(() => {
        setStep('confirm')
      }, 400)
    },
    []
  )

  const handleConfirmComplete = useCallback(
    (value: string) => {
      setConfirmPin(value)
      if (value !== pin) {
        setMismatchError(true)
        // Clear mismatch after shake animation
        setTimeout(() => {
          setMismatchError(false)
          setConfirmPin('')
        }, 600)
      } else {
        setMismatchError(false)
      }
    },
    [pin]
  )

  const handlePinChange = useCallback(
    (value: string) => {
      setPin(value)
      if (value.length >= 4) {
        setPinError(false)
      }
    },
    []
  )

  const handleConfirmChange = useCallback(
    (value: string) => {
      setConfirmPin(value)
      if (mismatchError) {
        setMismatchError(false)
      }
    },
    [mismatchError]
  )

  const handleBackToStep1 = useCallback(() => {
    setStep('enter')
    setConfirmPin('')
    setMismatchError(false)
  }, [])

  const handleSubmit = async () => {
    if (!isValid || !isMatch) {
      toast.error('يرجى إدخال رمز صحيح ومطابق')
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/set-pin', {
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
        <div className="glass-card p-6 space-y-5">
          {/* Step Progress Indicator */}
          <div className="flex justify-center">
            <StepProgress steps={STEPS} currentStep={step} />
          </div>

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl gold-gradient flex items-center justify-center animate-pulse-gold">
              <Shield className="w-8 h-8 text-gray-900" />
            </div>
            <h2 className="text-xl font-bold gold-text">إعداد رمز الحماية (PIN)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              سيتم استخدام هذا الرمز عند إجراء عمليات السحب والتحويل لتأمين حسابك
            </p>
          </div>

          {/* Step 1: Enter PIN */}
          <div className={`transition-all duration-300 ${step === 'enter' ? 'animate-fade-in' : 'hidden'}`}>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">أدخل رمز PIN</p>
                <p className="text-xs text-muted-foreground">أدخل 4 إلى 6 أرقام كرمز حماية</p>
              </div>

              <PinDots
                length={6}
                value={pin}
                onChange={handlePinChange}
                onComplete={handlePinComplete}
                error={pinError}
              />

              {/* PIN Strength Indicator */}
              {pin.length > 0 && (
                <div className="flex justify-center gap-3 mt-3 animate-fade-in">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        n <= pin.length
                          ? 'w-6 bg-gold shadow-sm shadow-gold/30'
                          : 'w-3 bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* PIN length warning */}
              {pin.length > 0 && pin.length < 4 && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 animate-fade-in">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>يجب أن يكون 4 أرقام على الأقل</span>
                </div>
              )}

              {/* Proceed hint */}
              {isValid && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-green-400 animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>رمز صالح — جاري الانتقال للتأكيد...</span>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Confirm PIN */}
          <div className={`transition-all duration-300 ${step === 'confirm' ? 'animate-fade-in' : 'hidden'}`}>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">تأكيد رمز PIN</p>
                <p className="text-xs text-muted-foreground">أعد إدخال الرمز للتأكيد</p>
              </div>

              <PinDots
                length={6}
                value={confirmPin}
                onChange={handleConfirmChange}
                onComplete={handleConfirmComplete}
                error={mismatchError}
              />

              {/* Match indicator */}
              {isMatch && confirmPin.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-green-400 animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>الرمز متطابق ✓</span>
                </div>
              )}

              {isMatch && confirmPin.length > 0 && (
                <div className="flex justify-center mt-3 animate-fade-in">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center success-anim-bounce">
                      <Check className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="success-anim-ring" />
                  </div>
                </div>
              )}

              {/* Mismatch indicator */}
              {mismatchError && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-red-400 animate-shake-error">
                  <X className="w-3.5 h-3.5" />
                  <span>الرمز غير متطابق — حاول مرة أخرى</span>
                </div>
              )}

              {/* Back button to step 1 */}
              <button
                type="button"
                onClick={handleBackToStep1}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                ← تعديل الرمز
              </button>
            </div>
          </div>

          {/* Requirements checklist — visible in confirm step */}
          <div className={`transition-all duration-300 ${step === 'confirm' ? 'animate-fade-in' : 'hidden'}`}>
            <div className="space-y-2">
              {requirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {req.met ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className={req.met ? 'text-green-400' : 'text-muted-foreground'}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || !isValid || !isMatch}
            className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:grayscale-[30%] disabled:cursor-not-allowed flex items-center justify-center gap-2 tap-effect"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>تأكيد إعداد الرمز</span>
              </>
            )}
          </button>

          {/* Security Tips Card (Collapsible) */}
          <div className="glass-card p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSecurityTips(!showSecurityTips)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">نصائح أمان</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${
                  showSecurityTips ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showSecurityTips ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="px-3.5 pb-3.5 space-y-2.5">
                {[
                  'لا تشارك رمز PIN مع أي شخص',
                  'استخدم أرقاماً يصعب تخمينها',
                  'تجنب استخدام تاريخ ميلادك أو أرقام متسلسلة',
                  'غيّر رمزك بشكل دوري للحفاظ على أمان حسابك',
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <div className="w-1 h-1 rounded-full bg-gold/40 mt-1.5 shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="text-center">
            <button
              onClick={logout}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
