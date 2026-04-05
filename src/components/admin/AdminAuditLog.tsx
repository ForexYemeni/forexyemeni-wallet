'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { FileDown, Filter, Search, RefreshCw, ChevronDown, Clock, User, Shield, ArrowDownLeft, ArrowUpRight, Settings, X } from 'lucide-react'

const ACTION_OPTIONS = [
  { value: '', label: 'جميع العمليات' },
  { value: 'deposit_approve', label: 'تأكيد إيداع' },
  { value: 'deposit_reject', label: 'رفض إيداع' },
  { value: 'deposit_review', label: 'مراجعة إيداع' },
  { value: 'withdrawal_approve', label: 'موافقة سحب' },
  { value: 'withdrawal_reject', label: 'رفض سحب' },
  { value: 'withdrawal_processing', label: 'تنفيذ سحب' },
  { value: 'kyc_approve', label: 'توثيق موافقة' },
  { value: 'kyc_reject', label: 'توثيق رفض' },
  { value: 'user_suspend', label: 'إيقاف مستخدم' },
  { value: 'user_activate', label: 'تفعيل مستخدم' },
  { value: 'user_promote', label: 'ترقية لمدير' },
  { value: 'user_demote', label: 'إزالة مدير' },
  { value: 'balance_add', label: 'إضافة رصيد' },
  { value: 'balance_withdraw', label: 'سحب رصيد' },
  { value: 'pin_reset', label: 'إعادة تعيين PIN' },
  { value: 'pin_send', label: 'إرسال PIN' },
  { value: 'settings_change', label: 'تغيير إعدادات' },
  { value: 'merchant_approve', label: 'موافقة تاجر' },
  { value: 'merchant_reject', label: 'رفض تاجر' },
  { value: 'merchant_remove', label: 'إزالة تاجر' },
  { value: 'delete_user', label: 'حذف مستخدم' },
  { value: 'system_cleanup', label: 'تنظيف النظام' },
  { value: 'p2p_dispute_resolve', label: 'حل نزاع P2P' },
]

function getActionColor(actionType: string): string {
  if (actionType.includes('approve') || actionType.includes('activate') || actionType.includes('add')) return 'bg-green-500/15 text-green-400 border-green-500/20'
  if (actionType.includes('reject') || actionType.includes('suspend') || actionType.includes('delete') || actionType.includes('remove') || actionType.includes('cleanup') || actionType.includes('withdraw')) return 'bg-red-500/15 text-red-400 border-red-500/20'
  if (actionType.includes('change') || actionType.includes('review')) return 'bg-blue-500/15 text-blue-400 border-blue-500/20'
  if (actionType.includes('send') || actionType.includes('reset')) return 'bg-orange-500/15 text-orange-400 border-orange-500/20'
  return 'bg-gray-500/15 text-gray-400 border-gray-500/20'
}

function getActionIcon(actionType: string) {
  if (actionType.includes('deposit')) return <ArrowDownLeft className="w-3.5 h-3.5" />
  if (actionType.includes('withdrawal')) return <ArrowUpRight className="w-3.5 h-3.5" />
  if (actionType.includes('kyc')) return <Shield className="w-3.5 h-3.5" />
  if (actionType.includes('user') || actionType.includes('merchant')) return <User className="w-3.5 h-3.5" />
  return <Settings className="w-3.5 h-3.5" />
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'الآن'
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`
  if (diffHour < 24) return `منذ ${diffHour} ساعة`
  if (diffDay < 7) return `منذ ${diffDay} يوم`
  return date.toLocaleDateString('ar-YE', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminAuditLog() {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ actionType: '', fromDate: '', toDate: '' })
  const [search, setSearch] = useState('')

  const fetchLogs = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ adminId: user.id, limit: '100' })
      if (filters.actionType) params.set('actionType', filters.actionType)
      if (filters.fromDate) params.set('fromDate', filters.fromDate)
      if (filters.toDate) params.set('toDate', filters.toDate)

      const res = await fetch(`/api/admin/audit?${params}`)
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs || [])
        setTotal(data.total || 0)
      }
    } catch {
      toast.error('خطأ في تحميل السجل')
    } finally {
      setLoading(false)
    }
  }, [user?.id, filters])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filteredLogs = search
    ? logs.filter((log: any) =>
        (log.adminName || '').includes(search) ||
        (log.targetName || '').includes(search) ||
        (log.details || '').includes(search) ||
        (log.actionType || '').includes(search)
      )
    : logs

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams({ adminId: user!.id, type: 'audit' })
      const res = await fetch(`/api/admin/export?${params}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('تم تصدير السجل بنجاح')
    } catch {
      toast.error('خطأ في التصدير')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">سجل العمليات</h2>
            <p className="text-xs text-muted-foreground">{total} عملية مسجلة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchLogs} disabled={loading} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium">
            <FileDown className="w-3.5 h-3.5" />
            تصدير CSV
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث في السجل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-lg glass-input pr-10 pl-4 text-sm"
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Filter className="w-3.5 h-3.5" />
          تصفية متقدمة
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filters.actionType}
              onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
              className="h-9 rounded-lg glass-input px-3 text-xs min-w-[150px]"
            >
              {ACTION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              className="h-9 rounded-lg glass-input px-3 text-xs"
              placeholder="من تاريخ"
            />
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              className="h-9 rounded-lg glass-input px-3 text-xs"
              placeholder="إلى تاريخ"
            />
            {(filters.actionType || filters.fromDate || filters.toDate) && (
              <button
                onClick={() => setFilters({ actionType: '', fromDate: '', toDate: '' })}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
              >
                <X className="w-3 h-3" /> مسح التصفية
              </button>
            )}
          </div>
        )}
      </div>

      {/* Log Entries */}
      <div className="max-h-[500px] overflow-y-auto space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass-card p-4 shimmer h-16 rounded-xl" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد عمليات مسجلة</p>
            <p className="text-muted-foreground/60 text-xs mt-1">ستظهر هنا جميع العمليات التي يقوم بها فريق الإدارة</p>
          </div>
        ) : (
          filteredLogs.map((log: any) => (
            <div key={log.id} className="glass-card p-3.5 rounded-xl space-y-2 hover:bg-white/5 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getActionColor(log.actionType)}`}>
                    {getActionIcon(log.actionType)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getActionColor(log.actionType)}`}>
                        {ACTION_OPTIONS.find(o => o.value === log.actionType)?.label || log.actionType}
                      </span>
                      {log.targetName && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          ← {log.targetName}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{log.details}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
                      <span>بواسطة: <span className="text-foreground/70">{log.adminName}</span></span>
                      <span>•</span>
                      <span>{formatTime(log.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
