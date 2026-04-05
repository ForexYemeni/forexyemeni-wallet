'use client'

import { useState } from 'react'
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
  Search,
} from 'lucide-react'

type Step = 'input' | 'confirm' | 'pin' | 'success' | 'error'

interface ReceiverInfo {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  accountNumber: number | null
}

export default function TransferScreen() {
  const { user, setScreen, updateBalance } = useAuthStore()
  const [step, setStep] = useState<Step>('input')
  const [receiver, setReceiver] = useState('')
  const [amount, setAmount] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ senderBalance: number; receiverBalance: number } | null>(null)
  const [copiedAccount, setCopiedAccount] = useState(false)
  const [receiverInfo, setReceiverInfo] = useState<ReceiverInfo | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const transferAmount = parseFloat(amount) || 0

  // Detect input type
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

  // Step 1: Validate input → lookup receiver → show confirm
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

    // Lookup receiver to show their info before PIN
    setLookupLoading(true)
    try {
      const res = await fetch('/api/transfer/lookup', {
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

  // Step 2: User confirmed receiver info → go to PIN
  const handleConfirm = () => {
    setStep('pin')
    setPin('')
  }

  // Step 3: Enter PIN → execute transfer
  const handleTransfer = async () => {
    if (!pin) {
      toast.error('يرجى إدخال رمز PIN')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user?.id,
          receiver: receiver.trim(),
          amount: transferAmount,
          token: useAuthStore.getState().token,
          pin,
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
    setPin('')
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center gold-glow">
            <Send className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold">تحويل بين المستخدمين</h1>
            <p className="text-sm text-muted-foreground">إرسال USDT إلى مستخدم آخر</p>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      {step !== 'success' && step !== 'error' && (
        <div className="glass-card p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gold" />
              <span className="text-sm text-muted-foreground">رصيدك المتاح</span>
            </div>
            <span className="text-lg font-bold gold-text">
              {(user?.balance ?? 0).toFixed(2)} USDT
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

      {/* Step: Input */}
      {step === 'input' && (
        <div className="glass-card p-6 rounded-xl space-y-5">
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <InputIcon className="w-4 h-4 text-gold" />
              {getInputLabel()}
            </label>
            <input
              type="text"
              placeholder="example@email.com  أو  100001  أو  +967..."
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              className="w-full h-12 rounded-xl glass-input px-4 text-sm"
              dir="ltr"
            />
            {inputType && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-green-400">
                  {inputType === 'email' ? 'بريد إلكتروني' : inputType === 'phone' ? 'رقم هاتف' : 'رقم حساب'}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gold" />
              المبلغ (USDT)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-12 rounded-xl glass-input px-4 text-sm text-lg font-bold"
              dir="ltr"
              min="0"
              step="0.01"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleNext}
            disabled={lookupLoading}
            className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {lookupLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري البحث عن المستلم...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-5 h-5" />
                متابعة
              </>
            )}
          </button>

          {/* Help text */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              يمكنك التحويل عبر: <span className="text-foreground font-medium">البريد الإلكتروني</span> أو <span className="text-foreground font-medium">رقم الهاتف</span> أو <span className="text-foreground font-medium">رقم الحساب</span>
            </p>
          </div>
        </div>
      )}

      {/* Step: Confirm — shows receiver info */}
      {step === 'confirm' && receiverInfo && (
        <div className="glass-card p-6 rounded-xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-lg font-bold text-green-400">تم العثور على المستلم</h2>
          </div>

          {/* Receiver Info Card */}
          <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <User className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold">{receiverInfo.fullName || 'بدون اسم'}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{receiverInfo.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {receiverInfo.accountNumber && (
                <div className="p-2.5 rounded-lg bg-white/5">
                  <p className="text-[10px] text-muted-foreground">رقم الحساب</p>
                  <p className="text-sm font-bold font-mono text-gold">{receiverInfo.accountNumber}</p>
                </div>
              )}
              {receiverInfo.phone && (
                <div className="p-2.5 rounded-lg bg-white/5">
                  <p className="text-[10px] text-muted-foreground">رقم الهاتف</p>
                  <p className="text-sm font-medium" dir="ltr">+967 {receiverInfo.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Transfer Details */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">المبلغ</span>
              <span className="text-xl font-bold gold-text">{transferAmount.toFixed(2)} USDT</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">سيُخصم من رصيدك</span>
              <span className="text-sm font-medium">{(user?.balance ?? 0).toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">الرصيد بعد التحويل</span>
              <span className="text-sm font-bold text-blue-400">{((user?.balance ?? 0) - transferAmount).toFixed(2)} USDT</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 h-12 bg-white/5 border border-white/10 text-foreground font-medium rounded-xl hover:bg-white/10 transition-all"
            >
              رجوع
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow flex items-center justify-center gap-2"
            >
              <Shield className="w-5 h-5" />
              تأكيد وإدخال PIN
            </button>
          </div>
        </div>
      )}

      {/* Step: PIN */}
      {step === 'pin' && (
        <div className="glass-card p-6 rounded-xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-gold" />
            </div>
            <h2 className="text-lg font-bold gold-text">أدخل رمز PIN</h2>
            <p className="text-sm text-muted-foreground">لإتمام عملية التحويل</p>
          </div>

          {/* Reminder of transfer details */}
          {receiverInfo && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center space-y-1">
              <p className="text-xs text-muted-foreground">تحويل إلى <span className="text-foreground font-medium">{receiverInfo.fullName || receiverInfo.email}</span></p>
              <p className="text-lg font-bold gold-text">{transferAmount.toFixed(2)} USDT</p>
            </div>
          )}

          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                  pin.length > i
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                {pin.length > i ? '•' : ''}
              </div>
            ))}
          </div>

          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full h-12 rounded-xl glass-input px-4 text-center text-lg tracking-[1em] opacity-0 absolute -z-10"
            autoFocus
            dir="ltr"
          />

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              disabled={loading}
              className="flex-1 h-12 bg-white/5 border border-white/10 text-foreground font-medium rounded-xl hover:bg-white/10 transition-all"
            >
              رجوع
            </button>
            <button
              onClick={handleTransfer}
              disabled={loading || pin.length < 4}
              className="flex-1 h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  إرسال
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step: Success */}
      {step === 'success' && (
        <div className="glass-card p-6 rounded-xl text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-green-400">تم التحويل بنجاح!</h2>
            <p className="text-2xl font-bold gold-text">{transferAmount.toFixed(2)} USDT</p>
            {receiverInfo && (
              <p className="text-sm text-muted-foreground">
                إلى {receiverInfo.fullName || receiverInfo.email}
                {receiverInfo.accountNumber && (
                  <span className="text-gold font-mono mr-2">({receiverInfo.accountNumber})</span>
                )}
              </p>
            )}
          </div>

          {result && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">رصيدك الجديد</span>
                <span className="text-sm font-bold gold-text">{result.senderBalance.toFixed(2)} USDT</span>
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all"
          >
            تحويل آخر
          </button>
        </div>
      )}

      {/* Step: Error */}
      {step === 'error' && (
        <div className="glass-card p-6 rounded-xl text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-red-400">فشل التحويل</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
    </div>
  )
}
