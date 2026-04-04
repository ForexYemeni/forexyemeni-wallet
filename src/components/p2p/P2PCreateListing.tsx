'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'

interface P2PCreateListingProps {
  onCreated: () => void
  onBack: () => void
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'bank_deposit', label: 'إيداع بنكي' },
  { value: 'atm_transfer', label: 'صراف آلي' },
]

export default function P2PCreateListing({ onCreated, onBack }: P2PCreateListingProps) {
  const { user } = useAuthStore()

  const [type, setType] = useState<'sell' | 'buy'>('sell')
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [network, setNetwork] = useState<'TRC20' | 'ERC20'>('TRC20')
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const togglePayment = (m: string) => {
    setPaymentMethods(prev => prev.includes(m) ? prev.filter(p => p !== m) : [...prev, m])
  }

  const handleSubmit = async () => {
    if (!amount || !price || paymentMethods.length === 0) {
      toast.error('الكمية، السعر وطريقة الدفع مطلوبة')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/p2p/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          type,
          amount: parseFloat(amount),
          price: parseFloat(price),
          currency: 'YER',
          minAmount: parseFloat(minAmount) || 1,
          maxAmount: parseFloat(maxAmount) || parseFloat(amount),
          paymentMethods,
          network,
        }),
      })
      const data = await res.json()
      if (data.success) { toast.success('تم إنشاء الإعلان'); onCreated() }
      else toast.error(data.message)
    } catch { toast.error('خطأ في إنشاء الإعلان') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        العودة لإعلاناتي
      </button>

      <h2 className="text-lg font-bold gold-text">إنشاء إعلان جديد</h2>

      <div className="glass-card p-5 space-y-5">
        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">نوع الإعلان</label>
          <div className="flex gap-2">
            <button onClick={() => setType('sell')} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${type === 'sell' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-white/5 text-muted-foreground border border-transparent'}`}>
              بيع USDT
            </button>
            <button onClick={() => setType('buy')} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${type === 'buy' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'bg-white/5 text-muted-foreground border border-transparent'}`}>
              شراء USDT
            </button>
          </div>
        </div>

        {/* Network */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">الشبكة</label>
          <div className="flex gap-2">
            <button onClick={() => setNetwork('TRC20')} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${network === 'TRC20' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-white/5 text-muted-foreground border border-transparent'}`}>
              TRC20
            </button>
            <button onClick={() => setNetwork('ERC20')} className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${network === 'ERC20' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'bg-white/5 text-muted-foreground border border-transparent'}`}>
              ERC20
            </button>
          </div>
        </div>

        {/* Amount & Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">الكمية (USDT)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" className="w-full h-11 rounded-xl glass-input px-3 text-sm" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">السعر (YER/USDT)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="530" className="w-full h-11 rounded-xl glass-input px-3 text-sm" dir="ltr" />
          </div>
        </div>

        {/* Min/Max */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">الحد الأدنى (USDT)</label>
            <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="10" className="w-full h-11 rounded-xl glass-input px-3 text-sm" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">الحد الأقصى (USDT)</label>
            <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="500" className="w-full h-11 rounded-xl glass-input px-3 text-sm" dir="ltr" />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">طرق الدفع</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} onClick={() => togglePayment(m.value)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${paymentMethods.includes(m.value) ? 'gold-gradient text-gray-900' : 'bg-white/5 text-muted-foreground border border-transparent hover:bg-white/10'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleSubmit} disabled={loading || !amount || !price || paymentMethods.length === 0} className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'إنشاء الإعلان'}
        </button>
      </div>
    </div>
  )
}
