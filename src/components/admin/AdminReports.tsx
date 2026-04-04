'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Users, ArrowDownLeft, ArrowUpRight, Calendar, RefreshCw, FileDown } from 'lucide-react'

type PeriodType = 'daily' | 'weekly' | 'monthly'

export default function AdminReports() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [report, setReport] = useState<any>(null)

  // Set default date range (last 7 days)
  useEffect(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000)
    setToDate(now.toISOString().split('T')[0])
    setFromDate(weekAgo.toISOString().split('T')[0])
  }, [])

  const fetchReport = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ adminId: user.id, period })
      if (useCustomRange && fromDate) params.set('fromDate', fromDate + 'T00:00:00.000Z')
      if (useCustomRange && toDate) params.set('toDate', toDate + 'T23:59:59.999Z')

      const res = await fetch(`/api/admin/reports?${params}`)
      const data = await res.json()
      if (data.success) {
        setReport(data)
      } else {
        toast.error(data.message || 'خطأ')
      }
    } catch {
      toast.error('خطأ في تحميل التقرير')
    } finally {
      setLoading(false)
    }
  }, [user?.id, period, fromDate, toDate, useCustomRange])

  useEffect(() => { fetchReport() }, [fetchReport])

  const summary = report?.summary || {}
  const dailyStats = report?.dailyStats || []
  const topUsers = report?.topUsers || []

  const totalFlow = (summary.totalDeposits || 0) - (summary.totalWithdrawals || 0)
  const isPositive = totalFlow >= 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">التقارير المالية</h2>
            <p className="text-xs text-muted-foreground">تحليل شامل للأداء المالي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReport} disabled={loading} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={async () => {
            try {
              const params = new URLSearchParams({ adminId: user!.id, type: 'deposits' })
              const res = await fetch(`/api/admin/export?${params}`)
              if (!res.ok) throw new Error()
              const blob = await res.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `financial_report_${new Date().toISOString().split('T')[0]}.csv`
              a.click()
              window.URL.revokeObjectURL(url)
              toast.success('تم تصدير التقرير')
            } catch { toast.error('خطأ في التصدير') }
          }} className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium">
            <FileDown className="w-3.5 h-3.5" />
            تصدير CSV
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {(['daily', 'weekly', 'monthly'] as PeriodType[]).map(p => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setUseCustomRange(false) }}
            className={`px-4 h-9 rounded-lg text-xs font-medium transition-all ${
              period === p && !useCustomRange
                ? 'gold-gradient text-gray-900'
                : 'bg-white/10 text-muted-foreground hover:bg-white/20'
            }`}
          >
            {p === 'daily' ? 'يومي' : p === 'weekly' ? 'أسبوعي' : 'شهري'}
          </button>
        ))}
        <button
          onClick={() => setUseCustomRange(true)}
          className={`px-4 h-9 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
            useCustomRange ? 'gold-gradient text-gray-900' : 'bg-white/10 text-muted-foreground hover:bg-white/20'
          }`}
        >
          <Calendar className="w-3 h-3" />
          مخصص
        </button>
      </div>

      {/* Custom Date Range */}
      {useCustomRange && (
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded-lg glass-input px-3 text-xs" />
          <span className="text-muted-foreground text-xs">إلى</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 rounded-lg glass-input px-3 text-xs" />
        </div>
      )}

      {/* Summary Cards */}
      {!loading && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">إجمالي الإيداعات</span>
                <ArrowDownLeft className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-lg font-bold text-green-400">{(summary.totalDeposits || 0).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.depositCount || 0} عملية</p>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">إجمالي السحوبات</span>
                <ArrowUpRight className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-lg font-bold text-red-400">{(summary.totalWithdrawals || 0).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.withdrawalCount || 0} عملية</p>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">إجمالي الرسوم</span>
                <DollarSign className="w-4 h-4 text-gold" />
              </div>
              <p className="text-lg font-bold gold-text">{(summary.totalFees || 0).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">USDT</p>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">صافي التدفق</span>
                {isPositive ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
              </div>
              <p className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{totalFlow.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">USDT</p>
            </div>
          </div>

          {/* Daily Chart (Simple bar visualization) */}
          {dailyStats.length > 0 && (
            <div className="glass-card p-4 rounded-xl space-y-3">
              <h3 className="text-sm font-bold">النشاط اليومي</h3>
              <div className="space-y-2">
                {dailyStats.map((day: any, i: number) => {
                  const maxAmount = Math.max(...dailyStats.map((d: any) => Math.max(d.deposits || 0, d.withdrawals || 0)), 1)
                  const depPct = Math.min(((day.deposits || 0) / maxAmount) * 100, 100)
                  const witPct = Math.min(((day.withdrawals || 0) / maxAmount) * 100, 100)
                  const dateLabel = day.date ? new Date(day.date).toLocaleDateString('ar-YE', { month: 'short', day: 'numeric' }) : ''

                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{dateLabel}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-green-400">+{(day.deposits || 0).toFixed(0)}</span>
                          <span className="text-red-400">-{(day.withdrawals || 0).toFixed(0)}</span>
                          <span className="gold-text">{(day.netFlow || 0) >= 0 ? '+' : ''}{(day.netFlow || 0).toFixed(0)}</span>
                        </span>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div className="flex-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500/60 rounded-full transition-all" style={{ width: `${depPct}%` }} />
                        </div>
                        <div className="flex-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500/60 rounded-full transition-all" style={{ width: `${witPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2 h-2 rounded-full bg-green-500/60" />
                  <span className="text-muted-foreground">إيداعات</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <span className="text-muted-foreground">سحوبات</span>
                </div>
              </div>
            </div>
          )}

          {/* Top Users */}
          {topUsers.length > 0 && (
            <div className="glass-card p-4 rounded-xl space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                أكثر المستخدمين نشاطاً
              </h3>
              <div className="space-y-2">
                {topUsers.map((u: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                      <div>
                        <p className="text-xs font-medium">{u.fullName || u.email}</p>
                        <p className="text-[10px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-green-400">+{(u.totalDeposits || 0).toFixed(2)}</p>
                      <p className="text-xs text-red-400">-{(u.totalWithdrawals || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />
            ))}
          </div>
          <div className="glass-card p-4 shimmer h-48 rounded-xl" />
        </div>
      )}
    </div>
  )
}
