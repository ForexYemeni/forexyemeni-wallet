'use client'

import { useState } from 'react'
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
  QrCode,
  Info,
} from 'lucide-react'

const DEPOSIT_ADDRESS = 'TYdZ5jPqF5gBZKnFnE1aTrGkS7s7GZkRfx'

export default function DepositForm() {
  const { user } = useAuthStore()
  const [amount, setAmount] = useState('')
  const [txId, setTxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(DEPOSIT_ADDRESS)
    setCopied(true)
    toast.success('تم نسخ العنوان')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }

    if (!txId) {
      toast.error('يرجى إدخال معرف المعاملة (TxID)')
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
          method: 'blockchain',
          txId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إنشاء طلب الإيداع بنجاح. سيتم مراجعته قريباً.')
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <ArrowDownLeft className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">إيداع USDT</h1>
          <p className="text-sm text-muted-foreground">شبكة TRC20</p>
        </div>
      </div>

      {/* Deposit Address */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-gold" />
          <h2 className="text-sm font-bold">عنوان الإيداع</h2>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-gold/10" dir="ltr">
          <p className="text-xs text-foreground/80 break-all flex-1 font-mono">{DEPOSIT_ADDRESS}</p>
          <button onClick={handleCopy} className="text-gold hover:text-gold-light transition-colors flex-shrink-0">
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-gold/5 border border-gold/10">
          <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• تأكد من إرسال USDT عبر شبكة TRC20 فقط</p>
            <p>• الإيداعات تتم مراجعتها يدوياً خلال 24 ساعة</p>
            <p>• الحد الأدنى للإيداع: 10 USDT</p>
          </div>
        </div>
      </div>

      {/* Deposit Form */}
      <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-bold">تسجيل الإيداع</h2>

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

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">معرف المعاملة (TxID)</Label>
          <Input
            placeholder="أدخل TxID من المحفظة"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            className="glass-input h-12 text-base"
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">يمكنك العثور على TxID في سجل معاملات محفظتك</p>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الإيداع'}
        </Button>
      </form>
    </div>
  )
}
