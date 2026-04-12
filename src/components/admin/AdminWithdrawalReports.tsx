import { apiFetch } from '@/lib/api-client'
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  AlertTriangle, Check, Trash2, RefreshCw, Loader2,
  MessageCircle, Eye, Clock, User, ExternalLink,
} from 'lucide-react'

interface WithdrawalReport {
  id: string
  userId: string
  withdrawalId: string
  message: string
  userName: string
  userEmail: string
  status: string
  createdAt: string
  resolvedAt?: string
}

export default function AdminWithdrawalReports() {
  const { user } = useAuthStore()
  const [reports, setReports] = useState<WithdrawalReport[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<WithdrawalReport | null>(null)

  const fetchReports = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/withdrawal-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, action: 'list' }),
      })
      const data = await res.json()
      if (data.success) {
        setReports(data.reports || [])
      }
    } catch {
      toast.error('خطأ في تحميل البلاغات')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchReports() }, [fetchReports])

  const handleResolve = async (report: WithdrawalReport) => {
    setActionLoading(report.id)
    try {
      const res = await apiFetch('/api/admin/withdrawal-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user!.id, action: 'resolve', reportId: report.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حل البلاغ')
        fetchReports()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (report: WithdrawalReport) => {
    if (!confirm('هل أنت متأكد من حذف هذا البلاغ؟')) return
    setActionLoading(report.id)
    try {
      const res = await apiFetch('/api/admin/withdrawal-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user!.id, action: 'delete', reportId: report.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حذف البلاغ')
        setSelectedReport(null)
        fetchReports()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const pendingCount = reports.filter(r => r.status === 'pending').length

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  // Report detail view
  if (selectedReport) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => setSelectedReport(null)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          → العودة للقائمة
        </button>

        <div className="glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${selectedReport.status === 'pending' ? 'text-yellow-400' : 'text-green-400'}`} />
              {selectedReport.status === 'pending' ? 'بلاغ معلق' : 'بلاغ محلول'}
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {formatDate(selectedReport.createdAt)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/5 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">المستخدم:</span>
              <span className="font-medium">{selectedReport.userName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground" dir="ltr">
              <span>{selectedReport.userEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground" dir="ltr">
              <span>سحب #{selectedReport.withdrawalId.substring(0, 12)}...</span>
            </div>
            {selectedReport.resolvedAt && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <Clock className="w-3 h-3" />
                <span>تم الحل: {formatDate(selectedReport.resolvedAt)}</span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-muted-foreground font-medium mb-2">وصف المشكلة:</p>
            <p className="text-sm leading-relaxed">{selectedReport.message}</p>
          </div>

          <div className="flex gap-2">
            {selectedReport.status === 'pending' && (
              <button
                onClick={() => handleResolve(selectedReport)}
                disabled={actionLoading === selectedReport.id}
                className="flex-1 h-10 bg-green-500/10 text-green-400 border border-green-500/20 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-green-500/20 transition-all"
              >
                {actionLoading === selectedReport.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                حل البلاغ
              </button>
            )}
            <button
              onClick={() => handleDelete(selectedReport)}
              disabled={actionLoading === selectedReport.id}
              className="flex-1 h-10 bg-red-500/10 text-red-400 border border-red-500/20 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all"
            >
              {actionLoading === selectedReport.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              حذف البلاغ
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Reports list
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold">بلاغات السحوبات</h3>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold rounded-full">
              {pendingCount} معلق
            </span>
          )}
        </div>
        <button
          onClick={fetchReports}
          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="glass-card p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-green-400" />
          </div>
          <p className="text-sm text-muted-foreground">لا توجد بلاغات</p>
          <p className="text-[10px] text-muted-foreground/50">جميع عمليات السحب تسير بشكل طبيعي</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="glass-card p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    report.status === 'pending'
                      ? 'bg-yellow-500/10'
                      : 'bg-green-500/10'
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${
                      report.status === 'pending' ? 'text-yellow-400' : 'text-green-400'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{report.userName}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{report.userEmail}</p>
                  </div>
                </div>
                <div className="text-left">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    report.status === 'pending'
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-green-500/10 text-green-400'
                  }`}>
                    {report.status === 'pending' ? 'معلق' : 'محلول'}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatDate(report.createdAt)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {report.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
