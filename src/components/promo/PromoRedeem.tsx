'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Tag, Gift, Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function PromoRedeem() {
  const { user, updateBalance } = useAuthStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ reward: number; newBalance: number } | null>(null)
  const [error, setError] = useState('')

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast.error('يرجى إدخال الكود الترويجي')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'redeem',
          userId: user?.id,
          code: code.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ reward: data.reward, newBalance: data.newBalance })
        if (data.newBalance !== undefined) {
          updateBalance(data.newBalance)
        }
        toast.success(data.message)
      } else {
        setError(data.message)
      }
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCode('')
    setResult(null)
    setError('')
  }

  return (
    <div className="glass-card p-4 rounded-xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
          <Tag className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h3 className="text-sm font-bold">أكواد ترويجية</h3>
          <p className="text-xs text-muted-foreground">أدخل كود للحصول على مكافأة</p>
        </div>
      </div>

      {result ? (
        <div className="text-center space-y-3 p-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-green-400" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-green-400">+{result.reward.toFixed(2)} USDT</p>
            <p className="text-xs text-muted-foreground">تمت إضافة المكافأة لرصيدك</p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-gold hover:text-gold-light transition-colors"
          >
            استخدام كود آخر
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="أدخل الكود هنا"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 h-10 rounded-xl glass-input px-3 text-sm font-mono tracking-wider"
              dir="ltr"
              maxLength={20}
            />
            <button
              onClick={handleRedeem}
              disabled={loading || !code.trim()}
              className="h-10 px-4 rounded-xl gold-gradient text-gray-900 font-bold hover:opacity-90 transition-all flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Gift className="w-4 h-4" />
              )}
              تطبيق
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
