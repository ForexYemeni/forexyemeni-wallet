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
  Plus,
  Trash2,
  X,
  Check,
} from 'lucide-react'

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
  bank_deposit: 'إيداع لمحفظة', atm_transfer: 'تحويل عبر صراف', crypto: 'عملات رقمية'
}

const CATEGORY_LABELS: Record<string, string> = { bank: '🏦 بنكي', crypto: '₿ عملات رقمية' }

const getMethodTitle = (m: any) => {
  if (m.category === 'crypto') {
    return m.network ? `عملات رقمية - ${m.network}` : 'عملات رقمية'
  }
  return TYPE_LABELS[m.type] || m.type
}

export default function WithdrawForm() {
  const { user, updateUser } = useAuthStore()
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [step, setStep] = useState<'select' | 'details'>('select')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMethods, setLoadingMethods] = useState(true)
  // Add/Edit method dialog
  const [showAddMethod, setShowAddMethod] = useState(false)
  const [editMethodData, setEditMethodData] = useState<any>(null)
  const [methodLoading, setMethodLoading] = useState(false)
  const [methodForm, setMethodForm] = useState({
    type: 'bank_deposit', category: 'bank',
    network: '', walletAddress: '', accountName: '', accountNumber: '',
    beneficiaryName: '', phone: '', recipientName: '', recipientPhone: '',
  })

  useEffect(() => {
    fetchMethods()
  }, [])

  const fetchMethods = async () => {
    if (!user?.id) return
    setLoadingMethods(true)
    try {
      const res = await fetch(`/api/user/payment-methods?userId=${user.id}`)
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
  }

  // ===== METHOD CRUD =====
  const resetMethodForm = () => {
    setMethodForm({ type: 'bank_deposit', category: 'bank', network: '', walletAddress: '', accountName: '', accountNumber: '', beneficiaryName: '', phone: '', recipientName: '', recipientPhone: '' })
    setEditMethodData(null)
    setShowAddMethod(false)
  }

  const handleEditMethod = (m: any) => {
    setEditMethodData(m)
    setMethodForm({
      type: m.type || 'bank_deposit', category: m.category || 'bank',
      network: m.network || '', walletAddress: m.walletAddress || '', accountName: m.accountName || '',
      accountNumber: m.accountNumber || '', beneficiaryName: m.beneficiaryName || '',
      phone: m.phone || '', recipientName: m.recipientName || '', recipientPhone: m.recipientPhone || '',
    })
    setShowAddMethod(true)
  }

  const handleSaveMethod = async () => {
    setMethodLoading(true)
    try {
      const body: any = { ...methodForm, userId: user?.id }
      if (editMethodData) {
        body.action = 'update'
        body.id = editMethodData.id
      } else {
        body.action = 'create'
      }
      const res = await fetch('/api/user/payment-methods', {
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
      const res = await fetch('/api/user/payment-methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id, userId: user?.id }),
      })
      const data = await res.json()
      if (data.success) { toast.success(data.message); fetchMethods() }
      else toast.error(data.message)
    } catch { toast.error('خطأ') }
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
    setLoading(true)
    try {
      let toAddress = ''
      let network = 'TRC20'
      let methodType = selectedMethod?.type || 'blockchain'

      if (selectedMethod?.category === 'crypto') {
        toAddress = selectedMethod.walletAddress || ''
        network = selectedMethod.network || 'TRC20'
      } else if (selectedMethod?.type === 'bank_deposit') {
        toAddress = `بنكي: ${selectedMethod.beneficiaryName || ''} - ${selectedMethod.accountNumber || ''}`
      } else if (selectedMethod?.type === 'atm_transfer') {
        toAddress = `صراف: ${selectedMethod.recipientName || ''} - ${selectedMethod.recipientPhone || ''} - ${selectedMethod.network || ''}`
      }

      if (!toAddress) {
        toast.error('بيانات طريقة السحب غير مكتملة')
        setLoading(false)
        return
      }

      const res = await fetch('/api/withdrawals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: parseFloat(amount),
          method: methodType,
          toAddress,
          network,
          paymentMethodId: selectedMethod?.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء طلب السحب بنجاح. سيتم مراجعته قريباً.')
        resetForm()
        // Refresh balance
        try {
          const profileRes = await fetch('/api/auth/complete-registration')
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

  const setMaxAmount = () => {
    if (user && user.balance > 0) {
      setAmount((user.balance / 1.001).toFixed(2))
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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
                    onClick={() => { setSelectedMethod(m); setStep('details') }}
                    className="flex items-center gap-3 flex-1 text-right"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      m.category === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {m.category === 'crypto' ? <Wallet className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{getMethodTitle(m)}</p>
                      <p className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[m.category] || m.category}</p>
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

              <div className="flex items-start gap-2 p-3 rounded-xl bg-gold/5 border border-gold/10">
                <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>• سيتم إرسال المبلغ إلى البيانات المحفوظة أعلاه</p>
                  <p>• السحبات تتم مراجعتها يدوياً خلال 24 ساعة</p>
                  <p>• الرسوم: 0.1% من المبلغ</p>
                </div>
              </div>

              <Button type="submit" disabled={loading || !hasEnoughBalance} className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد السحب'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Payment Method Dialog - Same as admin */}
      {showAddMethod && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={resetMethodForm}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[90vh] animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 pb-3 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold gold-text">{editMethodData ? 'تعديل طريقة السحب' : 'إضافة طريقة سحب جديدة'}</h3>
                <button onClick={resetMethodForm} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {/* Classification + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">التصنيف</label>
                    <select value={methodForm.category} onChange={(e) => { const cat = e.target.value; setMethodForm({ ...methodForm, category: cat, type: cat === 'crypto' ? 'crypto' : 'bank_deposit', network: cat === 'crypto' ? methodForm.network : '' }) }} className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground">
                      <option value="bank">🏦 بنكي</option>
                      <option value="crypto">₿ عملات رقمية</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">النوع</label>
                    <select value={methodForm.type} onChange={(e) => setMethodForm({ ...methodForm, type: e.target.value })} className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground">
                      {methodForm.category === 'bank' ? (
                        <><option value="bank_deposit">إيداع لمحفظة</option><option value="atm_transfer">تحويل عبر صراف</option></>
                      ) : (
                        <option value="crypto">عملات رقمية</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Bank: Deposit fields */}
                {methodForm.category === 'bank' && methodForm.type === 'bank_deposit' && (
                  <div className="space-y-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <p className="text-xs text-blue-400 font-medium">بيانات الإيداع البنكي:</p>
                    <div className="space-y-1">
                      <Input value={methodForm.accountName} onChange={(e) => setMethodForm({ ...methodForm, accountName: e.target.value })} className="glass-input h-9 text-sm" placeholder="اسم المحفظة" />
                      <Input value={methodForm.accountNumber} onChange={(e) => setMethodForm({ ...methodForm, accountNumber: e.target.value })} className="glass-input h-9 text-sm" placeholder="رقم الحساب" dir="ltr" />
                      <Input value={methodForm.beneficiaryName} onChange={(e) => setMethodForm({ ...methodForm, beneficiaryName: e.target.value })} className="glass-input h-9 text-sm" placeholder="اسم المستفيد" />
                    </div>
                  </div>
                )}

                {/* Bank: ATM Transfer fields */}
                {methodForm.category === 'bank' && methodForm.type === 'atm_transfer' && (
                  <div className="space-y-2 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                    <p className="text-xs text-green-400 font-medium">بيانات التحويل عبر صراف:</p>
                    <div className="space-y-1">
                      <Input value={methodForm.recipientName} onChange={(e) => setMethodForm({ ...methodForm, recipientName: e.target.value })} className="glass-input h-9 text-sm" placeholder="اسم المستلم" />
                      <Input value={methodForm.recipientPhone} onChange={(e) => setMethodForm({ ...methodForm, recipientPhone: e.target.value })} className="glass-input h-9 text-sm" placeholder="رقم الجوال" dir="ltr" />
                      <Input value={methodForm.network} onChange={(e) => setMethodForm({ ...methodForm, network: e.target.value })} className="glass-input h-9 text-sm" placeholder="اسم البنك / الشبكة" />
                    </div>
                  </div>
                )}

                {/* Crypto fields */}
                {methodForm.category === 'crypto' && (
                  <div className="space-y-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                    <p className="text-xs text-orange-400 font-medium">بيانات المحفظة الرقمية:</p>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">الشبكة (اختياري)</label>
                        <select value={methodForm.network} onChange={(e) => setMethodForm({ ...methodForm, network: e.target.value })} className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground">
                          <option value="">-- اختر الشبكة --</option>
                          {CRYPTO_NETWORKS.map(n => (
                            <option key={n.value} value={n.value}>{n.label}</option>
                          ))}
                        </select>
                      </div>
                      <Input value={methodForm.walletAddress} onChange={(e) => setMethodForm({ ...methodForm, walletAddress: e.target.value })} className="glass-input h-9 text-sm" placeholder="عنوان المحفظة" dir="ltr" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="p-5 pt-3 border-t border-white/5 flex gap-3 flex-shrink-0">
              <button onClick={handleSaveMethod} disabled={methodLoading} className="flex-1 h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all">
                {methodLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editMethodData ? 'حفظ التعديلات' : 'إضافة'}
              </button>
              <button onClick={resetMethodForm} className="flex-1 h-11 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
