import { apiFetch } from '@/lib/api-client'
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
  ChevronRight,
  Wallet,
  Building,
  CreditCard,
  ArrowRight,
  Plus,
  Trash2,
  X,
  Check,
  Shield,
  Clock,
  Smartphone,
  Bitcoin,
  Landmark,
} from 'lucide-react'
import KYCRequiredCard from '@/components/kyc/KYCRequiredCard'
import PinDots from '@/components/ui/PinDots'
import SuccessResult from '@/components/ui/SuccessResult'

const CRYPTO_NETWORKS = [
  { value: 'TRC20', label: 'TRC20 (Tron)' },
  { value: 'BEP20', label: 'BEP20 (BSC)' },
  { value: 'ERC20', label: 'ERC20 (Ethereum)' },
  { value: 'SOL', label: 'SOL (Solana)' },
  { value: 'POLYGON', label: 'Polygon' },
  { value: 'ARBITRUM', label: 'Arbitrum' },
  { value: 'OPTIMISM', label: 'Optimism' },
  { value: 'BTC', label: 'BTC (Bitcoin)' },
]

const TYPE_LABELS: Record<string, string> = {
  bank_deposit: 'إيداع بنكي',
  bank_transfer: 'تحويل بنكي',
  atm_transfer: 'تحويل عبر صراف',
  crypto: 'عملات رقمية',
}

const CATEGORY_LABELS: Record<string, string> = { bank: 'بنكي', crypto: 'عملات رقمية' }

const getMethodTitle = (m: any) => {
  if (m.category === 'crypto') {
    return m.network ? `عملات رقمية - ${m.network}` : 'عملات رقمية'
  }
  return TYPE_LABELS[m.type] || m.type
}

// Add Method Wizard Step Type
type AddMethodStep = 'category' | 'type' | 'currency' | 'details'

