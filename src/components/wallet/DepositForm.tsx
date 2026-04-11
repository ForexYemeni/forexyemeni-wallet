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
  Landmark,
  Coins,
  Clock,
  Smartphone,
  Bitcoin,
} from 'lucide-react'
import { compressImage } from '@/lib/image-compress'
import { useExchangeRates, convertUSDTtoYER, convertUSDTtoSAR, convertYERtoUSDT, formatYER, formatSAR, formatUSDT } from '@/lib/currency'

type Step = 'category' | 'currency' | 'methods' | 'details'

type DepositCategory = {
  code: string          // 'bank_deposit' | 'bank_transfer' | 'crypto'
  label: string
  icon: React.ReactNode
  description: string
  color: string
}

type CurrencyOption = {
  code: string
  label: string
  icon: React.ReactNode
  description: string
  color: string
}

const DEPOSIT_CATEGORIES: DepositCategory[] = [
  {
    code: 'bank_deposit',
    label: 'إيداع بنكي',
    icon: <Building className="w-7 h-7" />,
    description: 'إيداع مباشر في الحساب البنكي',
    color: 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20',
  },
  {
    code: 'bank_transfer',
    label: 'تحويل',
    icon: <Smartphone className="w-7 h-7" />,
    description: 'تحويل عبر الصراف الآلي أو البنك',
    color: 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20',
  },
  {
    code: 'crypto',
    label: 'عملات رقمية',
    icon: <Bitcoin className="w-7 h-7" />,
    description: 'إيداع عبر USDT والعملات الرقمية',
    color: 'bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20',
  },
]

const CURRENCY_OPTIONS: CurrencyOption[] = [
  {
    code: 'YER',
    label: 'يمني',
    icon: <Landmark className="w-6 h-6" />,
    description: 'ريال يمني',
    color: 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20',
  },
  {
    code: 'SAR',
    label: 'سعودي',
    icon: <Landmark className="w-6 h-6" />,
    description: 'ريال سعودي',
    color: 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20',
  },
  {
    code: 'USDT',
    label: 'دولار',
    icon: <Coins className="w-6 h-6" />,
    description: 'USDT',
    color: 'bg-green-500/10 text-green-400 group-hover:bg-green-500/20',
  },
]

function getMethodSubtitle(m: any): string {
  const parts: string[] = []
  if (m.network) parts.push(m.network)
  if (m.accountNumber) parts.push(m.accountNumber)
  if (m.recipientPhone) parts.push(m.recipientPhone)
  if (m.type === 'bank_deposit' && !m.network) parts.push('إيداع بنكي')
  if (m.type === 'bank_transfer' && !m.network) parts.push('تحويل بنكي')
  if (m.type === 'atm_transfer' && !m.network) parts.push('تحويل صراف')
  if (m.category === 'crypto' && !m.network) parts.push('عملات رقمية')
  return parts.join(' · ') || m.type || ''
}

function getMethodLabel(m: any): string {
  if (m.name) return m.name
  if (m.accountName) return m.accountName
  if (m.recipientName) return m.recipientName
  if (m.walletAddress) return m.walletAddress.slice(0, 12) + '...'
  if (m.network) return m.network
  if (m.accountNumber) return 'حساب ' + m.accountNumber
  if (m.type === 'bank_deposit') return 'إيداع بنكي'
  if (m.type === 'atm_transfer') return 'تحويل عبر صراف'
  if (m.type === 'bank_transfer') return 'تحويل بنكي'
  if (m.category === 'crypto') return 'عملات رقمية'
  return 'إيداع'
}

