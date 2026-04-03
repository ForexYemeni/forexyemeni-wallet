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
  Eye,
  Search,
} from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  role: string
  status: string
  kycStatus: string
  balance: number
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

export default function AdminPanel() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'deposits' | 'withdrawals' | 'kyc'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [deposits, setDeposits] = useState<AdminDeposit[]>([])
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [kycRecords, setKycRecords] = useState<KYCRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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
      if (usersData.success) setUsers(usersData.users)
      if (depositsData.success) setDeposits(depositsData.deposits)
      if (withdrawalsData.success) setWithdrawals(withdrawalsData.withdrawals)
      if (kycData.success) setKycRecords(kycData.kycRecords)
    } catch {
      toast.error('خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDeposit = async (depositId: string, status: string) => {
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
    }
  }

  const handleUpdateWithdrawal = async (withdrawalId: string, status: string, txId?: string) => {
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
    }
  }

  const handleUpdateKYC = async (recordId: string, status: string, userId: string) => {
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
    }
  }

  const handleUpdateUser = async (userId: string, updates: Record<string, unknown>) => {
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
    }
  }

  const tabs = [
    { key: 'users', label: 'المستخدمون', icon: Users, count: users.length },
    { key: 'deposits', label: 'الإيداعات', icon: ArrowDownLeft, count: deposits.filter(d => d.status === 'pending').length },
    { key: 'withdrawals', label: 'السحوبات', icon: ArrowUpRight, count: withdrawals.filter(w => w.status === 'pending').length },
    { key: 'kyc', label: 'التحقق', icon: Shield, count: kycRecords.filter(k => k.status === 'pending').length },
  ]

  const filteredUsers = users.filter(u =>
    u.email.includes(searchQuery) || u.fullName?.includes(searchQuery) || u.id.includes(searchQuery)
  )

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
      <div>
        <h1 className="text-xl font-bold gold-text">لوحة الإدارة</h1>
        <p className="text-sm text-muted-foreground">إدارة المستخدمين والعمليات</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
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
            <div key={i} className="glass-card p-4 shimmer h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالبريد أو الاسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input h-10 pr-10 text-sm"
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="glass-card p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{u.fullName || 'بدون اسم'}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{u.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-md ${
                        u.status === 'active' ? 'status-approved' : u.status === 'suspended' ? 'status-rejected' : 'status-pending'
                      }`}>
                        {u.status === 'active' ? 'نشط' : u.status === 'suspended' ? 'معلق' : u.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>الرصيد: {u.balance.toFixed(2)} USDT</span>
                      <span>KYC: {u.kycStatus === 'approved' ? 'مقبول' : u.kycStatus === 'pending' ? 'قيد المراجعة' : u.kycStatus === 'rejected' ? 'مرفوض' : 'لا يوجد'}</span>
                    </div>
                    <div className="flex gap-2">
                      {u.status === 'active' ? (
                        <button onClick={() => handleUpdateUser(u.id, { status: 'suspended' })} className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">تعليق</button>
                      ) : (
                        <button onClick={() => handleUpdateUser(u.id, { status: 'active' })} className="flex-1 text-xs py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">تفعيل</button>
                      )}
                      <button onClick={() => handleUpdateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })} className="flex-1 text-xs py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors">
                        {u.role === 'admin' ? 'إزالة أدمن' : 'ترقية أدمن'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deposits Tab */}
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

          {/* Withdrawals Tab */}
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

          {/* KYC Tab */}
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
    </div>
  )
}
