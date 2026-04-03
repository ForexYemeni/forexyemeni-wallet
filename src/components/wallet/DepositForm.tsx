'use client'

import { useState, useEffect, useRef } from 'react'
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
  Upload,
  X,
} from 'lucide-react'

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX_SIZE = 800
      const QUALITY = 0.7
      let { width, height } = img
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE }
        else { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        else resolve(file)
      }, 'image/jpeg', QUALITY)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

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
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [feePercentage, setFeePercentage] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMethods()
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.success && data.settings) {
        setFeePercentage(data.settings.depositFee || 0)
      }
    } catch { /* silent */ }
  }

  const fetchMethods = async () => {
    setLoadingMethods(true)
    try {
      const res = await fetch('/api/payment-methods?purpose=deposit')
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

  const handleScreenshotChange = async (file: File) => {
    const compressed = await compressImage(file)
    setScreenshot(compressed)
    const reader = new FileReader()
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string)
    reader.readAsDataURL(compressed)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }
    if (!screenshot) {
      toast.error('يرجى رفع صورة إثبات الدفع')
      return
    }
    setLoading(true)
    try {
      // Convert screenshot to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result)
        }
        reader.readAsDataURL(screenshot)
      })
      const screenshotBase64 = await base64Promise

      const res = await fetch('/api/deposits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: parseFloat(amount),
          method: selectedMethod?.category === 'crypto' ? 'blockchain' : selectedMethod?.type || 'bank_transfer',
          txId: txId || undefined,
          network: selectedMethod?.network || undefined,
          screenshot: screenshotBase64,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء طلب الإيداع بنجاح. سيتم مراجعته قريباً.')
        setStep('select')
        setSelectedMethod(null)
        setAmount('')
        setTxId('')
        setScreenshot(null)
        setScreenshotPreview(null)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const depositFee = amount && feePercentage > 0 ? (parseFloat(amount) * (feePercentage / 100)).toFixed(2) : '0.00'
  const netAmount = amount ? (parseFloat(amount) - parseFloat(depositFee)).toFixed(2) : '0.00'

  return (
    <div className="space-y-6 animate-fade-in pb-24">
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
                    <p className="text-[10px] text-muted-foreground">
                      {m.type === 'bank_deposit' ? (m.accountName || m.network || '') :
                       m.category === 'crypto' ? (m.network || '') :
                       m.type === 'atm_transfer' ? (m.recipientName || m.network || '') :
                       m.network || ''}
                    </p>
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
                <p className="text-xs text-muted-foreground">
                  {selectedMethod.type === 'bank_deposit' ? (selectedMethod.accountName || selectedMethod.network || '') :
                   selectedMethod.category === 'crypto' ? (selectedMethod.network || '') :
                   selectedMethod.type === 'atm_transfer' ? (selectedMethod.recipientName || selectedMethod.network || '') :
                   selectedMethod.network || ''}
                </p>
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

          {/* Deposit Amount + Screenshot */}
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

              {amount && parseFloat(amount) > 0 && feePercentage > 0 && (
                <div className="p-3 rounded-xl bg-white/5 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">الرسوم ({feePercentage}%)</span><span>{depositFee} USDT</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الصافي</span><span className="text-green-400 font-bold">{netAmount} USDT</span></div>
                </div>
              )}

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

              {/* Screenshot Upload */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">صورة إثبات الدفع <span className="text-red-400">*</span></Label>
                {screenshotPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-gold/20">
                    <img src={screenshotPreview} alt="Screenshot" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setScreenshot(null); setScreenshotPreview(null) }}
                      className="absolute top-2 left-2 w-8 h-8 bg-red-500/80 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-gold/30 hover:border-gold/50 transition-colors cursor-pointer bg-gold/5">
                    <Upload className="w-8 h-8 text-gold/60 mb-2" />
                    <span className="text-xs text-gold/80">اضغط لرفع صورة إثبات الدفع</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleScreenshotChange(e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || !screenshot}
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
