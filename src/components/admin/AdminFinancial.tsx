'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  DollarSign, TrendingUp, TrendingDown, Activity,
  ArrowDownCircle, ArrowUpCircle, Users, Clock, RefreshCw,
  AlertTriangle, CheckCircle,
} from 'lucide-react'

// ===================== TYPES =====================

interface FinancialSummary {
  totalBalances: number
  completedDeposits: number
  completedWithdrawals: number
  pendingDeposits: number
  pendingWithdrawals: number
  totalP2PTrades: number
}

interface SystemHealth {
  pendingDeposits: number
  pendingWithdrawals: number
  pendingKYC: number
  unresolvedDisputes: number
}

// ===================== HELPERS =====================

const formatUSDT = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ===================== MAIN COMPONENT =====================

export default function AdminFinancial() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)

  // ===================== FETCH DATA =====================

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/super-admin?adminId=${user.id}`)
      const data = await res.json()
      if (data.success) {
        setFinancialSummary(data.data.financialSummary || null)
        setSystemHealth(data.data.systemHealth || null)
      } else {
        toast.error(data.message || 'خطأ في تحميل البيانات المالية')
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // ===================== DERIVED VALUES =====================

  const netPosition = financialSummary
    ? financialSummary.completedDeposits - financialSummary.completedWithdrawals
    : 0

  const totalHeld = financialSummary
    ? financialSummary.totalBalances + financialSummary.pendingDeposits + financialSummary.pendingWithdrawals
    : 0

  // ===================== RENDER =====================

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-green-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold gold-text">الملخص المالي</h2>
            <p className="text-xs text-muted-foreground">نظرة شاملة على الوضع المالي للمنصة</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-28 rounded-xl" />
          ))}
        </div>
      ) : !financialSummary ? (
        /* Empty State */
        <div className="glass-card p-8 rounded-xl flex flex-col items-center justify-center gap-3">
          <DollarSign className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">لا توجد بيانات مالية</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ===================== FINANCIAL SUMMARY CARDS ===================== */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Balances */}
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs text-muted-foreground">إجمالي أرصدة المستخدمين</span>
              </div>
              <p className="text-xl font-bold text-blue-400">{formatUSDT(financialSummary.totalBalances)}</p>
              <p className="text-xs text-muted-foreground mt-1">USDT</p>
            </div>

            {/* Completed Deposits */}
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <ArrowDownCircle className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs text-muted-foreground">الإيداعات المكتملة</span>
              </div>
              <p className="text-xl font-bold text-green-400">{formatUSDT(financialSummary.completedDeposits)}</p>
              <p className="text-xs text-muted-foreground mt-1">USDT</p>
            </div>

            {/* Completed Withdrawals */}
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <ArrowUpCircle className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-xs text-muted-foreground">السحوبات المكتملة</span>
              </div>
              <p className="text-xl font-bold text-red-400">{formatUSDT(financialSummary.completedWithdrawals)}</p>
              <p className="text-xs text-muted-foreground mt-1">USDT</p>
            </div>

            {/* Pending Deposits */}
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-xs text-muted-foreground">إيداعات معلقة</span>
              </div>
              <p className="text-xl font-bold text-yellow-400">{formatUSDT(financialSummary.pendingDeposits)}</p>
              <p className="text-xs text-muted-foreground mt-1">USDT</p>
            </div>

            {/* Pending Withdrawals */}
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-xs text-muted-foreground">سحوبات معلقة</span>
              </div>
              <p className="text-xl font-bold text-orange-400">{formatUSDT(financialSummary.pendingWithdrawals)}</p>
              <p className="text-xs text-muted-foreground mt-1">USDT</p>
            </div>

            {/* P2P Trades */}
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs text-muted-foreground">صفقات P2P</span>
              </div>
              <p className="text-xl font-bold text-purple-400">{financialSummary.totalP2PTrades.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">صفقة</p>
            </div>
          </div>

          {/* ===================== SYSTEM HEALTH ===================== */}
          {systemHealth && (
            <div className="glass-card p-4 rounded-xl space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" />
                صحة النظام
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-500/5">
                  <span className="text-xs text-muted-foreground">إيداعات معلقة</span>
                  <span className={`text-sm font-bold ${systemHealth.pendingDeposits > 0 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                    {systemHealth.pendingDeposits}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-orange-500/5">
                  <span className="text-xs text-muted-foreground">سحوبات معلقة</span>
                  <span className={`text-sm font-bold ${systemHealth.pendingWithdrawals > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                    {systemHealth.pendingWithdrawals}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/5">
                  <span className="text-xs text-muted-foreground">طلبات تحقق معلقة</span>
                  <span className={`text-sm font-bold ${systemHealth.pendingKYC > 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                    {systemHealth.pendingKYC}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/5">
                  <span className="text-xs text-muted-foreground">نزاعات غير محلولة</span>
                  <span className={`text-sm font-bold ${systemHealth.unresolvedDisputes > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {systemHealth.unresolvedDisputes}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ===================== NET POSITION ===================== */}
          <div className="glass-card p-4 rounded-xl space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold" />
              صافي المركز
            </h3>

            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${netPosition >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {netPosition >= 0
                  ? <TrendingUp className="w-6 h-6 text-green-400" />
                  : <TrendingDown className="w-6 h-6 text-red-400" />
                }
              </div>
              <div>
                <p className={`text-2xl font-bold ${netPosition >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netPosition >= 0 ? '+' : ''}{formatUSDT(netPosition)} USDT
                </p>
                <p className="text-xs text-muted-foreground">
                  الإيداعات المكتملة - السحوبات المكتملة
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-gold" />
                <span className="text-xs text-muted-foreground">إجمالي محتجز (أرصدة + معلقات)</span>
              </div>
              <span className="text-sm font-bold gold-text">{formatUSDT(totalHeld)} USDT</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