export default function DepositForm() {
  const { user } = useAuthStore()
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('category')
  const [amount, setAmount] = useState('')
  const [txId, setTxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMethods, setLoadingMethods] = useState(false)
  const rates = useExchangeRates()
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [feePercentage, setFeePercentage] = useState(0)
  const [hasPending, setHasPending] = useState(false)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingCheckLoading, setPendingCheckLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSettings()
    checkPendingDeposit()
  }, [])

  const checkPendingDeposit = async () => {
    if (!user?.id) { setPendingLoading(false); return }
    try {
      const res = await fetch(`/api/deposits/create?checkPending=true&userId=${user.id}`)
      const data = await res.json()
      if (data.hasPending) setHasPending(true)
    } catch { /* silent */ }
    finally { setPendingLoading(false) }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings?t=' + Date.now(), { cache: 'no-store' })
      const data = await res.json()
      if (data.success && data.settings) {
        setFeePercentage(data.settings.depositFee || 0)
      }
    } catch { /* silent */ }
  }

  const isBankCategory = selectedCategory === 'bank_deposit' || selectedCategory === 'bank_transfer'
  const isCryptoCategory = selectedCategory === 'crypto'

  const fetchMethods = async (categoryCode: string, currencyCode: string | null) => {
    setLoadingMethods(true)
    try {
      const res = await fetch('/api/payment-methods?purpose=deposit')
      const data = await res.json()
      if (data.success) {
        const allMethods = data.methods || []
        const filtered = allMethods.filter((m: any) => {
          if (categoryCode === 'crypto') {
            return m.category === 'crypto'
          }
          if (categoryCode === 'bank_deposit') {
            // Show bank_deposit type methods matching the selected currency
            const typeMatch = m.type === 'bank_deposit'
            const currencyMatch = currencyCode ? m.currency === currencyCode : true
            return typeMatch && currencyMatch
          }
          if (categoryCode === 'bank_transfer') {
            // Show bank_transfer and atm_transfer type methods matching the selected currency
            const typeMatch = m.type === 'bank_transfer' || m.type === 'atm_transfer'
            const currencyMatch = currencyCode ? m.currency === currencyCode : true
            return typeMatch && currencyMatch
          }
          return false
        })
        setMethods(filtered)
      }
    } catch {
      toast.error('فشل في تحميل طرق الدفع')
    } finally {
      setLoadingMethods(false)
    }
  }

  const checkPendingBeforeProceed = async (): Promise<boolean> => {
    setPendingCheckLoading(true)
    try {
      const res = await fetch(`/api/deposits/create?checkPending=true&userId=${user?.id}&_t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.hasPending) {
        setHasPending(true)
        setPendingCheckLoading(false)
        return true
      }
    } catch { /* silent */ }
    setPendingCheckLoading(false)
    return false
  }

  const handleCategorySelect = async (categoryCode: string) => {
    const hasPending = await checkPendingBeforeProceed()
    if (hasPending) return

    setSelectedCategory(categoryCode)
    setSelectedCurrency(null)
    setSelectedMethod(null)
    setMethods([])

    if (categoryCode === 'crypto') {
      // Crypto: skip currency selection, go directly to methods
      setStep('methods')
      fetchMethods(categoryCode, null)
    } else {
      // Bank deposit / bank transfer: show currency selection
      setStep('currency')
    }
  }

  const handleCurrencySelect = (currencyCode: string) => {
    setSelectedCurrency(currencyCode)
    setStep('methods')
    if (selectedCategory) {
      fetchMethods(selectedCategory, currencyCode)
    }
  }

  const handleMethodSelect = (method: any) => {
    setSelectedMethod(method)
    setStep('details')
  }

  const handleBack = () => {
    if (step === 'details') {
      setStep('methods')
      setSelectedMethod(null)
      setAmount('')
      setTxId('')
    } else if (step === 'methods') {
      if (isBankCategory) {
        // Bank: go back to currency selection
        setStep('currency')
        setSelectedCurrency(null)
        setMethods([])
      } else {
        // Crypto: go back to category selection
        setStep('category')
        setSelectedCategory(null)
        setMethods([])
      }
    } else if (step === 'currency') {
      // Go back to category selection
      setStep('category')
      setSelectedCategory(null)
      setSelectedCurrency(null)
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

    const isCrypto = selectedMethod?.category === 'crypto'
    if (!isCrypto && !screenshot) {
      toast.error('يرجى رفع صورة إثبات الدفع')
      return
    }

    setLoading(true)
    try {
      let screenshotBase64: string | undefined
      if (screenshot) {
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(screenshot)
        })
        screenshotBase64 = await base64Promise
      }

      const res = await fetch('/api/deposits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: isLocalCurrency ? usdtAmount : parseFloat(amount),
          localAmount: isLocalCurrency ? parseFloat(amount) : null,
          currency: methodCurrency,
          method: selectedMethod?.category === 'crypto' ? 'blockchain' : selectedMethod?.type || 'bank_transfer',
          txId: txId || undefined,
          network: selectedMethod?.network || undefined,
          screenshot: screenshotBase64,
          paymentMethodId: selectedMethod?.id || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء طلب الإيداع بنجاح. سيتم مراجعته قريباً.')
        // Reset everything
        setStep('category')
        setSelectedCategory(null)
        setSelectedCurrency(null)
        setSelectedMethod(null)
        setMethods([])
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

  // Calculations
  const isCrypto = selectedMethod?.category === 'crypto'
  const methodCurrency = selectedMethod?.currency || 'USDT'
  const isLocalCurrency = methodCurrency !== 'USDT'

  const getUSDTAmount = (): number => {
    if (!amount || parseFloat(amount) <= 0) return 0
    const localAmount = parseFloat(amount)
    if (methodCurrency === 'YER') return convertYERtoUSDT(localAmount, rates.usdToYer)
    if (methodCurrency === 'SAR') return parseFloat((localAmount / rates.usdToSar).toFixed(2))
    return localAmount
  }

  const usdtAmount = isLocalCurrency ? getUSDTAmount() : (parseFloat(amount) || 0)
  const usdtFee = usdtAmount > 0 && feePercentage > 0 ? parseFloat((usdtAmount * (feePercentage / 100)).toFixed(2)) : 0
  const usdtNet = usdtAmount > 0 ? parseFloat((usdtAmount - usdtFee).toFixed(2)) : 0

  const getCurrencyLabel = () => {
    if (methodCurrency === 'YER') return 'ر.ي'
    if (methodCurrency === 'SAR') return 'ر.س'
    return 'USDT'
  }

  const getCurrencyPlaceholder = () => {
    if (methodCurrency === 'YER') return '0 (ريال يمني)'
    if (methodCurrency === 'SAR') return '0.00 (ريال سعودي)'
    return '0.00'
  }

  // Get step labels for indicator
  const getStepLabels = () => {
    if (isCryptoCategory) {
      // Crypto has 3 steps: category -> methods -> details
      return [
        { key: 'category', label: 'النوع' },
        { key: 'methods', label: 'الطريقة' },
        { key: 'details', label: 'التفاصيل' },
      ]
    }
    // Bank has 4 steps: category -> currency -> methods -> details
    return [
      { key: 'category', label: 'النوع' },
      { key: 'currency', label: 'العملة' },
      { key: 'methods', label: 'الطريقة' },
      { key: 'details', label: 'التفاصيل' },
    ]
  }

  const stepLabels = getStepLabels()

  const getStepOrder = (): Step[] => {
    if (isCryptoCategory) return ['category', 'methods', 'details']
    return ['category', 'currency', 'methods', 'details']
  }

  // Get category info
  const getCategoryInfo = () => {
    if (!selectedCategory) return null
    return DEPOSIT_CATEGORIES.find(c => c.code === selectedCategory)
  }

  // Get currency info
  const getCurrencyInfo = () => {
    if (!selectedCurrency) return null
    return CURRENCY_OPTIONS.find(c => c.code === selectedCurrency)
  }

  // Build dynamic currency descriptions with live rates
  const getCurrencyOptionsWithRates = (): CurrencyOption[] => {
    return CURRENCY_OPTIONS.map(opt => {
      if (opt.code === 'YER') {
        return { ...opt, description: `1 USDT = ${rates.usdToYer.toLocaleString()} ر.ي` }
      }
      if (opt.code === 'SAR') {
        return { ...opt, description: `1 USDT = ${rates.usdToSar} ر.س` }
      }
      return opt
    })
  }

  const currentCategoryInfo = getCategoryInfo()
  const currentCurrencyInfo = getCurrencyInfo()
  const currencyOptionsWithRates = getCurrencyOptionsWithRates()

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Pending Deposit Dialog */}
      {hasPending && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full max-w-sm rounded-2xl p-6 space-y-5 animate-scale-in text-center">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold">لديك طلب إيداع معلق</h3>
              <p className="text-sm text-muted-foreground">
                يوجد طلب إيداع قيد المراجعة حالياً، يرجى الانتظار حتى يتم معالجته قبل تقديم طلب جديد.
              </p>
            </div>
            <Button
              onClick={() => setHasPending(false)}
              className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
            >
              فهمت
            </Button>
          </div>
        </div>
      )}

      {/* Checking pending overlay */}
      {pendingCheckLoading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full max-w-xs rounded-2xl p-6 space-y-4 animate-scale-in text-center">
            <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">جاري التحقق...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <ArrowDownLeft className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">إيداع</h1>
          <p className="text-sm text-muted-foreground">اختر طريقة الإيداع</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {stepLabels.map((s, idx) => {
          const stepOrder = getStepOrder()
          const currentIdx = stepOrder.indexOf(step)
          const thisIdx = stepOrder.indexOf(s.key as Step)
          const isActive = step === s.key
          const isDone = thisIdx >= 0 && thisIdx < currentIdx
          const isUpcoming = thisIdx > currentIdx
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 flex-1 justify-center p-2 rounded-xl transition-all ${
                isActive ? 'bg-gold/10 border border-gold/30' : isDone ? 'bg-green-500/5 border border-green-500/20' : 'bg-white/5 border border-transparent'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-gold text-gray-900' : isDone ? 'bg-green-500 text-white' : 'bg-white/10 text-muted-foreground'
                }`}>
                  {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${isActive ? 'text-gold' : isDone ? 'text-green-400' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
              {idx < stepLabels.length - 1 && <ChevronLeft className="w-4 h-4 text-muted-foreground/30 -ml-2 flex-shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* ==================== STEP 1: Category Selection ==================== */}
      {step === 'category' && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-sm text-muted-foreground mb-2">اختر نوع الإيداع</p>
          {DEPOSIT_CATEGORIES.map((cat) => (
            <button
              key={cat.code}
              onClick={() => handleCategorySelect(cat.code)}
              className="w-full glass-card p-5 rounded-xl flex items-center gap-4 hover:border-gold/30 transition-all text-right group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${cat.color}`}>
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold">{cat.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
              </div>
              <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-gold transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* ==================== STEP 2: Currency Selection (Bank only) ==================== */}
      {step === 'currency' && isBankCategory && (
        <div className="space-y-4 animate-fade-in">
          {/* Back Button */}
          <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors">
            <ArrowRight className="w-4 h-4" />
            رجوع لاختيار نوع الإيداع
          </button>

          {/* Category Badge */}
          {currentCategoryInfo && (
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentCategoryInfo.color.split(' ')[0]} ${currentCategoryInfo.color.split(' ')[1]}`}>
                <div className="scale-75">{currentCategoryInfo.icon}</div>
              </div>
              <p className="text-sm font-bold">{currentCategoryInfo.label}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-2">اختر عملة الإيداع</p>
          {currencyOptionsWithRates.map((cur) => (
            <button
              key={cur.code}
              onClick={() => handleCurrencySelect(cur.code)}
              className="w-full glass-card p-4 rounded-xl flex items-center gap-4 hover:border-gold/30 transition-all text-right group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${cur.color}`}>
                {cur.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{cur.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{cur.description}</p>
              </div>
              <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-gold transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* ==================== STEP 3: Payment Methods ==================== */}
      {step === 'methods' && (
        <div className="space-y-4 animate-fade-in">
          {/* Back Button */}
          <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors">
            <ArrowRight className="w-4 h-4" />
            {isBankCategory ? 'رجوع لاختيار العملة' : 'رجوع لاختيار نوع الإيداع'}
          </button>

          {/* Breadcrumb: Category + Currency */}
          <div className="flex items-center gap-2 flex-wrap">
            {currentCategoryInfo && (
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${currentCategoryInfo.color.split(' ')[0]} ${currentCategoryInfo.color.split(' ')[1]}`}>
                  <div className="scale-[0.6]">{currentCategoryInfo.icon}</div>
                </div>
                <span className="text-xs font-bold">{currentCategoryInfo.label}</span>
              </div>
            )}
            {isBankCategory && currentCurrencyInfo && (
              <>
                <ChevronLeft className="w-3 h-3 text-muted-foreground/40" />
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${currentCurrencyInfo.color.split(' ')[0]} ${currentCurrencyInfo.color.split(' ')[1]}`}>
                    <div className="scale-[0.6]">{currentCurrencyInfo.icon}</div>
                  </div>
                  <span className="text-xs font-bold">{currentCurrencyInfo.label}</span>
                </div>
              </>
            )}
          </div>

          {/* Methods List */}
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
              <button onClick={handleBack} className="mt-4 text-sm text-gold hover:text-gold/80 transition-colors">
                رجوع واختر خيار آخر
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleMethodSelect(m)}
                  className="w-full glass-card p-4 rounded-xl flex items-center justify-between hover:border-gold/30 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      m.category === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {m.category === 'crypto' ? <Wallet className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{getMethodLabel(m)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-muted-foreground">
                          {getMethodSubtitle(m)}
                        </p>
                        {m.isActive !== false && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">نشط</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-gold transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== STEP 4: Deposit Details + Form ==================== */}
      {step === 'details' && selectedMethod && (
        <div className="space-y-4 animate-fade-in">
          {/* Back Button */}
          <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors">
            <ArrowRight className="w-4 h-4" />
            رجوع لاختيار طريقة أخرى
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-wrap">
            {currentCategoryInfo && (
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${currentCategoryInfo.color.split(' ')[0]} ${currentCategoryInfo.color.split(' ')[1]}`}>
                  <div className="scale-[0.6]">{currentCategoryInfo.icon}</div>
                </div>
                <span className="text-xs font-bold">{currentCategoryInfo.label}</span>
              </div>
            )}
            {isBankCategory && currentCurrencyInfo && (
              <>
                <ChevronLeft className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-xs font-bold text-gold">{currentCurrencyInfo.label}</span>
              </>
            )}
          </div>

          {/* Method Info Card */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                selectedMethod.category === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {selectedMethod.category === 'crypto' ? <Wallet className="w-5 h-5" /> : <Building className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-sm font-bold">{selectedMethod.name || getMethodLabel(selectedMethod)}</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedMethod.type === 'bank_deposit' ? (selectedMethod.accountName || selectedMethod.network || '') :
                   selectedMethod.category === 'crypto' ? (selectedMethod.network || '') :
                   selectedMethod.type === 'atm_transfer' ? (selectedMethod.network || 'تحويل نقدي') :
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

            {/* Exchange Rate Info for local currency */}
            {isLocalCurrency && (
              <div className="p-3 rounded-xl bg-gold/5 border border-gold/10 text-xs space-y-1">
                <p className="text-gold font-medium">سعر الصرف الحالي:</p>
                {methodCurrency === 'YER' && <p>1 USDT = {rates.usdToYer.toLocaleString()} ر.ي</p>}
                {methodCurrency === 'SAR' && <p>1 USDT = {rates.usdToSar} ر.س</p>}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">المبلغ ({getCurrencyLabel()})</Label>
                <Input
                  type="number"
                  placeholder={getCurrencyPlaceholder()}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="glass-input h-12 text-base"
                  dir="ltr"
                  min="0"
                  step={methodCurrency === 'YER' ? '1' : '0.01'}
                />
                {isLocalCurrency && amount && parseFloat(amount) > 0 && usdtAmount > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    = {formatUSDT(usdtAmount)} USDT
                  </p>
                )}
              </div>

              {amount && parseFloat(amount) > 0 && usdtAmount > 0 && (
                <div className="p-3 rounded-xl bg-white/5 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {isLocalCurrency ? `المبلغ المدفوع (${getCurrencyLabel()})` : 'المبلغ المدفوع'}
                    </span>
                    <span>{isLocalCurrency ? `${parseFloat(amount).toLocaleString()} ${getCurrencyLabel()}` : `${usdtAmount.toFixed(2)} USDT`}</span>
                  </div>
                  {isLocalCurrency && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المعادل بالدولار</span>
                      <span className="text-gold font-medium">{formatUSDT(usdtAmount)}</span>
                    </div>
                  )}
                  {feePercentage > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الرسوم ({feePercentage}%) - حساب الإدارة</span>
                        <span className="text-gold font-medium">-{usdtFee.toFixed(2)} USDT</span>
                      </div>
                      <div className="border-t border-white/5 pt-1 mt-1 flex justify-between">
                        <span className="text-muted-foreground">المبلغ الصافي الذي سيضاف لحسابك</span>
                        <span className="text-green-400 font-bold">{usdtNet.toFixed(2)} USDT</span>
                      </div>
                    </>
                  )}
                  {!feePercentage && isLocalCurrency && (
                    <div className="border-t border-white/5 pt-1 mt-1 flex justify-between">
                      <span className="text-muted-foreground">المبلغ الصافي الذي سيضاف لحسابك</span>
                      <span className="text-green-400 font-bold">{formatUSDT(usdtAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* TX ID for crypto */}
              {isCrypto && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">معرف المعاملة (TxID) <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="أدخل TxID من المحفظة"
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    className="glass-input h-12 text-base"
                    dir="ltr"
                  />
                </div>
              )}

              {/* Screenshot Upload (for bank methods) */}
              {!isCrypto && (
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
              )}

              {/* Optional screenshot for crypto */}
              {isCrypto && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">صورة إثبات الدفع <span className="text-muted-foreground">(اختياري)</span></Label>
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
                    <label className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-gold/30 transition-colors cursor-pointer bg-white/[0.02]">
                      <Upload className="w-6 h-6 text-muted-foreground/40 mb-1" />
                      <span className="text-xs text-muted-foreground/60">رفع صورة اختياري</span>
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
              )}

              <Button
                type="submit"
                disabled={loading || (!isCrypto && !screenshot) || (isCrypto && !txId)}
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
