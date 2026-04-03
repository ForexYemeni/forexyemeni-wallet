'use client'

import { useState } from 'react'
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
} from 'lucide-react'

export default function WithdrawForm() {
  const { user } = useAuthStore()
  const [amount, setAmount] = useState('')
  const [toAddress, setToAddress] = useState('')
  const [loading, setLoading] = useState(false)

  const fee = amount ? (parseFloat(amount) * 0.001).toFixed(2) : '0.00'
  const total = amount ? (parseFloat(amount) + parseFloat(fee)).toFixed(2) : '0.00'
  const hasEnoughBalance = user && parseFloat(total) <= user.balance

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }
    if (!toAddress || toAddress.length < 20) {
      toast.error('يرجى إدخال عنوان محفظة صحيح (TRC20)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/withdrawals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: parseFloat(amount),
          toAddress,
          method: 'blockchain',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء طلب السحب بنجاح. سيتم مراجعته قريباً.')
        setAmount('')
        setToAddress('')
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <ArrowUpRight className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">سحب USDT</h1>
          <p className="text-sm text-muted-foreground">شبكة TRC20</p>
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

      {/* Withdraw Form */}
      <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">المبلغ (USDT)</Label>
            <button
              type="button"
              onClick={setMaxAmount}
              className="text-xs text-gold hover:text-gold-light transition-colors"
            >
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

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">عنوان المحفظة المستلمة (TRC20)</Label>
          <Input
            placeholder="T..."
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="glass-input h-12 text-base"
            dir="ltr"
          />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-gold/5 border border-gold/10">
          <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• تأكد من صحة عنوان المحفظة (شبكة TRC20 فقط)</p>
            <p>• الحد الأدنى للسحب: 5 USDT</p>
            <p>• السحبات تتم مراجعتها يدوياً خلال 24 ساعة</p>
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
  )
}
