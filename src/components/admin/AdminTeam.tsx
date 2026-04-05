'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { UserCog, UserMinus, Shield, Check, X, RefreshCw, Crown, Eye, CreditCard, FileCheck, Sliders, Users } from 'lucide-react'

// ===================== TYPES =====================

interface AdminMember {
  id: string
  email: string
  name?: string
  role: string
  permissions?: {
    manageUsers: boolean
    approveDeposits: boolean
    approveWithdrawals: boolean
    approveKYC: boolean
    manageSettings: boolean
  }
  status: string
  createdAt?: string
  lastLogin?: string
}

type PermissionKey = keyof NonNullable<AdminMember['permissions']>

// ===================== CONSTANTS =====================

const PERMISSION_LABELS: Record<PermissionKey, { label: string; icon: any }> = {
  manageUsers: { label: 'إدارة المستخدمين', icon: Users },
  approveDeposits: { label: 'الموافقة على الإيداعات', icon: CreditCard },
  approveWithdrawals: { label: 'الموافقة على السحوبات', icon: Eye },
  approveKYC: { label: 'الموافقة على التوثيق', icon: FileCheck },
  manageSettings: { label: 'إدارة الإعدادات', icon: Sliders },
}

const AVATAR_COLORS = [
  'from-blue-500/20 to-blue-600/10',
  'from-purple-500/20 to-purple-600/10',
  'from-emerald-500/20 to-emerald-600/10',
  'from-orange-500/20 to-orange-600/10',
  'from-pink-500/20 to-pink-600/10',
  'from-cyan-500/20 to-cyan-600/10',
]

const AVATAR_TEXT_COLORS = [
  'text-blue-400',
  'text-purple-400',
  'text-emerald-400',
  'text-orange-400',
  'text-pink-400',
  'text-cyan-400',
]

const PERMISSION_PILL_COLORS: Record<PermissionKey, string> = {
  manageUsers: 'bg-blue-500/10 text-blue-400',
  approveDeposits: 'bg-green-500/10 text-green-400',
  approveWithdrawals: 'bg-orange-500/10 text-orange-400',
  approveKYC: 'bg-purple-500/10 text-purple-400',
  manageSettings: 'bg-amber-500/10 text-amber-400',
}

// ===================== HELPERS =====================

function getRelativeTime(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  if (hours < 24) return `منذ ${hours} ساعة`
  if (days < 30) return `منذ ${days} يوم`
  return new Date(dateStr).toLocaleDateString('ar-YE')
}

// ===================== MAIN COMPONENT =====================

