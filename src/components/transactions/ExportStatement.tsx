'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { FileText, Calendar, Loader2, FileDown } from 'lucide-react'

export default function ExportStatement() {
  const { user } = useAuthStore()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExportPDF = async () => {
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
          startDate,
          endDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.message || 'حدث خطأ')
        return
      }

      const html = await res.text()

      // Open in new window for PDF print
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح')
        setLoading(false)
        return
      }

      printWindow.document.write(html)
      printWindow.document.close()

      // Wait for content to load then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }

      toast.success('تم تحميل كشف الحساب - اختر Save as PDF من نافذة الطباعة')
    } catch {
      toast.error('حدث خطأ أثناء التصدير')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = async () => {
    if (!startDate || !endDate) {
      toast.error('يرجى اختيار فترة التاريخ')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/transactions/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          startDate,
          endDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.message || 'حدث خطأ')
        return
      }

      const html = await res.text()

      // Parse HTML table to extract data for CSV
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const rows = doc.querySelectorAll('table tbody tr')

      if (rows.length === 0) {
        toast.error('لا توجد معاملات للتصدير')
        setLoading(false)
        return
      }

      let csv = '\uFEFF' // BOM for Arabic support
      csv += 'التاريخ,النوع,المبلغ (USDT),الرصيد (USDT)\n'

      rows.forEach((row) => {
        const cells = row.querySelectorAll('td')
        if (cells.length >= 4) {
          csv += `"${cells[0].textContent?.trim()}","${cells[1].textContent?.trim()}","${cells[2].textContent?.trim()}","${cells[3].textContent?.trim()}"\n`
        }
      })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `account_statement_${new Date().toISOString().split('T')[0]}.csv`
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
          <FileText className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold">تصدير كشف حساب</h3>
          <p className="text-xs text-muted-foreground">PDF أو CSV</p>
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

      <div className="flex gap-2">
        <button
          onClick={handleExportPDF}
          disabled={loading || !startDate || !endDate}
          className="flex-1 h-10 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <FileText className="w-4 h-4" />
              تصدير PDF
            </>
          )}
        </button>
        <button
          onClick={handleExportCSV}
          disabled={loading || !startDate || !endDate}
          className="h-10 px-3 bg-white/5 border border-white/10 text-muted-foreground font-medium rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
        >
          <FileDown className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>
    </div>
  )
}
