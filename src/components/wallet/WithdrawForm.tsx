'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  Info,
  ChevronLeft,
  Wallet,
  Building,
  CreditCard,
  ArrowRight,
} from 'lucide-react'

export default function WithdrawForm() {
  const { user } = useAuthStore()
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [step, setStep] = useState<'select' | 'details'>('select')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMethods, setLoadingMethods] = useState(true)
  // Dynamic fields for withdrawal details
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('')
  const [toAddress, setToAddress] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')

  useEffect(() => {
    fetchMethods()
  }, [])

  // Auto-set selectedNetwork when only one network option
  useEffect(() => {
    if (selectedMethod?.category === 'bank' && (selectedMethod?.type === 'atm_transfer' || selectedMethod?.type === 'bank_transfer')) {
      const opts = getNetworkOptions(selectedMethod.network)
      if (opts.length === 1) {
        setSelectedNetwork(opts[0])
      }
    }
  }, [selectedMethod])

  const fetchMethods = async () => {
    setLoadingMethods(true)
    try {
      const res = await fetch('/api/payment-methods?purpose=withdrawal')
      const data = await res.json()
      if (data.success) setMethods(data.methods || [])
    } catch {
      // silent
    } finally {
      setLoadingMethods(false)
    }
  }

  const fee = amount ? (parseFloat(amount) * 0.001).toFixed(2) : '0.00'
  const total = amount ? (parseFloat(amount) + parseFloat(fee)).toFixed(2) : '0.00'
  const hasEnoughBalance = user && parseFloat(total) <= user.balance

  const resetForm = () => {
    setStep('select')
    setSelectedMethod(null)
    setAmount('')
    setRecipientName('')
    setRecipientPhone('')
    setSelectedNetwork('')
    setToAddress('')
    setAccountNumber('')
    setBeneficiaryName('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }
    if (!hasEnoughBalance) {
      toast.error('رصيدك غير كافي')
      return
    }

    setLoading(true)
    try {
      const body: any = {
        userId: user?.id,
        amount: parseFloat(amount),
        method: selectedMethod?.type || 'blockchain',
        paymentMethodId: selectedMethod?.id,
      }

      // Based on method type, collect relevant fields
      if (selectedMethod?.category === 'crypto') {
        if (!toAddress || toAddress.length < 20) {
          toast.error('يرجى إدخال عنوان محفظة صحيح')
          setLoading(false)
          return
        }
        body.toAddress = toAddress
        body.network = selectedMethod?.network || 'TRC20'
      } else if (selectedMethod?.type === 'bank_deposit') {
        if (!beneficiaryName || !accountNumber) {
          toast.error('يرجى ملء جميع الحقول المطلوبة')
          setLoading(false)
          return
        }
        body.toAddress = `بنكي: ${beneficiaryName} - ${accountNumber}`
        body.beneficiaryName = beneficiaryName
        body.accountNumber = accountNumber
      } else if (selectedMethod?.type === 'atm_transfer' || selectedMethod?.type === 'bank_transfer') {
        if (!recipientName || !recipientPhone || !selectedNetwork) {
          toast.error('يرجى ملء جميع الحقول المطلوبة')
          setLoading(false)
          return
        }
        body.toAddress = `صراف: ${recipientName} - ${recipientPhone} - ${selectedNetwork}`
        body.recipientName = recipientName
        body.recipientPhone = recipientPhone
        body.network = selectedNetwork
      }

      const res = await fetch('/api/withdrawals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء طلب السحب بنجاح. سيتم مراجعته قريباً.')
        resetForm()
        // Refresh user balance
        const profileRes = await fetch('/api/auth/complete-registration')
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          if (profileData.user) {
            useAuthStore.getState().setUser(profileData.user)
          }
        }
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const setMaxAmount = () => {
    if (user && user.balance > 0) {
      const maxAmount = user.balance / 1.001
      setAmount(maxAmount.toFixed(2))
    }
  }

  const TYPE_LABELS: Record<string, string> = {
    bank_deposit: 'إيداع بنكي',
    atm_transfer: 'تحويل عبر صراف',
    bank_transfer: 'تحويل بنكي',
    crypto: 'عملات رقمية'
  }

  // Parse network options from comma-separated string
  const getNetworkOptions = (network: string | null | undefined) => {
    if (!network) return []
    return network.split(',').map(n => n.trim()).filter(Boolean)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <ArrowUpRight className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">سحب USDT</h1>
          <p className="text-sm text-muted-foreground">اختر طريقة السحب المناسبة</p>
        </div>
      </div>

      {/* Balance Info */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">الرصيد المتاح</span>
          <div className="text-right">
            <span className="text-lg font-bold gold-text">{user?.balance?.toFixed(2) ?? '0.00'}</span>
            <span className="text-xs text-muted-foreground mr-1">USDT</span>
          </div>
        </div>
      </div>

      {/* Step: Select Method */}
      {step === 'select' && (
        <div className="space-y-3">
          {loadingMethods ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-card p-4 shimmer h-20 rounded-xl" />
              ))}
            </div>
          ) : methods.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد طرق سحب متاحة حالياً</p>
            </div>
          ) : (
            methods.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSelectedMethod(m); setStep('details') }}
                className="w-full glass-card p-4 rounded-xl flex items-center justify-between hover:border-gold/30 transition-all text-right"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    m.category === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {m.category === 'crypto' ? <Wallet className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[m.type] || m.type}{m.network && m.category === 'crypto' ? ' | ' + m.network : ''}</p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      )}

      {/* Step: Withdrawal Details */}
      {step === 'details' && selectedMethod && (
        <div className="space-y-4">
          {/* Back Button */}
          <button onClick={resetForm} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors">
            <ArrowRight className="w-4 h-4" />
            رجوع لاختيار طريقة أخرى
          </button>

          {/* Method Info Card */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                selectedMethod.category === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {selectedMethod.category === 'crypto' ? <Wallet className="w-5 h-5" /> : <Building className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-sm font-bold">{selectedMethod.name}</h2>
                <p className="text-xs text-muted-foreground">{TYPE_LABELS[selectedMethod.type]}{selectedMethod.network && selectedMethod.category === 'crypto' ? ' | ' + selectedMethod.network : ''}</p>
              </div>
            </div>

            {/* Instructions */}
            {selectedMethod.instructions && (
              <div className="p-3 rounded-xl bg-gold/5 border border-gold/10">
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedMethod.instructions}</p>
              </div>
            )}
          </div>

          {/* Withdrawal Form */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-bold">تسجيل السحب</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">المبلغ (USDT)</Label>
                  <button type="button" onClick={setMaxAmount} className="text-xs text-gold hover:text-gold-light transition-colors">
                    الحد الأقصى
                  </button>
                </div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="glass-input h-12 text-base"
                  dir="ltr"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Fee Display */}
              {amount && parseFloat(amount) > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الرسوم (0.1%)</span>
                    <span>{fee} USDT</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الإجمالي</span>
                    <span className="font-bold text-gold">{total} USDT</span>
                  </div>
                  {!hasEnoughBalance && (
                    <div className="flex items-center gap-2 text-red-400 text-xs pt-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>رصيدك غير كافي</span>
                    </div>
                  )}
                </div>
              )}

              {/* Crypto: Wallet Address */}
              {selectedMethod.category === 'crypto' && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    عنوان المحفظة المستلمة ({selectedMethod.network || 'TRC20'})
                  </Label>
                  <Input
                    placeholder="أدخل عنوان المحفظة..."
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    className="glass-input h-12 text-base font-mono"
                    dir="ltr"
                  />
                </div>
              )}

              {/* Bank Deposit: Beneficiary + Account Number */}
              {selectedMethod.category === 'bank' && selectedMethod.type === 'bank_deposit' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">اسم المستفيد</Label>
                    <Input
                      placeholder="أدخل اسم المستفيد"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      className="glass-input h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">رقم الحساب</Label>
                    <Input
                      placeholder="أدخل رقم الحساب"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="glass-input h-12 text-base"
                      dir="ltr"
                    />
                  </div>
                </>
              )}

              {/* ATM/Bank Transfer: Recipient + Phone + Network */}
              {selectedMethod.category === 'bank' && (selectedMethod.type === 'atm_transfer' || selectedMethod.type === 'bank_transfer') && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">اسم المستلم</Label>
                    <Input
                      placeholder="أدخل اسم المستلم"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="glass-input h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">رقم الجوال</Label>
                    <Input
                      placeholder="أدخل رقم الجوال"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="glass-input h-12 text-base"
                      dir="ltr"
                    />
                  </div>
                  {(() => {
                    const networkOptions = getNetworkOptions(selectedMethod.network)
                    if (networkOptions.length > 1) {
                      // Dropdown for multiple networks
                      return (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">الشبكة / البنك</Label>
                          <select
                            value={selectedNetwork}
                            onChange={(e) => setSelectedNetwork(e.target.value)}
                            className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-base text-foreground"
                          >
                            <option value="">اختر الشبكة</option>
                            {networkOptions.map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      )
                    } else if (networkOptions.length === 1) {
                      // Single network, show as info
                      return (
                        <div className="p-3 rounded-xl bg-white/5">
                          <p className="text-[10px] text-muted-foreground">الشبكة</p>
                          <p className="text-sm font-medium">{networkOptions[0]}</p>
                        </div>
                      )
                    }
                    // Free text input
                    return (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">الشبكة / البنك</Label>
                        <Input
                          placeholder="أدخل اسم الشبكة أو البنك"
                          value={selectedNetwork}
                          onChange={(e) => setSelectedNetwork(e.target.value)}
                          className="glass-input h-12 text-base"
                        />
                      </div>
                    )
                  })()}
                </>
              )}

              {/* Warning Info */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-gold/5 border border-gold/10">
                <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>• تأكد من صحة البيانات المدخلة قبل التأكيد</p>
                  <p>• السحبات تتم مراجعتها يدوياً خلال 24 ساعة</p>
                  <p>• الرسوم: 0.1% من المبلغ</p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !hasEnoughBalance}
                className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد السحب'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