export default function WithdrawForm() {
  const { user, updateUser, setScreen, refreshUser } = useAuthStore()
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [step, setStep] = useState<'select' | 'details'>('select')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [feePercentage, setFeePercentage] = useState(0.1)
  const [hasPending, setHasPending] = useState(false)
  const [pendingCheckLoading, setPendingCheckLoading] = useState(false)

  // Refresh user data on mount to pick up admin changes (e.g. KYC approval)
  useEffect(() => { refreshUser() }, [refreshUser])
  // PIN dialog state
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pinCode, setPinCode] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState(false)
  // Withdraw success state
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  // Add/Edit method wizard
  const [showAddMethod, setShowAddMethod] = useState(false)
  const [editMethodData, setEditMethodData] = useState<any>(null)
  const [methodLoading, setMethodLoading] = useState(false)
  const [addMethodStep, setAddMethodStep] = useState<AddMethodStep>('category')
  const [methodForm, setMethodForm] = useState({
    type: 'bank_deposit',
    category: 'bank',
    currency: 'YER',
    network: '',
    walletAddress: '',
    accountName: '',
    accountNumber: '',
    beneficiaryName: '',
    phone: '',
    recipientName: '',
    recipientPhone: '',
  })

  useEffect(() => {
    fetchMethods()
    fetchSettings()
    checkPendingWithdrawal()
  }, [])

  const checkPendingWithdrawal = async () => {
    if (!user?.id) return
    try {
      const res = await apiFetch(`/api/withdrawals/create?checkPending=true&userId=${user.id}`)
      const data = await res.json()
      if (data.hasPending) setHasPending(true)
    } catch { /* silent */ }
  }

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/settings')
      const data = await res.json()
      if (data.success && data.settings) {
        setFeePercentage(data.settings.withdrawalFee || 0.1)
      }
    } catch { /* silent */ }
  }

  const fetchMethods = async () => {
    if (!user?.id) return
    setLoadingMethods(true)
    try {
      const res = await apiFetch(`/api/user/payment-methods?userId=${user.id}`)
      const data = await res.json()
      if (data.success) setMethods(data.methods || [])
    } catch {
      // silent
    } finally {
      setLoadingMethods(false)
    }
  }

  const fee = amount ? (parseFloat(amount) * (feePercentage / 100)).toFixed(2) : '0.00'
  const netAmount = amount ? (parseFloat(amount) - parseFloat(fee)).toFixed(2) : '0.00'
  const hasEnoughBalance = user && parseFloat(amount) <= user.balance

  const resetForm = () => {
    setStep('select')
    setSelectedMethod(null)
    setAmount('')
  }

  // ===== METHOD CRUD =====
  const resetMethodForm = () => {
    setMethodForm({
      type: 'bank_deposit', category: 'bank', currency: 'YER',
      network: '', walletAddress: '', accountName: '', accountNumber: '',
      beneficiaryName: '', phone: '', recipientName: '', recipientPhone: '',
    })
    setEditMethodData(null)
    setShowAddMethod(false)
    setAddMethodStep('category')
  }

  const handleEditMethod = (m: any) => {
    setEditMethodData(m)
    setMethodForm({
      type: m.type || 'bank_deposit', category: m.category || 'bank', currency: m.currency || 'YER',
      network: m.network || '', walletAddress: m.walletAddress || '', accountName: m.accountName || '',
      accountNumber: m.accountNumber || '', beneficiaryName: m.beneficiaryName || '',
      phone: m.phone || '', recipientName: m.recipientName || '', recipientPhone: m.recipientPhone || '',
    })
    // Set wizard to details step when editing
    setShowAddMethod(true)
    setAddMethodStep('details')
  }

  const handleSaveMethod = async () => {
    // Validate required fields based on type
    if (methodForm.category === 'crypto') {
      if (!methodForm.network) { toast.error('يرجى اختيار الشبكة'); return }
      if (!methodForm.walletAddress) { toast.error('يرجى إدخال عنوان المحفظة'); return }
    } else if (methodForm.type === 'bank_deposit') {
      if (!methodForm.accountName) { toast.error('يرجى إدخال اسم المحفظة'); return }
      if (!methodForm.accountNumber) { toast.error('يرجى إدخال رقم الحساب'); return }
      if (!methodForm.beneficiaryName) { toast.error('يرجى إدخال اسم المستفيد'); return }
    } else if (methodForm.type === 'bank_transfer') {
      if (!methodForm.accountName) { toast.error('يرجى إدخال اسم المحفظة'); return }
      if (!methodForm.accountNumber) { toast.error('يرجى إدخال رقم الحساب / IBAN'); return }
      if (!methodForm.beneficiaryName) { toast.error('يرجى إدخال اسم المستفيد'); return }
    } else if (methodForm.type === 'atm_transfer') {
      if (!methodForm.recipientName) { toast.error('يرجى إدخال اسم المستلم'); return }
      if (!methodForm.recipientPhone) { toast.error('يرجى إدخال رقم الجوال'); return }
    }

    setMethodLoading(true)
    try {
      const body: any = { ...methodForm, userId: user?.id }
      if (editMethodData) {
        body.action = 'update'
        body.id = editMethodData.id
      } else {
        body.action = 'create'
      }
      const res = await apiFetch('/api/user/payment-methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        resetMethodForm()
        fetchMethods()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ')
    } finally {
      setMethodLoading(false)
    }
  }

  const handleDeleteMethod = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الطريقة؟')) return
    try {
      const res = await apiFetch('/api/user/payment-methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id, userId: user?.id }),
      })
      const data = await res.json()
      if (data.success) { toast.success(data.message); fetchMethods() }
      else toast.error(data.message)
    } catch { toast.error('خطأ') }
  }

  // ===== WIZARD NAVIGATION =====
  const getWizardSteps = (): { key: AddMethodStep; label: string }[] => {
    if (methodForm.category === 'crypto') {
      return [
        { key: 'category', label: 'النوع' },
        { key: 'details', label: 'البيانات' },
      ]
    }
    return [
      { key: 'category', label: 'النوع' },
      { key: 'type', label: 'الطريقة' },
      { key: 'currency', label: 'العملة' },
      { key: 'details', label: 'البيانات' },
    ]
  }

  const wizardSteps = getWizardSteps()
  const currentStepIndex = wizardSteps.findIndex(s => s.key === addMethodStep)

  const canGoNext = (): boolean => {
    if (addMethodStep === 'category') return !!methodForm.category
    if (addMethodStep === 'type') return !!methodForm.type
    if (addMethodStep === 'currency') return !!methodForm.currency
    return false // details step has save button instead
  }

  const handleWizardNext = () => {
    if (addMethodStep === 'category') {
      if (methodForm.category === 'crypto') {
        setAddMethodStep('details')
      } else {
        setAddMethodStep('type')
      }
    } else if (addMethodStep === 'type') {
      setAddMethodStep('currency')
    } else if (addMethodStep === 'currency') {
      setAddMethodStep('details')
    }
  }

  const handleWizardBack = () => {
    if (addMethodStep === 'details') {
      if (methodForm.category === 'crypto') {
        setAddMethodStep('category')
      } else {
        setAddMethodStep('currency')
      }
    } else if (addMethodStep === 'currency') {
      setAddMethodStep('type')
    } else if (addMethodStep === 'type') {
      setAddMethodStep('category')
    }
  }

  // ===== SUBMIT WITHDRAWAL =====
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

    let toAddress = ''
    let network = 'TRC20'
    let methodType = selectedMethod?.type || 'blockchain'
    let paymentMethodName = getMethodTitle(selectedMethod)

    if (selectedMethod?.category === 'crypto') {
      toAddress = selectedMethod.walletAddress || ''
      network = selectedMethod.network || 'TRC20'
    } else if (selectedMethod?.type === 'bank_deposit') {
      toAddress = `بنكي: ${selectedMethod.beneficiaryName || ''} - ${selectedMethod.accountNumber || ''}`
      paymentMethodName = selectedMethod.accountName || 'إيداع بنكي'
    } else if (selectedMethod?.type === 'bank_transfer') {
      toAddress = `تحويل: ${selectedMethod.beneficiaryName || ''} - ${selectedMethod.accountNumber || ''}`
      paymentMethodName = selectedMethod.accountName || 'تحويل بنكي'
    } else if (selectedMethod?.type === 'atm_transfer') {
      toAddress = `صراف: ${selectedMethod.recipientName || ''} - ${selectedMethod.recipientPhone || ''} - ${selectedMethod.network || ''}`
    }

    if (!toAddress) {
      toast.error('بيانات طريقة السحب غير مكتملة')
      return
    }

    setShowPinDialog(true)
    setPinCode('')
    setPinError(false)
  }

  const executeWithdrawal = async () => {
    setLoading(true)
    try {
      let toAddress = ''
      let network = 'TRC20'
      let methodType = selectedMethod?.type || 'blockchain'
      let paymentMethodName = getMethodTitle(selectedMethod)

      if (selectedMethod?.category === 'crypto') {
        toAddress = selectedMethod.walletAddress || ''
        network = selectedMethod.network || 'TRC20'
      } else if (selectedMethod?.type === 'bank_deposit') {
        toAddress = `بنكي: ${selectedMethod.beneficiaryName || ''} - ${selectedMethod.accountNumber || ''}`
        paymentMethodName = selectedMethod.accountName || 'إيداع بنكي'
      } else if (selectedMethod?.type === 'bank_transfer') {
        toAddress = `تحويل: ${selectedMethod.beneficiaryName || ''} - ${selectedMethod.accountNumber || ''}`
        paymentMethodName = selectedMethod.accountName || 'تحويل بنكي'
      } else if (selectedMethod?.type === 'atm_transfer') {
        toAddress = `صراف: ${selectedMethod.recipientName || ''} - ${selectedMethod.recipientPhone || ''} - ${selectedMethod.network || ''}`
      }

      const res = await apiFetch('/api/withdrawals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: parseFloat(amount),
          method: methodType,
          toAddress,
          network,
          paymentMethodId: selectedMethod?.id,
          paymentMethodName,
          pin: pinCode,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء طلب السحب بنجاح. سيتم مراجعته قريباً.')
        setShowPinDialog(false)
        setPinCode('')
        setWithdrawSuccess(true)
        try {
          const profileRes = await apiFetch('/api/auth/complete-registration')
          if (profileRes.ok) {
            const profileData = await profileRes.json()
            if (profileData.user) updateUser(profileData.user)
          }
        } catch { /* silent */ }
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handlePinSubmit = async () => {
    if (pinCode.length < 6) return
    setPinLoading(true)
    try {
      const pinRes = await apiFetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, pin: pinCode }),
      })
      const pinData = await pinRes.json()
      if (!pinData.success) {
        if (!pinData.hasPin) {
          toast.error('لم يتم إعداد رمز PIN لحسابك. يرجى التواصل مع الإدارة لتفعيله.')
        } else {
          toast.error(pinData.message || 'رمز PIN غير صحيح')
        }
        setPinError(true)
        return
      }
      await executeWithdrawal()
    } catch {
      toast.error('خطأ في التحقق')
    } finally {
      setPinLoading(false)
    }
  }

  const setMaxAmount = () => {
    if (user && user.balance > 0) {
      setAmount(user.balance.toFixed(2))
    }
  }

  // KYC check — show required card instead of withdrawal form
  if (user?.kycStatus !== 'approved') {
    return <KYCRequiredCard type="withdraw" />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Pending Withdrawal Dialog */}
      {hasPending && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full max-w-sm rounded-2xl p-6 space-y-5 animate-scale-in text-center">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold">لديك طلب سحب معلق</h3>
              <p className="text-sm text-muted-foreground">
                يوجد طلب سحب قيد المعالجة حالياً، يرجى الانتظار حتى يتم إتمامه قبل تقديم طلب جديد.
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

      {/* Success Result */}
      {withdrawSuccess && (
        <SuccessResult
          type="success"
          title="تم إنشاء طلب السحب"
          message="سيتم معالجة طلبك خلال 24 ساعة"
          actionLabel="العودة للرئيسية"
          onAction={() => setScreen('dashboard')}
          secondaryLabel="سحب آخر"
          onSecondary={() => {
            setWithdrawSuccess(false)
            resetForm()
          }}
        />
      )}

      {/* Header */}
      {!withdrawSuccess && (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">سحب USDT</h1>
            <p className="text-sm text-muted-foreground">اختر طريقة السحب المناسبة</p>
          </div>
        </div>
      </div>
      )}

      {/* Balance Info */}
      {!withdrawSuccess && (
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">الرصيد المتاح</span>
          <div className="text-right">
            <span className="text-lg font-bold gold-text">{user?.balance?.toFixed(2) ?? '0.00'}</span>
            <span className="text-xs text-muted-foreground mr-1">USDT</span>
          </div>
        </div>
      </div>
      )}

      {/* Step: Select Method */}
      {step === 'select' && (
        <div className="space-y-3">
          {/* Add Method Button */}
          <button onClick={() => { resetMethodForm(); setShowAddMethod(true) }} className="w-full glass-card p-3 rounded-xl flex items-center justify-center gap-2 text-gold hover:bg-gold/5 transition-all text-sm font-medium border border-dashed border-gold/20">
            <Plus className="w-4 h-4" /> إضافة طريقة سحب جديدة
          </button>

          {loadingMethods ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="glass-card p-4 shimmer h-20 rounded-xl" />
              ))}
            </div>
          ) : methods.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد طرق سحب محفوظة</p>
              <p className="text-muted-foreground/60 text-xs mt-1">أضف طريقة سحب جديدة للبدء</p>
            </div>
          ) : (
            methods.map((m) => (
              <div key={m.id} className="glass-card p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={async () => {
                      setPendingCheckLoading(true)
                      try {
                        const res = await apiFetch(`/api/withdrawals/create?checkPending=true&userId=${user?.id}&_t=${Date.now()}`, { cache: 'no-store' })
                        const data = await res.json()
                        if (data.hasPending) {
                          setHasPending(true)
                          setPendingCheckLoading(false)
                          return
                        }
                      } catch { /* silent */ }
                      setPendingCheckLoading(false)
                      setSelectedMethod(m)
                      setStep('details')
                    }}
                    className="flex items-center gap-3 flex-1 text-right"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      m.category === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {m.category === 'crypto' ? <Wallet className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{getMethodTitle(m)}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span>{CATEGORY_LABELS[m.category] || m.category}</span>
                        {m.currency && m.category === 'bank' && (
                          <>
                            <span className="text-white/10">|</span>
                            <span className={
                              m.currency === 'YER' ? 'text-green-400' :
                              m.currency === 'SAR' ? 'text-amber-400' :
                              'text-blue-400'
                            }>
                              {m.currency === 'YER' ? 'ريال يمني' : m.currency === 'SAR' ? 'ريال سعودي' : 'دولار'}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                  </button>
                  <div className="flex items-center gap-1 mr-2">
                    <button onClick={() => handleEditMethod(m)} className="w-7 h-7 rounded-lg bg-gold/10 text-gold flex items-center justify-center hover:bg-gold/20">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteMethod(m.id)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Brief info */}
                <div className="text-[10px] text-muted-foreground border-t border-white/5 pt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {m.walletAddress && <span className="font-mono" dir="ltr">{m.walletAddress.substring(0, 16)}...</span>}
                  {m.beneficiaryName && <span>المستفيد: {m.beneficiaryName}</span>}
                  {m.accountNumber && <span dir="ltr">{m.accountNumber}</span>}
                  {m.recipientName && <span>المستلم: {m.recipientName}</span>}
                  {m.recipientPhone && <span dir="ltr">{m.recipientPhone}</span>}
                  {m.network && m.category === 'bank' && <span>الشبكة: {m.network}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Step: Withdrawal Details */}
      {step === 'details' && selectedMethod && (
        <div className="space-y-4">
          <button onClick={resetForm} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors">
            <ArrowRight className="w-4 h-4" />
            رجوع لاختيار طريقة أخرى
          </button>

          {/* Selected Method Info */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                selectedMethod.category === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {selectedMethod.category === 'crypto' ? <Wallet className="w-5 h-5" /> : <Building className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-sm font-bold">{getMethodTitle(selectedMethod)}</h2>
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[selectedMethod.category] || selectedMethod.category}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 border-t border-white/5 pt-3">
              {selectedMethod.walletAddress && (
                <div className="p-2.5 rounded-lg bg-white/5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">عنوان المحفظة</p>
                  <p className="text-xs font-mono" dir="ltr">{selectedMethod.walletAddress}</p>
                </div>
              )}
              {selectedMethod.beneficiaryName && <p>المستفيد: <span className="text-foreground">{selectedMethod.beneficiaryName}</span></p>}
              {selectedMethod.accountNumber && <p>رقم الحساب: <span className="text-foreground font-mono" dir="ltr">{selectedMethod.accountNumber}</span></p>}
              {selectedMethod.recipientName && <p>المستلم: <span className="text-foreground">{selectedMethod.recipientName}</span></p>}
              {selectedMethod.recipientPhone && <p>رقم الجوال: <span className="text-foreground font-mono" dir="ltr">{selectedMethod.recipientPhone}</span></p>}
              {selectedMethod.network && <p>الشبكة: <span className="text-foreground">{selectedMethod.network}</span></p>}
            </div>
          </div>

          {/* Amount Form */}
          <div className="glass-card p-5 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">المبلغ (USDT)</Label>
                  <button type="button" onClick={setMaxAmount} className="text-xs text-gold hover:text-gold-light transition-colors">
                    الحد الأقصى
                  </button>
                </div>
                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="glass-input h-12 text-base" dir="ltr" min="0" step="0.01" />
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الرسوم ({feePercentage}%) → حساب الإدارة</span>
                    <span className="text-gold font-medium">-{fee} USDT</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الصافي للمستلم</span>
                    <span className="font-bold text-green-400">{netAmount} USDT</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t border-white/5 pt-2">
                    <span className="text-muted-foreground">يُخصم من رصيدك</span>
                    <span className="font-bold">{amount} USDT</span>
                  </div>
                  {!hasEnoughBalance && (
                    <div className="flex items-center gap-2 text-red-400 text-xs pt-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>رصيدك غير كافي</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-xl bg-gold/5 border border-gold/10">
                <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>• سيتم إرسال المبلغ إلى البيانات المحفوظة أعلاه</p>
                  <p>• السحبات تتم مراجعتها يدوياً خلال 24 ساعة</p>
                  <p>• الرسوم: {feePercentage}% من المبلغ (تُضاف لحساب الإدارة)</p>
                </div>
              </div>

              <Button type="submit" disabled={loading || !hasEnoughBalance} className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد السحب'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD/EDIT METHOD - FULL SCREEN WIZARD ==================== */}
      {showAddMethod && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-lg animate-fade-in">
          {/* Compact Header - single row */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-white/5">
            {addMethodStep !== 'category' && !editMethodData ? (
              <button onClick={handleWizardBack} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : <div className="w-8" />}
            <h3 className="text-sm font-bold gold-text truncate">{editMethodData ? 'تعديل طريقة السحب' : wizardSteps[currentStepIndex]?.label || ''}</h3>
            <button onClick={resetMethodForm} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step Progress - thin bar */}
          {!editMethodData && wizardSteps.length > 1 && (
            <div className="flex-shrink-0 h-1 bg-white/5">
              <div
                className="h-full bg-gold transition-all duration-300 ease-out"
                style={{ width: `${((currentStepIndex + 1) / wizardSteps.length) * 100}%` }}
              />
            </div>
          )}

          {/* Content - scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

              {/* ========== STEP: Category Selection ========== */}
              {addMethodStep === 'category' && (
                <div className="space-y-2 animate-fade-in">
                  <p className="text-xs text-muted-foreground px-1">اختر نوع طريقة السحب</p>
                  <div className="space-y-2">
                    <button type="button" onClick={() => setMethodForm({ ...methodForm, category: 'bank', type: 'bank_deposit', network: '' })}
                      className={`w-full p-4 rounded-xl flex items-center gap-3 border transition-all text-right ${methodForm.category === 'bank' ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20 active:scale-[0.98]'}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${methodForm.category === 'bank' ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                        <Building className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">سحب بنكي</p>
                        <p className="text-[11px] text-muted-foreground">إيداع / تحويل / صراف</p>
                      </div>
                      {methodForm.category === 'bank' && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                    </button>

                    <button type="button" onClick={() => setMethodForm({ ...methodForm, category: 'crypto', type: 'crypto', network: 'TRC20' })}
                      className={`w-full p-4 rounded-xl flex items-center gap-3 border transition-all text-right ${methodForm.category === 'crypto' ? 'border-orange-500/40 bg-orange-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20 active:scale-[0.98]'}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${methodForm.category === 'crypto' ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                        <Bitcoin className="w-5 h-5 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">عملات رقمية</p>
                        <p className="text-[11px] text-muted-foreground">USDT - جميع الشبكات</p>
                      </div>
                      {methodForm.category === 'crypto' && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                    </button>
                  </div>
                </div>
              )}

              {/* ========== STEP: Bank Type ========== */}
              {addMethodStep === 'type' && (
                <div className="space-y-2 animate-fade-in">
                  <p className="text-xs text-muted-foreground px-1">اختر طريقة السحب البنكي</p>
                  <button type="button" onClick={() => setMethodForm({ ...methodForm, type: 'bank_deposit' })}
                    className={`w-full p-3.5 rounded-xl flex items-center gap-3 border transition-all text-right ${methodForm.type === 'bank_deposit' ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20 active:scale-[0.98]'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${methodForm.type === 'bank_deposit' ? 'bg-blue-500/20' : 'bg-white/5'}`}><Landmark className="w-5 h-5 text-blue-400" /></div>
                    <div className="flex-1"><p className="text-sm font-bold">إيداع بنكي</p><p className="text-[11px] text-muted-foreground">إيداع في حساب بنكي</p></div>
                    {methodForm.type === 'bank_deposit' && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                  </button>
                  <button type="button" onClick={() => setMethodForm({ ...methodForm, type: 'bank_transfer' })}
                    className={`w-full p-3.5 rounded-xl flex items-center gap-3 border transition-all text-right ${methodForm.type === 'bank_transfer' ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20 active:scale-[0.98]'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${methodForm.type === 'bank_transfer' ? 'bg-purple-500/20' : 'bg-white/5'}`}><Building className="w-5 h-5 text-purple-400" /></div>
                    <div className="flex-1"><p className="text-sm font-bold">تحويل بنكي</p><p className="text-[11px] text-muted-foreground">تحويل مصرفي بين الحسابات</p></div>
                    {methodForm.type === 'bank_transfer' && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                  </button>
                  <button type="button" onClick={() => setMethodForm({ ...methodForm, type: 'atm_transfer' })}
                    className={`w-full p-3.5 rounded-xl flex items-center gap-3 border transition-all text-right ${methodForm.type === 'atm_transfer' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20 active:scale-[0.98]'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${methodForm.type === 'atm_transfer' ? 'bg-emerald-500/20' : 'bg-white/5'}`}><Smartphone className="w-5 h-5 text-emerald-400" /></div>
                    <div className="flex-1"><p className="text-sm font-bold">تحويل عبر صراف</p><p className="text-[11px] text-muted-foreground">صراف آلي أو بنك</p></div>
                    {methodForm.type === 'atm_transfer' && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                </div>
              )}

              {/* ========== STEP: Currency ========== */}
              {addMethodStep === 'currency' && (
                <div className="space-y-2 animate-fade-in">
                  <p className="text-xs text-muted-foreground px-1">اختر عملة الحساب البنكي</p>
                  {[
                    { value: 'YER', label: 'ريال يمني', flag: 'YER', desc: 'حسابات بالريال اليمني', color: 'border-green-500/40 bg-green-500/10', iconBg: 'bg-green-500/20' },
                    { value: 'SAR', label: 'ريال سعودي', flag: 'SAR', desc: 'حسابات بالريال السعودي', color: 'border-amber-500/40 bg-amber-500/10', iconBg: 'bg-amber-500/20' },
                    { value: 'USD', label: 'دولار أمريكي', flag: 'USD', desc: 'حسابات بالدولار', color: 'border-blue-500/40 bg-blue-500/10', iconBg: 'bg-blue-500/20' },
                  ].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setMethodForm({ ...methodForm, currency: opt.value })}
                      className={`w-full p-3.5 rounded-xl flex items-center gap-3 border transition-all text-right ${methodForm.currency === opt.value ? opt.color : 'border-white/10 bg-white/[0.02] hover:border-white/20 active:scale-[0.98]'}`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${methodForm.currency === opt.value ? opt.iconBg : 'bg-white/5'}`}><span className="text-xs font-bold text-muted-foreground">{opt.flag}</span></div>
                      <div className="flex-1"><p className="text-sm font-bold">{opt.label}</p><p className="text-[11px] text-muted-foreground">{opt.desc}</p></div>
                      {methodForm.currency === opt.value && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {/* ========== STEP: Details ========== */}
              {addMethodStep === 'details' && (
                <div className="space-y-3 animate-fade-in">
                  {methodForm.category === 'crypto' && (
                    <div className="space-y-3 p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">الشبكة <span className="text-red-400">*</span></label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CRYPTO_NETWORKS.map(n => (
                            <button key={n.value} type="button" onClick={() => setMethodForm({ ...methodForm, network: n.value })}
                              className={`px-2 py-2 rounded-lg text-[11px] font-medium border transition-all text-center ${methodForm.network === n.value ? 'border-orange-500/40 bg-orange-500/15 text-orange-400' : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20'}`}>
                              {n.value}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">عنوان المحفظة <span className="text-red-400">*</span></label>
                        <Input value={methodForm.walletAddress} onChange={(e) => setMethodForm({ ...methodForm, walletAddress: e.target.value })} className="glass-input h-10 text-sm" placeholder="أدخل عنوان المحفظة" dir="ltr" />
                      </div>
                    </div>
                  )}

                  {methodForm.category === 'bank' && methodForm.type === 'bank_deposit' && (
                    <div className="space-y-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">اسم المحفظة <span className="text-red-400">*</span></label><Input value={methodForm.accountName} onChange={(e) => setMethodForm({ ...methodForm, accountName: e.target.value })} className="glass-input h-10 text-sm" placeholder="مثال: محفظة بنك اليمن الكويتي" /></div>
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">رقم الحساب <span className="text-red-400">*</span></label><Input value={methodForm.accountNumber} onChange={(e) => setMethodForm({ ...methodForm, accountNumber: e.target.value })} className="glass-input h-10 text-sm" placeholder="رقم الحساب" dir="ltr" /></div>
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">اسم المستفيد <span className="text-red-400">*</span></label><Input value={methodForm.beneficiaryName} onChange={(e) => setMethodForm({ ...methodForm, beneficiaryName: e.target.value })} className="glass-input h-10 text-sm" placeholder="الاسم الكامل للمستفيد" /></div>
                    </div>
                  )}

                  {methodForm.category === 'bank' && methodForm.type === 'bank_transfer' && (
                    <div className="space-y-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">اسم المحفظة / البنك <span className="text-red-400">*</span></label><Input value={methodForm.accountName} onChange={(e) => setMethodForm({ ...methodForm, accountName: e.target.value })} className="glass-input h-10 text-sm" placeholder="مثال: حساب بنك الأهلي" /></div>
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">رقم الحساب / IBAN <span className="text-red-400">*</span></label><Input value={methodForm.accountNumber} onChange={(e) => setMethodForm({ ...methodForm, accountNumber: e.target.value })} className="glass-input h-10 text-sm" placeholder="رقم الحساب أو IBAN" dir="ltr" /></div>
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">اسم المستفيد <span className="text-red-400">*</span></label><Input value={methodForm.beneficiaryName} onChange={(e) => setMethodForm({ ...methodForm, beneficiaryName: e.target.value })} className="glass-input h-10 text-sm" placeholder="الاسم الكامل للمستفيد" /></div>
                    </div>
                  )}

                  {methodForm.category === 'bank' && methodForm.type === 'atm_transfer' && (
                    <div className="space-y-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">اسم المستلم <span className="text-red-400">*</span></label><Input value={methodForm.recipientName} onChange={(e) => setMethodForm({ ...methodForm, recipientName: e.target.value })} className="glass-input h-10 text-sm" placeholder="اسم المستلم" /></div>
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">رقم الجوال <span className="text-red-400">*</span></label><Input value={methodForm.recipientPhone} onChange={(e) => setMethodForm({ ...methodForm, recipientPhone: e.target.value })} className="glass-input h-10 text-sm" placeholder="رقم الجوال" dir="ltr" /></div>
                      <div className="space-y-1.5"><label className="text-xs text-muted-foreground">اسم البنك / الشبكة</label><Input value={methodForm.network} onChange={(e) => setMethodForm({ ...methodForm, network: e.target.value })} className="glass-input h-10 text-sm" placeholder="مثال: بنك اليمن والكويت" /></div>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* Footer - single action button */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-white/5 bg-background">
            {addMethodStep === 'details' ? (
              <button onClick={handleSaveMethod} disabled={methodLoading} className="w-full h-10 gold-gradient text-gray-900 text-sm font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2">
                {methodLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editMethodData ? 'حفظ التعديلات' : 'حفظ طريقة السحب'}
              </button>
            ) : !editMethodData ? (
              <button onClick={handleWizardNext} disabled={!canGoNext()} className={`w-full h-10 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${canGoNext() ? 'gold-gradient text-gray-900 hover:opacity-90' : 'bg-white/5 text-muted-foreground'}`}>
                التالي <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSaveMethod} disabled={methodLoading} className="w-full h-10 gold-gradient text-gray-900 text-sm font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2">
                {methodLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* PIN Verification Dialog */}
      {showPinDialog && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold gold-text">أدخل رمز PIN</h3>
              <p className="text-sm text-muted-foreground">أدخل رمز الحماية لتأكيد عملية السحب</p>
            </div>
            <PinDots
              length={6}
              value={pinCode}
              onChange={(val) => {
                setPinCode(val)
                setPinError(false)
              }}
              onComplete={handlePinSubmit}
              error={pinError}
            />
            <button
              onClick={() => { setShowPinDialog(false); setPinCode(''); setPinError(false) }}
              className="w-full h-10 bg-white/10 text-foreground rounded-xl text-sm hover:bg-white/20 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
