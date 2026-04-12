'use client'

import { apiFetch } from '@/lib/api-client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Send,
  ArrowRightLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  ArrowLeft,
  Mail,
  DollarSign,
  Phone,
  Hash,
  Copy,
  Check as CheckIcon,
  User,
  Wallet,
  ChevronLeft,
} from 'lucide-react'
import { triggerConfetti } from '@/components/ui/ConfettiEffect'
import PinDots from '@/components/ui/PinDots'
import SuccessResult from '@/components/ui/SuccessResult'

type Step = 'input' | 'confirm' | 'pin' | 'success' | 'error'

interface ReceiverInfo {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  accountNumber: number | null
}

interface QuickContact {
  name: string
  account: string
}

const QUICK_CONTACTS: QuickContact[] = []

function AnimatedAmount({ value }: { value: number }) {
  const [display, setDisplay] = useState('0.00')
  const prevValue = useRef(0)

  useEffect(() => {
    const start = prevValue.current
    const end = value
    const duration = 600
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (end - start) * eased
      setDisplay(current.toFixed(2))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
    prevValue.current = value
  }, [value])

  return (
    <p className="amount-display-lg amount-display-gold number-glow">{display}</p>
  )
}

const QUICK_AMOUNTS = [50, 100, 500]

const STEPS = [
  { key: 'input', label: 'البيانات', icon: ArrowRightLeft },
  { key: 'confirm', label: 'التأكيد', icon: CheckCircle },
  { key: 'pin', label: 'الأمان', icon: Shield },
]

