'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { FileDown, Calendar, Loader2 } from 'lucide-react'

export default function ExportStatement() {
  const { user } = useAuthStore()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error('يرجى اختيار فترة التاريخ')
      return
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/transactions/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          token: useAuthStore.getState().token,
          startDate,
          endDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.message || 'حدث خطأ')
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `account_statement_${new Date().toISOString().split('T')[0]}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('تم تصدير الكشف بنجاح')
    } catch {
      toast.error('حدث خطأ أثناء التصدير')
    } finally {
      setLoading(false)
    }
  }

  const setQuickRange = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  return (
    <div className="glass-card p-4 rounded-xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <FileDown className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold">تصدير كشف حساب</h3>
          <p className="text-xs text-muted-foreground">تنزيل كشف المعاملات</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setQuickRange(7)}
          className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
        >
          آخر أسبوع
        </button>
        <button
          onClick={() => setQuickRange(30)}
          className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
        >
          آخر شهر
        </button>
        <button
          onClick={() => setQuickRange(90)}
          className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
        >
          آخر 3 أشهر
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            من
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full h-10 rounded-lg glass-input px-3 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            إلى
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full h-10 rounded-lg glass-input px-3 text-xs"
          />
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={loading || !startDate || !endDate}
        className="w-full h-10 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <FileDown className="w-4 h-4" />
            تصدير الكشف
          </>
        )}
      </button>
    </div>
  )
}
