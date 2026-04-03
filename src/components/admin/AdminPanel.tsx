'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Loader2,
  Check,
  X,
  Search,
  Eye,
  Mail,
  Phone,
  DollarSign,
  BadgeCheck,
  Clock,
  UserCheck,
  UserX,
  Crown,
  ChevronDown,
  ChevronUp,
  Star,
  Ban,
} from 'lucide-react'

// ===================== TYPES =====================

interface AdminUser {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  role: string
  status: string
  emailVerified: boolean
  phoneVerified: boolean
  kycStatus: string
  balance: number
  frozenBalance: number
  country: string | null
  createdAt: string
}

interface AdminDeposit {
  id: string
  amount: number
  txId: string | null
  status: string
  createdAt: string
  user: { id: string; email: string; fullName: string | null }
}

interface AdminWithdrawal {
  id: string
  amount: number
  fee: number
  toAddress: string
  status: string
  createdAt: string
  user: { id: string; email: string; fullName: string | null }
}

interface KYCRecordItem {
  id: string
  type: string
  fileUrl: string
  status: string
  userId: string
  user: { id: string; email: string; fullName: string | null; phone: string | null }
}

// ===================== ROLE MANAGEMENT =====================

type AdminPermission = {
  manageUsers: boolean
  approveDeposits: boolean
  approveWithdrawals: boolean
  approveKYC: boolean
  manageSettings: boolean
}

const DEFAULT_PERMISSIONS: AdminPermission = {
  manageUsers: true,
  approveDeposits: true,
  approveWithdrawals: true,
  approveKYC: true,
  manageSettings: false,
}

const ROLE_LABELS: Record<string, string> = {
  user: 'مستخدم',
  admin: 'مدير عام',
  moderator: 'مشرف',
  kyc_manager: 'مدير تحقق',
  finance_manager: 'مدير مالي',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'صلاحية كاملة على كل شيء',
  moderator: 'إدارة المستخدمين والتحقق فقط',
  kyc_manager: 'الموافقة على الهويات فقط',
  finance_manager: 'الموافقة على الإيداعات والسحوبات فقط',
}

// ===================== MAIN COMPONENT =====================