export default function TransferScreen() {
  const { user, setScreen, updateBalance } = useAuthStore()
  const [step, setStep] = useState<Step>('input')
  const [receiver, setReceiver] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ senderBalance: number; receiverBalance: number } | null>(null)
  const [copiedAccount, setCopiedAccount] = useState(false)
  const [receiverInfo, setReceiverInfo] = useState<ReceiverInfo | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const transferAmount = parseFloat(amount) || 0

  // Trigger confetti on success
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => triggerConfetti(), 200)
      return () => clearTimeout(timer)
    }
  }, [step])

  const detectInputType = (value: string): 'email' | 'phone' | 'account' | '' => {
    const trimmed = value.trim()
    if (/^\d{4,10}$/.test(trimmed)) return 'account'
    if (trimmed.includes('@')) return 'email'
    if (/^[\d\+\-\s]{7,15}$/.test(trimmed.replace(/\s/g, ''))) return 'phone'
    return ''
  }

  const inputType = detectInputType(receiver)

  const getInputLabel = () => {
    if (!receiver) return 'بريد المستلم / رقم الهاتف / رقم الحساب'
    switch (inputType) {
      case 'email': return 'بريد إلكتروني'
      case 'phone': return 'رقم هاتف'
      case 'account': return 'رقم حساب'
      default: return 'بريد المستلم / رقم الهاتف / رقم الحساب'
    }
  }

  const getInputIcon = () => {
    switch (inputType) {
      case 'email': return Mail
      case 'phone': return Phone
      case 'account': return Hash
      default: return ArrowRightLeft
    }
  }

  const InputIcon = getInputIcon()

  const handleNext = async () => {
    setError('')
    if (!receiver.trim()) {
      setError('يرجى إدخال بريد أو رقم هاتف أو رقم حساب المستلم')
      return
    }
    if (!inputType) {
      setError('صيغة غير صحيحة. أدخل بريد إلكتروني أو رقم هاتف أو رقم حساب')
      return
    }
    if (!amount || transferAmount <= 0) {
      setError('يرجى إدخال مبلغ صحيح')
      return
    }
    if (transferAmount > (user?.balance || 0)) {
      setError('رصيدك غير كافي')
      return
    }

    setLookupLoading(true)
    try {
      const res = await apiFetch('/api/transfer/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver: receiver.trim(), senderId: user?.id }),
      })
      const data = await res.json()
      if (data.success) {
        setReceiverInfo(data.receiver)
        setStep('confirm')
      } else {
        setError(data.message)
      }
    } catch {
      setError('حدث خطأ في البحث عن المستلم')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleConfirm = () => {
    setStep('pin')
  }

  const handleTransfer = async (pinValue: string) => {
    if (!pinValue) {
      toast.error('يرجى إدخال رمز PIN')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await apiFetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user?.id,
          receiver: receiver.trim(),
          amount: transferAmount,
          token: useAuthStore.getState().token,
          pin: pinValue,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data)
        if (data.senderBalance !== undefined) {
          updateBalance(data.senderBalance)
        }
        setStep('success')
      } else {
        setError(data.message)
        setStep('error')
      }
    } catch {
      setError('حدث خطأ في الاتصال')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (step === 'confirm') setStep('input')
    else if (step === 'pin') setStep('confirm')
    else setScreen('dashboard')
  }

  const handleReset = () => {
    setStep('input')
    setReceiver('')
    setAmount('')
    setError('')
    setResult(null)
    setReceiverInfo(null)
  }

  const copyAccountNumber = () => {
    if (user?.accountNumber) {
      navigator.clipboard.writeText(String(user.accountNumber))
      setCopiedAccount(true)
      toast.success('تم نسخ رقم الحساب')
      setTimeout(() => setCopiedAccount(false), 2000)
    }
  }

  const handleQuickContactClick = (contact: QuickContact) => {
    setReceiver(contact.account)
  }

  const handleQuickAmountClick = (value: number) => {
    setAmount(String(value))
  }

  // Get step index for progress bar
  const getStepIndex = () => {
    switch (step) {
      case 'input': return 0
      case 'confirm': return 1
      case 'pin': return 2
      default: return 0
    }
  }

  // Success message
  const getSuccessMessage = () => {
    const receiverName = receiverInfo?.fullName || receiverInfo?.email || ''
    const parts = [`تم تحويل ${transferAmount.toFixed(2)} USDT إلى ${receiverName}`]
    if (result) {
      parts.push(`رصيدك الجديد: ${result.senderBalance.toFixed(2)} USDT`)
    }
    return parts.join('\n')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors haptic-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center gold-glow">
            <Send className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <h1 className="text-lg font-bold">تحويل بين المستخدمين</h1>
            <p className="text-xs text-muted-foreground">إرسال USDT إلى مستخدم آخر</p>
          </div>
        </div>
      </div>

      {/* Step Progress Bar — visible for confirm and pin steps */}
      {step !== 'success' && step !== 'error' && (
        <div className="step-progress-bar">
          {STEPS.map((s, i) => {
            const currentIdx = getStepIndex()
            const isCompleted = i < currentIdx
            const isActive = i === currentIdx
            return (
              <div key={s.key} className="flex items-center">
                <div className="step-progress-item">
                  <div className={`step-progress-circle ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}>
                    {isCompleted ? <CheckIcon className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <span className={`step-progress-label ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`step-progress-connector ${isCompleted ? 'filled' : isActive ? 'current' : ''}`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Balance Card */}
      {step !== 'success' && step !== 'error' && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-gold" />
              </div>
              <span className="text-sm text-muted-foreground">الرصيد المتاح</span>
            </div>
            <span className="text-xl font-bold gold-text">
              {(user?.balance ?? 0).toFixed(2)} <span className="text-xs font-medium text-muted-foreground ml-1">USDT</span>
            </span>
          </div>
          {user?.accountNumber && (
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs text-muted-foreground">رقم حسابك</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gold font-mono">{user.accountNumber}</span>
                <button
                  onClick={copyAccountNumber}
                  className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  {copiedAccount ? (
                    <CheckIcon className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP 1: INPUT ===== */}
      {step === 'input' && (
        <>
          {/* Quick Transfers Section */}
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-gold" />
              <h3 className="text-sm font-bold text-foreground">تحويلات سريعة</h3>
            </div>
            {QUICK_CONTACTS.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {QUICK_CONTACTS.map((contact) => (
                  <button
                    key={contact.account}
                    onClick={() => handleQuickContactClick(contact)}
                    className="glass-card card-hover flex-shrink-0 p-3 flex flex-col items-center gap-2 min-w-[80px] tap-effect"
                  >
                    <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-gray-900 font-bold text-sm">
                      {contact.name.charAt(0)}
                    </div>
                    <span className="text-[11px] font-medium text-foreground whitespace-nowrap">
                      {contact.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="glass-card p-4 text-center animate-fade-in">
                <div className="w-10 h-10 mx-auto rounded-xl bg-white/5 flex items-center justify-center mb-2">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">سيظهر هنا المستلمون المرسل إليهم سابقاً</p>
              </div>
            )}
          </div>

          <div className="glass-card p-5 space-y-5 animate-fade-in">
            {/* Receiver input */}
            <div className="float-label-group">
              <input
                type="text"
                placeholder=" "
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                className="float-label-input pl-12"
                dir="ltr"
                autoComplete="off"
              />
              <label className="float-label active">{getInputLabel()}</label>
              <div className="float-label-icon">
                <InputIcon className="w-5 h-5" />
              </div>
              {inputType && (
                <div className="float-validation-msg text-green-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {inputType === 'email' ? 'بريد إلكتروني صالح' : inputType === 'phone' ? 'رقم هاتف' : 'رقم حساب'}
                </div>
              )}
            </div>

            {/* Amount input */}
            <div className="float-label-group">
              <input
                type="number"
                placeholder=" "
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="float-label-input pl-12 text-lg font-bold"
                dir="ltr"
                min="0"
                step="0.01"
              />
              <label className="float-label active">المبلغ (USDT)</label>
              <div className="float-label-icon">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            {/* Quick Select Amount Buttons */}
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleQuickAmountClick(preset)}
                  className={`glass-input tap-effect px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    amount === String(preset)
                      ? 'gold-gradient text-gray-900'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 error-anim-shake">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleNext}
              disabled={lookupLoading}
              className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow flex items-center justify-center gap-2 disabled:opacity-50 haptic-btn"
            >
              {lookupLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري البحث...
                </>
              ) : (
                <>
                  متابعة
                  <ChevronLeft className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="info-banner-gold p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                يمكنك التحويل عبر: <span className="text-foreground font-medium">البريد الإلكتروني</span> أو <span className="text-foreground font-medium">رقم الهاتف</span> أو <span className="text-foreground font-medium">رقم الحساب</span>
              </p>
            </div>
          </div>
        </>
      )}

      {/* ===== STEP 2: CONFIRM ===== */}
      {step === 'confirm' && receiverInfo && (
        <div className="glass-card p-5 space-y-5 animate-fade-in">
          {/* Success badge */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center success-anim-bounce">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-base font-bold text-green-400">تم العثور على المستلم</h2>
          </div>

          {/* Transfer visualization with enhanced arrow */}
          <div className="flex items-center justify-center gap-4 py-3">
            {/* Sender */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center text-gray-900 font-bold text-sm">
                {(user?.fullName || 'م').charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-muted-foreground">أنت</span>
            </div>
            {/* Arrow with pulsing gold glow */}
            <div className="relative flex items-center justify-center w-20">
              <div className="absolute w-14 h-0.5 bg-gradient-to-l from-gold/50 to-gold/20" />
              <div className="relative z-10 flex items-center justify-center">
                <div className="absolute w-9 h-9 rounded-full bg-gold/20 animate-pulse blur-sm" />
                <ArrowRightLeft className="w-5 h-5 text-gold transfer-arrow-anim relative z-10" />
              </div>
              <div className="transfer-dot-flow" />
            </div>
            {/* Receiver */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 font-bold text-sm">
                {(receiverInfo.fullName || 'م').charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-muted-foreground">{receiverInfo.fullName || 'بدون اسم'}</span>
            </div>
          </div>

          {/* Receiver Info */}
          <div className="info-banner-blue p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{receiverInfo.fullName || 'بدون اسم'}</p>
                <p className="text-xs text-muted-foreground truncate" dir="ltr">{receiverInfo.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {receiverInfo.accountNumber && (
                <div className="p-2.5 rounded-lg bg-white/5">
                  <p className="text-[9px] text-muted-foreground">رقم الحساب</p>
                  <p className="text-sm font-bold font-mono text-gold">{receiverInfo.accountNumber}</p>
                </div>
              )}
              {receiverInfo.phone && (
                <div className="p-2.5 rounded-lg bg-white/5">
                  <p className="text-[9px] text-muted-foreground">رقم الهاتف</p>
                  <p className="text-sm font-medium" dir="ltr">{receiverInfo.phone.startsWith('967') ? '0' + receiverInfo.phone.slice(3) : receiverInfo.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Amount display */}
          <div className="glass-card p-4 space-y-3">
            <div className="text-center py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">مبلغ التحويل</p>
              <AnimatedAmount value={transferAmount} />
              <p className="text-xs text-muted-foreground mt-1">USDT</p>
            </div>
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">يُخصم من رصيدك</span>
                <span className="font-medium">{(user?.balance ?? 0).toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الرصيد بعد التحويل</span>
                <span className="font-bold text-blue-400">{((user?.balance ?? 0) - transferAmount).toFixed(2)} USDT</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 h-12 bg-white/5 border border-white/10 text-foreground font-medium rounded-xl hover:bg-white/10 transition-all haptic-btn"
            >
              رجوع
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow flex items-center justify-center gap-2 haptic-btn"
            >
              <Shield className="w-5 h-5" />
              تأكيد وإدخال PIN
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: PIN ===== */}
      {step === 'pin' && (
        <div className="glass-card p-5 space-y-5 animate-fade-in">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center gold-glow">
              <Shield className="w-8 h-8 text-gold" />
            </div>
            <h2 className="text-lg font-bold gold-text">أدخل رمز PIN</h2>
            <p className="text-sm text-muted-foreground">لإتمام عملية التحويل</p>
          </div>

          {/* Transfer summary */}
          {receiverInfo && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center space-y-1">
              <p className="text-xs text-muted-foreground">تحويل إلى <span className="text-foreground font-medium">{receiverInfo.fullName || receiverInfo.email}</span></p>
              <p className="text-xl font-bold gold-text">{transferAmount.toFixed(2)} USDT</p>
            </div>
          )}

          {/* PIN Dots — using PinDots component with auto-submit */}
          <PinDots
            length={6}
            onComplete={handleTransfer}
            disabled={loading}
          />

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gold" />
              <span className="text-sm text-muted-foreground">جاري التحويل...</span>
            </div>
          )}

          <button
            onClick={handleBack}
            disabled={loading}
            className="w-full h-12 bg-white/5 border border-white/10 text-foreground font-medium rounded-xl hover:bg-white/10 transition-all disabled:opacity-50 haptic-btn"
          >
            رجوع
          </button>
        </div>
      )}

      {/* ===== SUCCESS ===== */}
      {step === 'success' && (
        <div className="glass-card p-5 animate-fade-in">
          <SuccessResult
            type="success"
            title="تم التحويل بنجاح!"
            message={getSuccessMessage()}
            actionLabel="تحويل آخر"
            onAction={handleReset}
            secondaryLabel="العودة للرئيسية"
            onSecondary={() => setScreen('dashboard')}
          />
        </div>
      )}

      {/* ===== ERROR ===== */}
      {step === 'error' && (
        <div className="glass-card p-5 animate-fade-in">
          <SuccessResult
            type="error"
            title="فشل التحويل"
            message={error || 'حدث خطأ غير متوقع'}
            actionLabel="إعادة المحاولة"
            onAction={handleReset}
          />
        </div>
      )}
    </div>
  )
}
