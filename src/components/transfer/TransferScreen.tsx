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
} from 'lucide-react'

type Step = 'input' | 'confirm' | 'pin' | 'success' | 'error'

export default function TransferScreen() {
  const { user, setScreen, updateBalance } = useAuthStore()
  const [step, setStep] = useState<Step>('input')
  const [receiverEmail, setReceiverEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ senderBalance: number; receiverBalance: number } | null>(null)

  const transferAmount = parseFloat(amount) || 0

  const handleNext = () => {
    setError('')
    if (!receiverEmail.trim()) {
      setError('يرجى إدخال بريد المستلم')
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
    if (receiverEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setError('لا يمكنك التحويل لنفسك')
      return
    }
    setStep('confirm')
  }

  const handleConfirm = () => {
    setStep('pin')
    setPin('')
  }

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
          receiverEmail: receiverEmail.trim(),
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
    setReceiverEmail('')
    setAmount('')
    setPin('')
    setError('')
    setResult(null)
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
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gold" />
              <span className="text-sm text-muted-foreground">رصيدك المتاح</span>
            </div>
            <span className="text-lg font-bold gold-text">
              {(user?.balance ?? 0).toFixed(2)} USDT
            </span>
          </div>
        </div>
      )}

      {/* Step: Input */}
      {step === 'input' && (
        <div className="glass-card p-6 rounded-xl space-y-5">
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-gold" />
              بريد المستلم
            </label>
            <input
              type="email"
              placeholder="example@email.com"
              value={receiverEmail}
              onChange={(e) => setReceiverEmail(e.target.value)}
              className="w-full h-12 rounded-xl glass-input px-4 text-sm"
              dir="ltr"
            />
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
            className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="w-5 h-5" />
            متابعة
          </button>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div className="glass-card p-6 rounded-xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center">
              <ArrowRightLeft className="w-8 h-8 text-gold" />
            </div>
            <h2 className="text-lg font-bold gold-text">تأكيد التحويل</h2>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">إلى</span>
              <span className="text-sm font-medium" dir="ltr">{receiverEmail}</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">المبلغ</span>
              <span className="text-xl font-bold gold-text">{transferAmount.toFixed(2)} USDT</span>
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
              تأكيد
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

          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
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
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
            <p className="text-sm text-muted-foreground" dir="ltr">إلى {receiverEmail}</p>
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
