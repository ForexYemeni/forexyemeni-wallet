'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Copy,
  Check,
  Loader2,
  ArrowDownLeft,
  ChevronLeft,
  Wallet,
  Building,
  CreditCard,
  ArrowRight,
} from 'lucide-react'

export default function DepositForm() {
  const { user } = useAuthStore()
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [step, setStep] = useState<'select' | 'details' | 'confirm'>('select')
  const [amount, setAmount] = useState('')
  const [txId, setTxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    fetchMethods()
  }, [])

  const fetchMethods = async () => {
    setLoadingMethods(true)
    try {
      const res = await fetch('/api/payment-methods')
      const data = await res.json()
      if (data.success) setMethods(data.methods || [])
    } catch {
      // silent
    } finally {
      setLoadingMethods(false)
    }
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success('تم النسخ')
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/deposits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: parseFloat(amount),
          method: selectedMethod?.category === 'crypto' ? 'blockchain' : selectedMethod?.type || 'bank_transfer',
          txId: txId || undefined,
          network: selectedMethod?.network || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء طلب الإيداع بنجاح. سيتم مراجعته قريباً.')
        setStep('select')
        setSelectedMethod(null)
        setAmount('')
        setTxId('')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const TYPE_LABELS: Record<string, string> = { bank_deposit: 'إيداع بنكي', atm_transfer: 'تحويل عبر صراف', bank_transfer: 'تحويل بنكي', crypto: 'عملات رقمية' }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <ArrowDownLeft className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">إيداع USDT</h1>
          <p className="text-sm text-muted-foreground">اختر طريقة الإيداع المناسبة</p>
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
              <p className="text-muted-foreground text-sm">لا توجد طرق إيداع متاحة حالياً</p>
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
                    <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[m.type] || m.type}{m.network ? ' | ' + m.network : ''}</p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      )}

      {/* Step: Payment Details */}
      {step === 'details' && selectedMethod && (
        <div className="space-y-4">
          {/* Back Button */}
          <button onClick={() => { setStep('select'); setSelectedMethod(null) }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors">
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
                <p className="text-xs text-muted-foreground">{TYPE_LABELS[selectedMethod.type]}{selectedMethod.network ? ' | ' + selectedMethod.network : ''}</p>
              </div>
            </div>

            {/* Bank Deposit Details */}
            {selectedMethod.category === 'bank' && selectedMethod.type === 'bank_deposit' && (
              <div className="space-y-3 border-t border-white/5 pt-4">
                {selectedMethod.accountName && (
                  <CopyField label="اسم المحفظة" value={selectedMethod.accountName} field="accountName" copiedField={copiedField} onCopy={handleCopy} />
                )}
                {selectedMethod.accountNumber && (
                  <CopyField label="رقم الحساب" value={selectedMethod.accountNumber} field="accountNumber" copiedField={copiedField} onCopy={handleCopy} />
                )}
                {selectedMethod.beneficiaryName && (
                  <CopyField label="اسم المستفيد" value={selectedMethod.beneficiaryName} field="beneficiaryName" copiedField={copiedField} onCopy={handleCopy} />
                )}
              </div>
            )}

            {/* ATM/Bank Transfer Details */}
            {selectedMethod.category === 'bank' && (selectedMethod.type === 'atm_transfer' || selectedMethod.type === 'bank_transfer') && (
              <div className="space-y-3 border-t border-white/5 pt-4">
                {selectedMethod.recipientName && (
                  <CopyField label="اسم المستلم" value={selectedMethod.recipientName} field="recipientName" copiedField={copiedField} onCopy={handleCopy} />
                )}
                {selectedMethod.recipientPhone && (
                  <CopyField label="رقم الجوال" value={selectedMethod.recipientPhone} field="recipientPhone" copiedField={copiedField} onCopy={handleCopy} />
                )}
                {selectedMethod.network && (
                  <CopyField label="الشبكة / البنك" value={selectedMethod.network} field="network" copiedField={copiedField} onCopy={handleCopy} />
                )}
              </div>
            )}

            {/* Crypto Details */}
            {selectedMethod.category === 'crypto' && (
              <div className="space-y-3 border-t border-white/5 pt-4">
                {selectedMethod.network && (
                  <div className="p-2.5 rounded-lg bg-white/5">
                    <p className="text-[10px] text-muted-foreground mb-1">الشبكة</p>
                    <p className="text-sm font-medium">{selectedMethod.network}</p>
                  </div>
                )}
                {selectedMethod.walletAddress && (
                  <CopyField label="عنوان المحفظة" value={selectedMethod.walletAddress} field="walletAddress" copiedField={copiedField} onCopy={handleCopy} mono />
                )}
              </div>
            )}

            {/* Instructions */}
            {selectedMethod.instructions && (
              <div className="p-3 rounded-xl bg-gold/5 border border-gold/10">
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedMethod.instructions}</p>
              </div>
            )}
          </div>

          {/* Deposit Amount */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-bold">تسجيل الإيداع</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">المبلغ (USDT)</Label>
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

              {selectedMethod.category === 'crypto' && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">معرف المعاملة (TxID)</Label>
                  <Input
                    placeholder="أدخل TxID من المحفظة"
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    className="glass-input h-12 text-base"
                    dir="ltr"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الإيداع'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Copy Field Component
function CopyField({ label, value, field, copiedField, onCopy, mono }: {
  label: string
  value: string
  field: string
  copiedField: string | null
  onCopy: (text: string, field: string) => void
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${mono ? 'font-mono' : ''}`} dir={mono ? 'ltr' : 'rtl'}>{value}</p>
      </div>
      <button
        onClick={() => onCopy(value, field)}
        className="text-gold hover:text-gold-light transition-colors flex-shrink-0 ml-3"
      >
        {copiedField === field ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
      </button>
    </div>
  )
}