export default function AdminPanel() {
  const { user, setScreen } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'deposits' | 'withdrawals' | 'kyc'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [deposits, setDeposits] = useState<AdminDeposit[]>([])
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [kycRecords, setKycRecords] = useState<KYCRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [roleDialogUser, setRoleDialogUser] = useState<AdminUser | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<AdminPermission>(DEFAULT_PERMISSIONS)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAll()
    }
  }, [activeTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [usersRes, depositsRes, withdrawalsRes, kycRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/deposits'),
        fetch('/api/admin/withdrawals'),
        fetch('/api/admin/kyc'),
      ])
      const [usersData, depositsData, withdrawalsData, kycData] = await Promise.all([
        usersRes.json(), depositsRes.json(), withdrawalsRes.json(), kycRes.json(),
      ])
      if (usersData.success) setUsers(usersData.users || [])
      if (depositsData.success) setDeposits(depositsData.deposits || [])
      if (withdrawalsData.success) setWithdrawals(withdrawalsData.withdrawals || [])
      if (kycData.success) setKycRecords(kycData.kycRecords || [])
    } catch {
      toast.error('خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDeposit = async (depositId: string, status: string) => {
    setActionLoading(depositId)
    try {
      const res = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId, status }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(status === 'confirmed' ? 'تم تأكيد الإيداع' : 'تم رفض الإيداع')
        fetchAll()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث الإيداع')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateWithdrawal = async (withdrawalId: string, status: string, txId?: string) => {
    setActionLoading(withdrawalId)
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId, status, txId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم تحديث السحب')
        fetchAll()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث السحب')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateKYC = async (recordId: string, status: string, userId: string) => {
    setActionLoading(recordId)
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, status, userId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(status === 'approved' ? 'تم قبول المستند' : 'تم رفض المستند')
        fetchAll()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث KYC')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateUser = async (userId: string, updates: Record<string, unknown>) => {
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم تحديث المستخدم')
        fetchAll()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث المستخدم')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRoleChange = (targetUser: AdminUser, newRole: string) => {
    setRoleDialogUser(targetUser)
    setSelectedPermissions(DEFAULT_PERMISSIONS)
  }

  const confirmRoleChange = async () => {
    if (!roleDialogUser) return
    setActionLoading(roleDialogUser.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: roleDialogUser.id, role: roleDialogUser.role === 'admin' ? 'user' : 'admin', permissions: selectedPermissions }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم تحديث صلاحيات المستخدم')
        setRoleDialogUser(null)
        fetchAll()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث الصلاحيات')
    } finally {
      setActionLoading(null)
    }
  }

  const tabs = [
    { key: 'users' as const, label: 'المستخدمون', icon: Users, count: users.length },
    { key: 'deposits' as const, label: 'الإيداعات', icon: ArrowDownLeft, count: deposits.filter(d => d.status === 'pending').length },
    { key: 'withdrawals' as const, label: 'السحوبات', icon: ArrowUpRight, count: withdrawals.filter(w => w.status === 'pending').length },
    { key: 'kyc' as const, label: 'التحقق', icon: Shield, count: kycRecords.filter(k => k.status === 'pending').length },
  ]

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.fullName?.includes(searchQuery) ||
    u.phone?.includes(searchQuery) ||
    u.id.includes(searchQuery)
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (user?.role !== 'admin') {
    return (
      <div className="glass-card p-8 text-center">
        <Shield className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-muted-foreground">ليس لديك صلاحية الوصول</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold gold-text">لوحة الإدارة</h1>
          <p className="text-sm text-muted-foreground">إدارة المستخدمين والعمليات</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass-card px-3 py-2 flex items-center gap-2 text-xs">
            <Users className="w-4 h-4 text-gold" />
            <span>{users.length} مستخدم</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs transition-all relative ${
              activeTab === tab.key
                ? 'bg-gold/10 text-gold border border-gold/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-gold text-gray-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* ===================== USERS TAB ===================== */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالبريد أو الاسم أو الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input h-10 pr-10 text-sm"
                />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                  لا يوجد مستخدمون
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="glass-card rounded-xl overflow-hidden">
                      {/* User Header Row */}
                      <div
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                            u.role === 'admin' ? 'bg-gold/20 text-gold' :
                            u.status === 'active' ? 'bg-green-500/10 text-green-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {(u.fullName || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{u.fullName || 'بدون اسم'}</p>
                              {u.role === 'admin' && <Crown className="w-3.5 h-3.5 text-gold" />}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                              <Mail className="w-3 h-3" /> {u.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-1 rounded-md font-medium ${
                            u.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {u.status === 'active' ? 'نشط' : 'معلق'}
                          </span>
                          {expandedUserId === u.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedUserId === u.id && (
                        <div className="border-t border-white/5 p-4 space-y-4 animate-fade-in">
                          {/* Info Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Email Verified */}
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                              <Mail className={`w-4 h-4 ${u.emailVerified ? 'text-green-400' : 'text-muted-foreground'}`} />
                              <div>
                                <p className="text-[10px] text-muted-foreground">البريد</p>
                                <p className="text-xs font-medium">{u.emailVerified ? 'متحقق ✓' : 'غير متحقق'}</p>
                              </div>
                            </div>
                            {/* Phone */}
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                              <Phone className={`w-4 h-4 ${u.phoneVerified ? 'text-green-400' : u.phone ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                              <div>
                                <p className="text-[10px] text-muted-foreground">الهاتف</p>
                                <p className="text-xs font-medium">{u.phone ? (u.phoneVerified ? '+967 ' + u.phone + ' ✓' : '+967 ' + u.phone) : 'غير محدد'}</p>
                              </div>
                            </div>
                            {/* Balance */}
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                              <DollarSign className="w-4 h-4 text-gold" />
                              <div>
                                <p className="text-[10px] text-muted-foreground">الرصيد</p>
                                <p className="text-xs font-bold gold-text">{u.balance.toFixed(2)} USDT</p>
                              </div>
                            </div>
                            {/* KYC Status */}
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                              <BadgeCheck className={`w-4 h-4 ${
                                u.kycStatus === 'approved' ? 'text-green-400' :
                                u.kycStatus === 'pending' ? 'text-yellow-400' :
                                u.kycStatus === 'rejected' ? 'text-red-400' : 'text-muted-foreground'
                              }`} />
                              <div>
                                <p className="text-[10px] text-muted-foreground">الهوية (KYC)</p>
                                <p className={`text-xs font-medium ${
                                  u.kycStatus === 'approved' ? 'text-green-400' :
                                  u.kycStatus === 'pending' ? 'text-yellow-400' :
                                  u.kycStatus === 'rejected' ? 'text-red-400' : ''
                                }`}>
                                  {u.kycStatus === 'approved' ? 'مقبول ✓' :
                                   u.kycStatus === 'pending' ? 'قيد المراجعة' :
                                   u.kycStatus === 'rejected' ? 'مرفوض' : 'لا يوجد'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Role & Registration Date */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                            <div className="flex items-center gap-2">
                              <Star className="w-3.5 h-3.5" />
                              <span>الدور: <strong className="text-foreground">{ROLE_LABELS[u.role] || u.role}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5" />
                              <span>تاريخ التسجيل: {formatDate(u.createdAt)}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            {u.status === 'active' ? (
                              <button
                                onClick={() => handleUpdateUser(u.id, { status: 'suspended' })}
                                disabled={actionLoading === u.id}
                                className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                              >
                                {actionLoading === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                                تعليق
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateUser(u.id, { status: 'active' })}
                                disabled={actionLoading === u.id}
                                className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors font-medium"
                              >
                                {actionLoading === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                                تفعيل
                              </button>
                            )}
                            <button
                              onClick={() => handleRoleChange(u)}
                              disabled={actionLoading === u.id}
                              className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors font-medium"
                            >
                              {actionLoading === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                              {u.role === 'admin' ? 'إزالة إدارة' : 'ترقية'}
                            </button>
                            <button
                              onClick={() => setScreen('kyc')}
                              disabled={u.kycStatus !== 'pending'}
                              className={`flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg transition-colors font-medium ${
                                u.kycStatus === 'pending'
                                  ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                  : 'bg-white/5 text-muted-foreground cursor-not-allowed'
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              مراجعة الهوية
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================== DEPOSITS TAB ===================== */}
          {activeTab === 'deposits' && (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {deposits.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">لا توجد إيداعات</div>
              ) : (
                deposits.map((d) => (
                  <div key={d.id} className="glass-card p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{d.user.fullName || d.user.email}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{d.txId || d.id.substring(0, 12)}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold gold-text">{d.amount.toFixed(2)} USDT</p>
                        <span className={`text-xs px-2 py-0.5 rounded-md status-${d.status}`}>
                          {d.status === 'pending' ? 'معلق' : d.status === 'confirmed' ? 'مؤكد' : 'مرفوض'}
                        </span>
                      </div>
                    </div>
                    {d.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleUpdateDeposit(d.id, 'confirmed')} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                          <Check className="w-3 h-3" /> تأكيد
                        </button>
                        <button onClick={() => handleUpdateDeposit(d.id, 'rejected')} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          <X className="w-3 h-3" /> رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ===================== WITHDRAWALS TAB ===================== */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {withdrawals.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">لا توجد سحوبات</div>
              ) : (
                withdrawals.map((w) => (
                  <div key={w.id} className="glass-card p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{w.user.fullName || w.user.email}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{w.toAddress.substring(0, 16)}...</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold gold-text">{w.amount.toFixed(2)} USDT</p>
                        <span className={`text-xs px-2 py-0.5 rounded-md status-${w.status === 'approved' || w.status === 'confirmed' ? 'approved' : w.status}`}>
                          {w.status === 'pending' ? 'معلق' : w.status === 'processing' ? 'قيد المعالجة' : w.status === 'approved' || w.status === 'confirmed' ? 'مقبول' : 'مرفوض'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">الرسوم: {w.fee.toFixed(2)} USDT</div>
                    {w.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleUpdateWithdrawal(w.id, 'approved')} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                          <Check className="w-3 h-3" /> قبول
                        </button>
                        <button onClick={() => handleUpdateWithdrawal(w.id, 'rejected')} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          <X className="w-3 h-3" /> رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ===================== KYC TAB ===================== */}
          {activeTab === 'kyc' && (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {kycRecords.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">لا توجد طلبات تحقق</div>
              ) : (
                kycRecords.map((k) => (
                  <div key={k.id} className="glass-card p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{k.user.fullName || k.user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {k.type === 'id_photo' ? 'صورة الهوية' : 'صورة شخصية'}
                          {k.user.phone ? ` | ${k.user.phone}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-md status-${k.status}`}>
                        {k.status === 'pending' ? 'معلق' : k.status === 'approved' ? 'مقبول' : 'مرفوض'}
                      </span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      <img src={k.fileUrl} alt={k.type} className="w-full h-40 object-cover" />
                    </div>
                    {k.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateKYC(k.id, 'approved', k.userId)} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                          <Check className="w-3 h-3" /> قبول
                        </button>
                        <button onClick={() => handleUpdateKYC(k.id, 'rejected', k.userId)} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          <X className="w-3 h-3" /> رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ===================== ROLE CHANGE DIALOG ===================== */}
      {roleDialogUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setRoleDialogUser(null)}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full max-w-sm rounded-2xl p-6 space-y-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto">
                <Crown className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold">
                {roleDialogUser.role === 'admin' ? 'إزالة صلاحية الإدارة' : 'ترقية إلى إدارة'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {roleDialogUser.fullName || roleDialogUser.email}
              </p>
            </div>

            {/* Permissions */}
            {roleDialogUser.role !== 'admin' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">اختر الصلاحيات:</p>
                {[
                  { key: 'manageUsers' as const, label: 'إدارة المستخدمين (تعليق/تفعيل)', icon: UserCheck },
                  { key: 'approveDeposits' as const, label: 'الموافقة على الإيداعات', icon: ArrowDownLeft },
                  { key: 'approveWithdrawals' as const, label: 'الموافقة على السحوبات', icon: ArrowUpRight },
                  { key: 'approveKYC' as const, label: 'الموافقة على الهويات (KYC)', icon: BadgeCheck },
                ].map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions[perm.key]}
                      onChange={(e) => setSelectedPermissions({ ...selectedPermissions, [perm.key]: e.target.checked })}
                      className="w-4 h-4 rounded accent-gold"
                    />
                    <perm.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{perm.label}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={confirmRoleChange}
                disabled={actionLoading === roleDialogUser.id}
                className="flex-1 h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all"
              >
                {actionLoading === roleDialogUser.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                 roleDialogUser.role === 'admin' ? 'إزالة الإدارة' : 'ترقية'}
              </button>
              <button
                onClick={() => setRoleDialogUser(null)}
                className="flex-1 h-11 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
