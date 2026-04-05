'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Shield,
  Wallet,
  ArrowLeftRight,
  UserCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const STORAGE_KEY = 'forexyemeni-welcome-seen'

const TOTAL_SLIDES = 3

// ---------- slide data ----------

interface FeatureItem {
  icon: React.ReactNode
  title: string
  description: string
}

const featureItems: FeatureItem[] = [
  {
    icon: <Wallet className="w-6 h-6" />,
    title: 'محفظة USDT',
    description: 'أرسل واستقبل USDT بأمان عبر شبكة TRC-20 مع رسوم منخفضة',
  },
  {
    icon: <ArrowLeftRight className="w-6 h-6" />,
    title: 'تداول P2P',
    description: 'تداول مباشر مع المستخدمين الآخرين بأسعار تنافسية',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'معاملات آمنة',
    description: 'حماية متقدمة وتشفير كامل لجميع معاملاتك المالية',
  },
]

interface TipItem {
  icon: React.ReactNode
  title: string
  description: string
}

const tipItems: TipItem[] = [
  {
    icon: <CheckCircle2 className="w-5 h-5 text-gold" />,
    title: 'تأكيد البريد الإلكتروني',
    description: 'فعّل بريدك الإلكتروني لتفعيل جميع ميزات المحفظة',
  },
  {
    icon: <CheckCircle2 className="w-5 h-5 text-gold" />,
    title: 'إعداد رمز PIN',
    description: 'أنشئ رمز PIN سري لتأمين عمليات السحب والتحويل',
  },
  {
    icon: <CheckCircle2 className="w-5 h-5 text-gold" />,
    title: 'إكمال التحقق الشخصي',
    description: 'ارفع مستوى حسابك بتحديد الهوية لرفع حدود التداول',
  },
]

// ---------- animation helpers ----------

type Direction = 'forward' | 'backward'

interface SlideAnimation {
  entering: string
  exiting: string
}

function getAnimation(direction: Direction): SlideAnimation {
  // RTL layout: forward = slide to the left, backward = slide to the right
  if (direction === 'forward') {
    return {
      entering: 'animate-wiz-enter-left',
      exiting: 'animate-wiz-exit-left',
    }
  }
  return {
    entering: 'animate-wiz-enter-right',
    exiting: 'animate-wiz-exit-right',
  }
}

// ---------- component ----------

export default function WelcomeWizard({
  onComplete,
}: {
  onComplete: () => void
}) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animDirection, setAnimDirection] = useState<Direction>('forward')
  const [visibleSlide, setVisibleSlide] = useState(0)

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, [])

  const goNext = useCallback(() => {
    if (currentSlide >= TOTAL_SLIDES - 1 || isAnimating) return
    setAnimDirection('forward')
    setIsAnimating(true)
    // After exit animation completes, swap slide
    setTimeout(() => {
      setCurrentSlide((prev) => prev + 1)
      setVisibleSlide((prev) => prev + 1)
      setIsAnimating(false)
    }, 300)
  }, [currentSlide, isAnimating])

  const goPrev = useCallback(() => {
    if (currentSlide <= 0 || isAnimating) return
    setAnimDirection('backward')
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentSlide((prev) => prev - 1)
      setVisibleSlide((prev) => prev - 1)
      setIsAnimating(false)
    }, 300)
  }, [currentSlide, isAnimating])

  const handleFinish = useCallback(() => {
    markSeen()
    onComplete()
  }, [markSeen, onComplete])

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goNext()      // RTL: left = next
      if (e.key === 'ArrowRight') goPrev()      // RTL: right = prev
      if (e.key === 'Enter' && currentSlide === TOTAL_SLIDES - 1) handleFinish()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev, handleFinish, currentSlide])

  const animation = getAnimation(animDirection)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
      {/* Decorative background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gold/3 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Main card */}
        <div className="glass-card p-6 sm:p-8 gold-glow animate-scale-in overflow-hidden">
          {/* ---------- SLIDE CONTENT ---------- */}
          <div className="relative min-h-[380px] sm:min-h-[400px]">
            {/* Slide 0 — Welcome */}
            {visibleSlide === 0 && (
              <div
                key="slide-0"
                className={`absolute inset-0 flex flex-col items-center justify-center text-center space-y-6 ${
                  isAnimating ? animation.exiting : animation.entering
                }`}
              >
                {/* Logo / Icon */}
                <div className="w-24 h-24 rounded-3xl gold-gradient flex items-center justify-center gold-glow animate-pulse-gold">
                  <Wallet className="w-12 h-12 text-gray-900" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-bold gold-text leading-relaxed">
                    مرحباً بك في
                  </h1>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    ForexYemeni Wallet
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  محفظتك الرقمية لإدارة USDT والتداول بأمان وسهولة
                </p>
              </div>
            )}

            {/* Slide 1 — Features */}
            {visibleSlide === 1 && (
              <div
                key="slide-1"
                className={`absolute inset-0 flex flex-col items-center justify-center space-y-6 ${
                  isAnimating ? animation.exiting : animation.entering
                }`}
              >
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center">
                    <Shield className="w-7 h-7 text-gold" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold gold-text">
                    مميزات المحفظة
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    كل ما تحتاجه في مكان واحد
                  </p>
                </div>

                <div className="w-full space-y-3">
                  {featureItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 glass-card-hover transition-all"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                        {item.icon}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">
                          {item.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slide 2 — Getting Started */}
            {visibleSlide === 2 && (
              <div
                key="slide-2"
                className={`absolute inset-0 flex flex-col items-center justify-center space-y-6 ${
                  isAnimating ? animation.exiting : animation.entering
                }`}
              >
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center">
                    <UserCheck className="w-7 h-7 text-gold" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold gold-text">
                    ابدأ الآن
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    خطوات سريعة لتفعيل حسابك بالكامل
                  </p>
                </div>

                <div className="w-full space-y-3">
                  {tipItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">
                          {item.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ---------- NAVIGATION ---------- */}
          <div className="mt-6 space-y-4">
            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {/* Previous button (hidden on first slide) */}
              {currentSlide > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goPrev}
                  disabled={isAnimating}
                  className="flex-shrink-0 h-11 w-11 rounded-xl p-0 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              ) : (
                <div className="flex-shrink-0 w-11" />
              )}

              {/* Next / Start button */}
              {currentSlide < TOTAL_SLIDES - 1 ? (
                <Button
                  onClick={goNext}
                  disabled={isAnimating}
                  className="flex-1 h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow text-sm gap-2"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={isAnimating}
                  className="flex-1 h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow text-sm gap-2"
                >
                  <span>ابدأ الآن</span>
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (isAnimating || i === currentSlide) return
                    setAnimDirection(i > currentSlide ? 'forward' : 'backward')
                    setIsAnimating(true)
                    setTimeout(() => {
                      setCurrentSlide(i)
                      setVisibleSlide(i)
                      setIsAnimating(false)
                    }, 300)
                  }}
                  aria-label={`الانتقال إلى الشريحة ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentSlide
                      ? 'w-8 h-2.5 bg-gold'
                      : 'w-2.5 h-2.5 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>

            {/* Skip link */}
            {currentSlide < TOTAL_SLIDES - 1 && (
              <button
                onClick={handleFinish}
                className="block mx-auto text-xs text-muted-foreground hover:text-gold transition-colors"
              >
                تخطي المعاينة
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- utility for consumers ----------

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}
