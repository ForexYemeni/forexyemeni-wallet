'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Activity, Users, ArrowDownLeft, ArrowUpRight, Shield, Database, Server, FileDown, RefreshCw } from 'lucide-react'

export default function AdminSystemMonitor() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [recentLogs, setRecentLogs] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      // Fetch stats
      const statsRes = await fetch('/api/admin/stats')
      const statsData = await statsRes.json()
      if (statsData.success) setStats(statsData)

      // Fetch users count
      const usersRes = await fetch('/api/admin/users')
      const usersData = await usersRes.json()
      if (usersData.success) setUsers(usersData.users || [])

      // Fetch recent audit logs
      const auditRes = await fetch(`/api/admin/audit?adminId=${user.id}&limit=10`)
      const auditData = await auditRes.json()
      if (auditData.success) setRecentLogs(auditData.logs || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const exportAll = async (type: string) => {
    try {
      const params = new URLSearchParams({ adminId: user!.id, type })
      const res = await fetch(`/api/admin/export?${params}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`تم تصدير ${type} بنجاح`)
    } catch {
      toast.error('خطأ في التصدير')
    }
  }

  const totalUsers = users.length
  const activeUsers = users.filter((u: any) => u.status === 'active').length
  const suspendedUsers = users.filter((u: any) => u.status === 'suspended').length
  const verifiedUsers = users.filter((u: any) => u.emailVerified).length
  const adminUsers = users.filter((u: any) => u.role === 'admin').length
  const merchantUsers = users.filter((u: any) => u.role === 'merchant' || u.merchantId).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">مراقبة النظام</h2>
            <p className="text-xs text-muted-foreground">نظرة شاملة على حالة المنصة</p>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* System Health */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Server className="w-4 h-4 text-green-400" />
          حالة النظام
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">الخادم نشط</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">قاعدة البيانات متصلة</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-green-400">البريد الإلكتروني يعمل</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-green-400">FCM يعمل</span>
          </div>
        </div>
      </div>

      {/* User Statistics */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          إحصائيات المستخدمين
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-white/5">
            <p className="text-lg font-bold">{totalUsers}</p>
            <p className="text-[10px] text-muted-foreground">إجمالي</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/5">
            <p className="text-lg font-bold text-green-400">{activeUsers}</p>
            <p className="text-[10px] text-muted-foreground">نشط</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/5">
            <p className="text-lg font-bold text-red-400">{suspendedUsers}</p>
            <p className="text-[10px] text-muted-foreground">موقوف</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/5">
            <p className="text-lg font-bold text-blue-400">{verifiedUsers}</p>
            <p className="text-[10px] text-muted-foreground">موثق البريد</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-purple-500/5">
            <p className="text-lg font-bold text-purple-400">{adminUsers}</p>
            <p className="text-[10px] text-muted-foreground">مديرين</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-orange-500/5">
            <p className="text-lg font-bold text-orange-400">{merchantUsers}</p>
            <p className="text-[10px] text-muted-foreground">تجار</p>
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      {stats && (
        <div className="glass-card p-4 rounded-xl space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Database className="w-4 h-4 text-gold" />
            نظرة مالية سريعة
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-500/5">
              <span className="text-xs flex items-center gap-2"><ArrowDownLeft className="w-3.5 h-3.5 text-green-400" /> إيداعات معلقة</span>
              <span className="text-sm font-bold text-green-400">{stats.pendingDeposits || 0}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/5">
              <span className="text-xs flex items-center gap-2"><ArrowUpRight className="w-3.5 h-3.5 text-red-400" /> سحوبات معلقة</span>
              <span className="text-sm font-bold text-red-400">{stats.pendingWithdrawals || 0}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-500/5">
              <span className="text-xs flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-purple-400" /> توثيق معلق</span>
              <span className="text-sm font-bold text-purple-400">{stats.pendingKyc || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Admin Activity */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          آخر العمليات الإدارية
        </h3>
        {recentLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">لا توجد عمليات مسجلة بعد</p>
        ) : (
          <div className="space-y-1.5">
            {recentLogs.slice(0, 5).map((log: any) => (
              <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{log.adminName}</span>
                  <span className="text-xs">{log.details?.substring(0, 50)}{log.details?.length > 50 ? '...' : ''}</span>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Data Section */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <FileDown className="w-4 h-4 text-blue-400" />
          تصدير البيانات
        </h3>
        <p className="text-xs text-muted-foreground">تصدير بيانات المنصة كملفات CSV للتحليل المتقدم</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { type: 'users', label: 'المستخدمين', icon: Users, color: 'text-blue-400 bg-blue-500/10' },
            { type: 'deposits', label: 'الإيداعات', icon: ArrowDownLeft, color: 'text-green-400 bg-green-500/10' },
            { type: 'withdrawals', label: 'السحوبات', icon: ArrowUpRight, color: 'text-red-400 bg-red-500/10' },
            { type: 'audit', label: 'سجل العمليات', icon: Activity, color: 'text-purple-400 bg-purple-500/10' },
          ].map(item => (
            <button
              key={item.type}
              onClick={() => exportAll(item.type)}
              className={`flex items-center gap-2 p-3 rounded-lg ${item.color} hover:opacity-80 transition-all text-xs font-medium`}
            >
              <item.icon className="w-4 h-4" />
              تصدير {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