export default function AdminTeam() {
  const { user } = useAuthStore()
  const [adminTeam, setAdminTeam] = useState<AdminMember[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminMember | null>(null)
  const [permissionsForm, setPermissionsForm] = useState({
    manageUsers: false,
    approveDeposits: false,
    approveWithdrawals: false,
    approveKYC: false,
    manageSettings: false,
  })

  // ===================== FETCH DATA =====================

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/super-admin?adminId=${user.id}`)
      const data = await res.json()
      if (data.success) {
        setAdminTeam(data.data?.adminTeam || [])
      } else {
        toast.error(data.message || 'خطأ في تحميل البيانات')
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // ===================== ACTION HANDLERS =====================

  const handleOpenPermissionsDialog = (admin: AdminMember) => {
    setEditingAdmin(admin)
    setPermissionsForm({
      manageUsers: admin.permissions?.manageUsers || false,
      approveDeposits: admin.permissions?.approveDeposits || false,
      approveWithdrawals: admin.permissions?.approveWithdrawals || false,
      approveKYC: admin.permissions?.approveKYC || false,
      manageSettings: admin.permissions?.manageSettings || false,
    })
    setShowPermissionsDialog(true)
  }

  const handleUpdatePermissions = async () => {
    if (!user?.id || !editingAdmin) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          action: 'manage_admin',
          subAction: 'update_permissions',
          targetUserId: editingAdmin.id,
          permissions: permissionsForm,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم تحديث الصلاحيات')
        setShowPermissionsDialog(false)
        setEditingAdmin(null)
        fetchData()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث الصلاحيات')
    } finally {
      setSaving(false)
    }
  }

  const handleDemoteAdmin = async (adminId: string, adminEmail: string) => {
    if (!user?.id) return
    if (user.id === adminId) {
      toast.error('لا يمكنك خفض نفسك')
      return
    }
    if (!confirm(`هل أنت متأكد من خفض ${adminEmail} من الإدارة؟`)) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          action: 'manage_admin',
          subAction: 'demote_admin',
          targetUserId: adminId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم خفض المدير')
        fetchData()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ')
    } finally {
      setSaving(false)
    }
  }

  // ===================== RENDER =====================

  const permKeys = Object.keys(PERMISSION_LABELS) as PermissionKey[]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-purple-500/20 flex items-center justify-center">
            <UserCog className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold gold-text">فريق الإدارة</h2>
            <p className="text-xs text-muted-foreground">إدارة المديرين وصلاحياتهم</p>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-28 rounded-xl" />
          ))}
        </div>
      ) : adminTeam.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">لا يوجد مديرين آخرين</p>
          <p className="text-muted-foreground/60 text-xs mt-1">أضف مديرين جدد لإدارة المنصة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {adminTeam.map((admin, index) => {
            const isSelf = admin.id === user?.id
            const hasPermissions = admin.permissions && Object.values(admin.permissions).some(Boolean)
            const avatarIndex = index % AVATAR_COLORS.length
            const displayName = admin.name || admin.email
            const firstLetter = displayName.charAt(0).toUpperCase()

            return (
              <div key={admin.id} className={`glass-card p-4 rounded-xl ${isSelf ? 'border border-gold/20' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  {/* Left side: Avatar + Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Avatar placeholder */}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[avatarIndex]} flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-sm font-bold ${AVATAR_TEXT_COLORS[avatarIndex]}`}>{firstLetter}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name, Email, Role Badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium truncate" dir="ltr">{admin.name || admin.email}</span>
                        {isSelf && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold font-medium">أنت</span>
                        )}
                        {!isSelf && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            hasPermissions ? 'bg-blue-500/10 text-blue-400' : 'bg-gold/10 text-gold'
                          }`}>
                            {hasPermissions ? 'مدير فرعي' : 'مدير عام'}
                          </span>
                        )}
                      </div>

                      {/* Email if name exists */}
                      {admin.name && (
                        <p className="text-[11px] text-muted-foreground truncate mb-1" dir="ltr">{admin.email}</p>
                      )}

                      {/* Permission badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {permKeys.map((key) => {
                          if (admin.permissions?.[key]) {
                            const { icon: PermIcon } = PERMISSION_LABELS[key]
                            return (
                              <span key={key} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${PERMISSION_PILL_COLORS[key]}`}>
                                <PermIcon className="w-2.5 h-2.5" />
                                {PERMISSION_LABELS[key].label}
                              </span>
                            )
                          }
                          return null
                        })}
                        {!hasPermissions && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                            صلاحيات كاملة
                          </span>
                        )}
                      </div>

                      {/* Status + Last Login */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          admin.status === 'active'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {admin.status === 'active' ? 'نشط' : 'معلّق'}
                        </span>
                        {admin.lastLogin && (
                          <span className="text-[9px] text-muted-foreground/60">
                            آخر دخول: {getRelativeTime(admin.lastLogin)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleOpenPermissionsDialog(admin)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[10px] transition-colors"
                    >
                      <UserCog className="w-3 h-3" />
                      تعديل الصلاحيات
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => handleDemoteAdmin(admin.id, admin.email)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] transition-colors"
                      >
                        <UserMinus className="w-3 h-3" />
                        خفض من الإدارة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===================== PERMISSIONS DIALOG ===================== */}
      {showPermissionsDialog && editingAdmin && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowPermissionsDialog(false)}>
          <div
            className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto">
                <Crown className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold gold-text">تعديل الصلاحيات</h3>
              <p className="text-xs text-muted-foreground truncate" dir="ltr">{editingAdmin.email}</p>
            </div>

            {/* Permission Toggles */}
            <div className="space-y-2">
              {permKeys.map((key) => {
                const { label, icon: PermIcon } = PERMISSION_LABELS[key]
                const isEnabled = permissionsForm[key]

                return (
                  <button
                    key={key}
                    onClick={() => setPermissionsForm((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      isEnabled ? 'bg-gold/5 border border-gold/20' : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isEnabled ? 'bg-gold/10' : 'bg-white/10'
                      }`}>
                        <PermIcon className={`w-4 h-4 ${isEnabled ? 'text-gold' : 'text-muted-foreground'}`} />
                      </div>
                      <span className={`text-xs ${isEnabled ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isEnabled ? 'bg-gold/20' : 'bg-white/10'
                    }`}>
                      {isEnabled ? (
                        <Check className="w-3.5 h-3.5 text-gold" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Dialog Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleUpdatePermissions}
                disabled={saving}
                className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'حفظ الصلاحيات'}
              </button>
              <button
                onClick={() => { setShowPermissionsDialog(false); setEditingAdmin(null) }}
                className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground rounded-xl text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
