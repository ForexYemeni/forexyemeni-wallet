'use client'

import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { compressImage, fileToBase64 } from '@/lib/image-compress'
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
  CreditCard,
  Plus,
  Wallet,
  Building,
  Trash2,
  Power,
  AlertTriangle,
  Lock,
  Send,
  Copy,
  Check as CheckIcon,
  Settings,
  Upload,
  ImageOff,
  TrendingUp,
  Activity,
  BarChart3,
  ArrowDownCircle,
  ArrowUpCircle,
  FileCheck,
  MessageCircle,
  MessageSquare,
  Gift,
  Repeat,
  Store,
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
  merchantId?: string | null
}

interface AdminDeposit {
  id: string
  amount: number
  fee?: number
  netAmount?: number
  txId: string | null
  status: string
  createdAt: string
  screenshot?: string | null
  user: { id: string; email: string; fullName: string | null }
}

interface AdminWithdrawal {
  id: string
  amount: number
  fee: number
  netAmount?: number
  toAddress: string
  method: string
  network: string
  status: string
  createdAt: string
  screenshot?: string | null
  adminNote?: string | null
  paymentMethodName?: string | null
  user: { id: string; email: string; fullName: string | null; phone: string | null }
}

interface AdminStats {
  totalUsers: number
  activeUsers: number
  suspendedUsers: number
  newUsersToday: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  kycApproved: number
  kycPending: number
  kycRejected: number
  kycRecordsPending: number
  depositsPending: number
  depositsReviewing: number
  depositsConfirmed: number
  depositsRejected: number
  totalDepositsAmount: number
  totalDepositFees: number
  depositsTodayCount: number
  depositsTodayAmount: number
  depositsThisWeekAmount: number
  depositsThisMonthAmount: number
  withdrawalsPending: number
  withdrawalsApproved: number
  withdrawalsProcessing: number
  withdrawalsRejected: number
  totalWithdrawalsAmount: number
  totalWithdrawalFees: number
  withdrawalsTodayCount: number
  withdrawalsTodayAmount: number
  withdrawalsThisWeekAmount: number
  withdrawalsThisMonthAmount: number
  totalFees: number
  adminBalance: number
  pendingActions: number
  recentActivity: any[]
}

interface KYCRecordItem {
  id: string
  type: string
  fileUrl: string
  status: string
  userId: string
  notes?: string | null
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

// ===================== MAIN COMPONENT =====================

export default function AdminPanel() {
  const { user, setScreen } = useAuthStore()
  const AdminFaqManager = lazy(() => import('@/components/admin/AdminFaqManager'))
  const AdminReferralSettings = lazy(() => import('@/components/admin/AdminReferralSettings'))
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'deposits' | 'withdrawals' | 'kyc' | 'payment-methods' | 'admin-settings' | 'faq-bot' | 'chats' | 'referral-settings' | 'p2p'>('dashboard')
  const AdminChat = lazy(() => import('@/components/admin/AdminChat'))
  const AdminP2P = lazy(() => import('@/components/admin/AdminP2P'))
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  // Listen for sidebar sub-navigation tab changes
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail
      if (tab) setActiveTab(tab as any)
    }
    window.addEventListener('admin-tab-change', handler)
    return () => window.removeEventListener('admin-tab-change', handler)
  }, [])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [deposits, setDeposits] = useState<AdminDeposit[]>([])
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [kycRecords, setKycRecords] = useState<KYCRecordItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [adminSettings, setAdminSettings] = useState<{ email: string; phone: string | null; hasPIN: boolean }>({ email: '', phone: null, hasPIN: false })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [roleDialogUser, setRoleDialogUser] = useState<AdminUser | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<AdminPermission>(DEFAULT_PERMISSIONS)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  // Delete user dialog state
  const [deleteDialogUser, setDeleteDialogUser] = useState<AdminUser | null>(null)
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'otp' | 'password'>('confirm')
  const [deleteOtp, setDeleteOtp] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [copiedWithdrawalId, setCopiedWithdrawalId] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  // Rejection reason dialog
  const [rejectDialog, setRejectDialog] = useState<{ withdrawalId: string; amount: number } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  // KYC rejection dialog
  const [kycRejectDialog, setKycRejectDialog] = useState<{ recordId: string; userId: string } | null>(null)
  const [kycRejectReason, setKycRejectReason] = useState('')
  const [kycRejectLoading, setKycRejectLoading] = useState(false)
  // Device management dialog state
  const [deviceDialogUser, setDeviceDialogUser] = useState<AdminUser | null>(null)
  const [deviceList, setDeviceList] = useState<any[]>([])
  const [pendingDevice, setPendingDevice] = useState<any>(null)
  const [deviceLoading, setDeviceLoading] = useState(false)
  // Withdrawal payment proof upload
  const [proofDialogWithdrawal, setProofDialogWithdrawal] = useState<AdminWithdrawal | null>(null)
  const proofInputRef = useRef<HTMLInputElement>(null)
  const [proofLoading, setProofLoading] = useState(false)
  // Full image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  // Stats state
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  // Balance adjustment dialog state
  const [balanceDialogUser, setBalanceDialogUser] = useState<AdminUser | null>(null)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceAction, setBalanceAction] = useState<'add' | 'withdraw'>('add')
  const [balanceLoading, setBalanceLoading] = useState(false)
  // Remove merchant dialog state
  const [removeMerchantDialogUser, setRemoveMerchantDialogUser] = useState<AdminUser | null>(null)
  const [removeMerchantLoading, setRemoveMerchantLoading] = useState(false)

  // Track which tabs have been loaded to avoid re-fetching
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set())

  // Fetch data when switching tabs (lazy load)
  useEffect(() => {
    if (user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))) {
      if (!loadedTabs.has(activeTab) && activeTab !== 'users') {
        fetchTabData(activeTab)
        setLoadedTabs(prev => new Set(prev).add(activeTab))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Initial load: fetch stats + users tab data
  useEffect(() => {
    if (user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))) {
      const initLoad = async () => {
        setLoading(true)
        try {
          await Promise.all([fetchStats(), fetchUsers()])
        } finally {
          setLoading(false)
        }
      }
      initLoad()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.success) setUsers(data.users || [])
    } catch { /* silent */ }
  }

  const fetchDeposits = async () => {
    try {
      const res = await fetch('/api/admin/deposits')
      const data = await res.json()
      if (data.success) setDeposits(data.deposits || [])
    } catch { /* silent */ }
  }

  const fetchWithdrawals = async () => {
    try {
      const res = await fetch('/api/admin/withdrawals')
      const data = await res.json()
      if (data.success) setWithdrawals(data.withdrawals || [])
    } catch { /* silent */ }
  }

  const fetchKYC = async () => {
    try {
      const res = await fetch('/api/admin/kyc')
      const data = await res.json()
      if (data.success) setKycRecords(data.kycRecords || [])
    } catch { /* silent */ }
  }

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch('/api/admin/payment-methods')
      const data = await res.json()
      if (data.success) setPaymentMethods(data.methods || [])
    } catch { /* silent */ }
  }

  const fetchAdminSettings = async () => {
    if (user?.role === 'admin' && !user.permissions) {
      try {
        const res = await fetch(`/api/admin/settings?userId=${user.id}`)
        const data = await res.json()
        if (data.success) setAdminSettings(data.settings)
      } catch { /* silent */ }
    }
  }

  const fetchFees = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      return data.settings || {}
    } catch { return {} }
  }

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      if (data.success) setStats(data.stats)
    } catch { /* silent */ }
    finally { setStatsLoading(false) }
  }

  const fetchTabData = (tab: string) => {
    switch (tab) {
      case 'dashboard': fetchStats(); break
      case 'deposits': fetchDeposits(); break
      case 'withdrawals': fetchWithdrawals(); break
      case 'kyc': fetchKYC(); break
      case 'payment-methods': fetchPaymentMethods(); break
      case 'admin-settings': fetchAdminSettings(); break
    }
  }

  // Lightweight refresh: only re-fetch the affected tab
  const refreshCurrentTab = () => {
    fetchTabData(activeTab)
  }

  // Refresh a specific tab without loading spinner
  const refreshTab = (tab: string) => {
    fetchTabData(tab)
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
        toast.success(
          status === 'confirmed' ? 'تم تأكيد الإيداع' :
          status === 'reviewing' ? 'تم تحويل للمراجعة' :
          'تم رفض الإيداع'
        )
        fetchDeposits(); fetchUsers()
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
        fetchWithdrawals(); fetchUsers()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث السحب')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateKYC = async (recordId: string, status: string, userId: string, adminNote?: string) => {
    setActionLoading(recordId)
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, status, userId, adminNote }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(status === 'approved' ? 'تم قبول المستند' : 'تم رفض المستند')
        if (kycRejectDialog) setKycRejectDialog(null)
        fetchKYC(); fetchUsers()
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
        fetchUsers()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث المستخدم')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRoleChange = (targetUser: AdminUser, _newRole: string) => {
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
        fetchUsers()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تحديث الصلاحيات')
    } finally {
      setActionLoading(null)
    }
  }

  // ===== DELETE USER HANDLERS =====
  const openDeleteDialog = (targetUser: AdminUser) => {
    setDeleteDialogUser(targetUser)
    setDeleteStep('confirm')
    setDeleteOtp('')
    setDeletePassword('')
  }

  const closeDeleteDialog = () => {
    setDeleteDialogUser(null)
    setDeleteStep('confirm')
    setDeleteOtp('')
    setDeletePassword('')
    setDeleteLoading(false)
  }

  const handleSendDeleteOtp = async () => {
    if (!deleteDialogUser || !user?.id) return
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, userId: deleteDialogUser.id, step: 'send_otp' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setDeleteStep('otp')
        if (data.debugOtp) {
          toast.info(`رمز التحقق (للتطوير): ${data.debugOtp}`)
        }
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في إرسال رمز التحقق')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleVerifyDeleteOtp = async () => {
    if (!deleteDialogUser || !user?.id || !deleteOtp) return
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, userId: deleteDialogUser.id, step: 'verify_otp', otp: deleteOtp }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setDeleteStep('password')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في التحقق')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteDialogUser || !user?.id || !deletePassword) return
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, userId: deleteDialogUser.id, step: 'confirm_delete', password: deletePassword }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        closeDeleteDialog()
        fetchUsers()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في حذف المستخدم')
    } finally {
      setDeleteLoading(false)
    }
  }

  const copyWithdrawalAddress = (w: AdminWithdrawal) => {
    navigator.clipboard.writeText(w.toAddress)
    setCopiedWithdrawalId(w.id)
    toast.success('تم النسخ')
    setTimeout(() => setCopiedWithdrawalId(null), 2000)
  }

  const copyField = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(key)
    toast.success('تم النسخ')
    setTimeout(() => setCopiedField(null), 2000)
  }

  const openRejectDialog = (w: AdminWithdrawal) => {
    setRejectDialog({ withdrawalId: w.id, amount: w.amount })
    setRejectReason('')
  }

  const handleRejectWithReason = async () => {
    if (!rejectDialog) return
    if (!rejectReason.trim()) { toast.error('يرجى إدخال سبب الرفض'); return }
    setRejectLoading(true)
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: rejectDialog.withdrawalId, status: 'rejected', adminNote: rejectReason.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم رفض السحب')
        setRejectDialog(null)
        refreshTab('withdrawals')
        fetchUsers()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في رفض السحب')
    } finally {
      setRejectLoading(false)
    }
  }

  // ===== DEVICE MANAGEMENT HANDLERS =====
  const openDeviceDialog = async (targetUser: AdminUser) => {
    setDeviceDialogUser(targetUser)
    setDeviceLoading(true)
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user?.id, targetUserId: targetUser.id, action: 'list' }),
      })
      const data = await res.json()
      if (data.success) {
        setDeviceList(data.devices || [])
        setPendingDevice(data.pendingDevice || null)
      } else {
        setDeviceList([])
        setPendingDevice(null)
      }
    } catch {
      setDeviceList([])
      setPendingDevice(null)
    } finally {
      setDeviceLoading(false)
    }
  }

  const handleAuthorizeDevice = async () => {
    if (!deviceDialogUser) return
    setDeviceLoading(true)
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user?.id,
          targetUserId: deviceDialogUser.id,
          action: 'authorize',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setPendingDevice(null)
        openDeviceDialog(deviceDialogUser) // Refresh list
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في التصريح')
    } finally {
      setDeviceLoading(false)
    }
  }

  const handleRemoveAllDevices = async () => {
    if (!deviceDialogUser || !confirm('هل أنت متأكد من إزالة جميع الأجهزة؟')) return
    setDeviceLoading(true)
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user?.id, targetUserId: deviceDialogUser.id, action: 'remove_all' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setDeviceList([])
        setPendingDevice(null)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في إزالة الأجهزة')
    } finally {
      setDeviceLoading(false)
    }
  }

  // ===== WITHDRAWAL PAYMENT PROOF =====
  const openProofDialog = (w: AdminWithdrawal) => {
    setProofDialogWithdrawal(w)
  }

  const handleUploadProof = async () => {
    if (!proofDialogWithdrawal || !proofInputRef.current?.files?.[0]) return
    setProofLoading(true)
    try {
      const file = proofInputRef.current.files[0]
      const compressed = await compressImage(file)
      const screenshotBase64 = await fileToBase64(compressed)

      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: proofDialogWithdrawal.id,
          status: 'processing',
          screenshot: screenshotBase64,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم رفع إثبات الدفع بنجاح')
        setProofDialogWithdrawal(null)
        refreshTab('withdrawals')
        fetchUsers()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في رفع الصورة')
    } finally {
      setProofLoading(false)
    }
  }

  // ===== BALANCE ADJUSTMENT HANDLER =====
  const handleAdjustBalance = async () => {
    if (!balanceDialogUser || !balanceAmount || parseFloat(balanceAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }
    setBalanceLoading(true)
    try {
      const amount = parseFloat(balanceAmount)
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: balanceDialogUser.id,
          balanceAdjustment: balanceAction === 'add' ? amount : -amount,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(balanceAction === 'add' ? `تم إضافة ${amount} USDT` : `تم سحب ${amount} USDT`)
        setBalanceDialogUser(null)
        setBalanceAmount('')
        fetchUsers()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في تعديل الرصيد')
    } finally {
      setBalanceLoading(false)
    }
  }

  // ===== REMOVE MERCHANT STATUS HANDLER =====
  const handleRemoveMerchant = async () => {
    if (!removeMerchantDialogUser || !confirm('هل أنت متأكد من إزالة حالة التاجر؟ سيتم تحويل الحساب إلى مستخدم عادي.')) return
    setRemoveMerchantLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: removeMerchantDialogUser.id,
          merchantId: null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إزالة حالة التاجر بنجاح')
        setRemoveMerchantDialogUser(null)
        fetchUsers()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في إزالة حالة التاجر')
    } finally {
      setRemoveMerchantLoading(false)
    }
  }

  // Determine if user has specific permissions
  const hasPermissions = user?.permissions && Object.keys(user.permissions).length > 0

  const allTabs = [
    { key: 'dashboard' as const, label: 'الإحصائيات', icon: BarChart3, count: stats?.pendingActions || 0, perm: null as string | null },
    { key: 'users' as const, label: 'المستخدمون', icon: Users, count: users.length, perm: 'manageUsers' as const },
    { key: 'deposits' as const, label: 'الإيداعات', icon: ArrowDownLeft, count: deposits.filter(d => d.status === 'pending' || d.status === 'reviewing').length, perm: 'approveDeposits' as const },
    { key: 'withdrawals' as const, label: 'السحوبات', icon: ArrowUpRight, count: withdrawals.filter(w => w.status === 'pending' || w.status === 'approved').length, perm: 'approveWithdrawals' as const },
    { key: 'kyc' as const, label: 'التحقق', icon: Shield, count: kycRecords.filter(k => k.status === 'pending').length, perm: 'approveKYC' as const },
    { key: 'payment-methods' as const, label: 'طرق الدفع', icon: CreditCard, count: paymentMethods.filter(p => p.isActive).length, perm: 'manageUsers' as const },
    { key: 'referral-settings' as const, label: 'برنامج الدعوات', icon: Gift, count: 0, perm: 'manageSettings' as const },
    ...(user?.role === 'admin' && !hasPermissions ? [{ key: 'admin-settings' as const, label: 'إعدادات الإدارة', icon: Settings, count: 0, perm: 'manageSettings' as const }] : []),
    { key: 'chats' as const, label: 'المحادثات', icon: MessageCircle, count: chatUnreadCount, perm: null as string | null },
    { key: 'faq-bot' as const, label: 'البوت والأسئلة', icon: MessageSquare, count: 0, perm: 'manageSettings' as const },
    { key: 'p2p' as const, label: 'P2P والنزاعات', icon: Repeat, count: 0, perm: 'manageUsers' as const },
  ]

  const tabs = hasPermissions
    ? allTabs.filter(tab => tab.perm === null || user.permissions?.[tab.perm])
    : allTabs

  const allowedTabKeys = tabs.map(t => t.key)
  const effectiveActiveTab = allowedTabKeys.includes(activeTab) ? activeTab : allowedTabKeys[0] || 'dashboard'

  // Only hide the main admin (role=admin without permissions) from user list
  // Promoted admins (role=admin WITH permissions) are visible
  const filteredUsers = users
    .filter(u => {
      if (u.role === 'admin' && !u.permissions) return false
      return true
    })
    .filter(u =>
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

  const canAccess = user?.role === 'admin' || (user?.permissions && Object.values(user.permissions).some(v => v))

  const DEPOSIT_STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending: { label: 'تم استلام طلبك', color: 'text-yellow-400 bg-yellow-500/10' },
    reviewing: { label: 'طلبك قيد المراجعة', color: 'text-blue-400 bg-blue-500/10' },
    confirmed: { label: 'تم التأكيد', color: 'text-green-400 bg-green-500/10' },
    rejected: { label: 'مرفوض', color: 'text-red-400 bg-red-500/10' },
  }

  const WITHDRAWAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending: { label: 'معلق', color: 'text-yellow-400 bg-yellow-500/10' },
    approved: { label: 'تم قبول السحب - قيد المراجعة', color: 'text-blue-400 bg-blue-500/10' },
    processing: { label: 'تم السحب', color: 'text-green-400 bg-green-500/10' },
    rejected: { label: 'مرفوض', color: 'text-red-400 bg-red-500/10' },
  }

  if (!canAccess) {
    return (
      <div className="glass-card p-8 text-center">
        <Shield className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-muted-foreground">ليس لديك صلاحية الوصول</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold gold-text">لوحة الإدارة</h1>
          <p className="text-sm text-muted-foreground">إدارة المستخدمين والعمليات</p>
        </div>
        <div className="flex items-center gap-2">
          {stats?.pendingActions ? (
            <button
              onClick={() => setActiveTab('dashboard')}
              className="glass-card px-3 py-2 flex items-center gap-2 text-xs cursor-pointer hover:bg-white/10 transition-colors"
            >
              <Activity className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-bold">{stats.pendingActions} عملية معلقة</span>
            </button>
          ) : null}
          <div className="glass-card px-3 py-2 flex items-center gap-2 text-xs">
            <Users className="w-4 h-4 text-gold" />
            <span>{users.length} مستخدم</span>
          </div>
        </div>
      </div>

      {/* FIX 10: Scrollable horizontal tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs transition-all relative whitespace-nowrap flex-shrink-0 ${
              effectiveActiveTab === tab.key
                ? 'bg-gold/10 text-gold border border-gold/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="w-5 h-5 bg-gold text-gray-900 text-[10px] font-bold rounded-full flex items-center justify-center">
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
        <div>
          {/* ===================== DASHBOARD / STATS TAB ===================== */}
          {effectiveActiveTab === 'dashboard' && (
            <div className="space-y-4">
              {statsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="glass-card p-4 shimmer h-28 rounded-xl" />
                  ))}
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  {/* Pending Actions Banner */}
                  {stats.pendingActions > 0 && (
                    <div className="glass-card p-4 rounded-xl border border-gold/20 bg-gold/5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gold">{stats.pendingActions} إجراء معلق</p>
                        <p className="text-xs text-muted-foreground">إيداعات وسحوبات وتوثيقات بانتظار المراجعة</p>
                      </div>
                    </div>
                  )}

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Users Card */}
                    <div className="glass-card p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-muted-foreground">إجمالي المستخدمين</span>
                      </div>
                      <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] text-green-400">+{stats.newUsersToday} اليوم</span>
                        <span className="text-[10px] text-blue-400">+{stats.newUsersThisWeek} الأسبوع</span>
                      </div>
                      <div className="flex gap-3 mt-2 text-[10px]">
                        <span className="text-green-400">نشط: {stats.activeUsers}</span>
                        <span className="text-red-400">معلق: {stats.suspendedUsers}</span>
                      </div>
                    </div>

                    {/* Deposits Card */}
                    <div className="glass-card p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowDownLeft className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-muted-foreground">الإيداعات</span>
                      </div>
                      <p className="text-2xl font-bold text-green-400">{stats.totalDepositsAmount.toLocaleString()}</p>
                      <span className="text-[10px] text-muted-foreground">YER إجمالي المبالغ المؤكدة</span>
                      <div className="flex gap-3 mt-2 text-[10px]">
                        <span className="text-yellow-400">معلق: {stats.depositsPending}</span>
                        <span className="text-green-400">مؤكد: {stats.depositsConfirmed}</span>
                      </div>
                    </div>

                    {/* Withdrawals Card */}
                    <div className="glass-card p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowUpRight className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-muted-foreground">السحوبات</span>
                      </div>
                      <p className="text-2xl font-bold text-red-400">{stats.totalWithdrawalsAmount.toLocaleString()}</p>
                      <span className="text-[10px] text-muted-foreground">YER إجمالي المبالغ المحولة</span>
                      <div className="flex gap-3 mt-2 text-[10px]">
                        <span className="text-yellow-400">معلق: {stats.withdrawalsPending}</span>
                        <span className="text-green-400">مكتمل: {stats.withdrawalsProcessing}</span>
                      </div>
                    </div>

                    {/* Fees & Balance Card */}
                    <div className="glass-card p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 text-gold" />
                        <span className="text-xs text-muted-foreground">الإيرادات والرصيد</span>
                      </div>
                      <p className="text-lg font-bold text-gold">{stats.totalFees.toLocaleString()} <span className="text-xs">YER رسوم</span></p>
                      <p className="text-sm font-medium mt-1">{stats.adminBalance.toLocaleString()} <span className="text-xs text-muted-foreground">YER رصيد الإدارة</span></p>
                    </div>
                  </div>

                  {/* KYC Stats */}
                  <div className="glass-card p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-bold">التوثيق (KYC)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-yellow-400">{stats.kycPending + stats.kycRecordsPending}</p>
                        <p className="text-[10px] text-muted-foreground">معلق</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-green-400">{stats.kycApproved}</p>
                        <p className="text-[10px] text-muted-foreground">مقبول</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-red-400">{stats.kycRejected}</p>
                        <p className="text-[10px] text-muted-foreground">مرفوض</p>
                      </div>
                    </div>
                  </div>

                  {/* Today's Summary */}
                  <div className="glass-card p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-gold" />
                      <span className="text-sm font-bold">ملخص اليوم</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between bg-green-500/5 rounded-lg p-3">
                        <div>
                          <p className="text-xs text-muted-foreground">إيداعات اليوم</p>
                          <p className="text-lg font-bold text-green-400">{stats.depositsTodayAmount.toLocaleString()} YER</p>
                        </div>
                        <span className="text-2xl font-bold text-green-400/30">{stats.depositsTodayCount}</span>
                      </div>
                      <div className="flex items-center justify-between bg-red-500/5 rounded-lg p-3">
                        <div>
                          <p className="text-xs text-muted-foreground">سحوبات اليوم</p>
                          <p className="text-lg font-bold text-red-400">{stats.withdrawalsTodayAmount.toLocaleString()} YER</p>
                        </div>
                        <span className="text-2xl font-bold text-red-400/30">{stats.withdrawalsTodayCount}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="text-center bg-blue-500/5 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">إيداعات الأسبوع</p>
                        <p className="text-sm font-bold">{stats.depositsThisWeekAmount.toLocaleString()} YER</p>
                      </div>
                      <div className="text-center bg-purple-500/5 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">إيداعات الشهر</p>
                        <p className="text-sm font-bold">{stats.depositsThisMonthAmount.toLocaleString()} YER</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  {stats.recentActivity && stats.recentActivity.length > 0 && (
                    <div className="glass-card p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-gold" />
                        <span className="text-sm font-bold">أحدث العمليات</span>
                      </div>
                      <div className="space-y-2">
                        {stats.recentActivity.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-2">
                              {item.type === 'deposit' ? (
                                <ArrowDownCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <ArrowUpCircle className="w-4 h-4 text-red-400" />
                              )}
                              <div>
                                <p className="text-xs font-medium">{item.type === 'deposit' ? 'إيداع' : 'سحب'}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-SA') : ''}
                                </p>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-bold">{(item.amount || 0).toLocaleString()} YER</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                item.status === 'confirmed' || item.status === 'processing' ? 'bg-green-500/10 text-green-400' :
                                item.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                'bg-red-500/10 text-red-400'
                              }`}>
                                {item.status === 'confirmed' ? 'مؤكد' :
                                 item.status === 'processing' ? 'مكتمل' :
                                 item.status === 'pending' ? 'معلق' : 'مرفوض'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                  تعذر تحميل الإحصائيات
                </div>
              )}
            </div>
          )}

          {/* ===================== USERS TAB ===================== */}
          {effectiveActiveTab === 'users' && (
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
                      <div
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                            u.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {(u.fullName || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{u.fullName || 'بدون اسم'}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                              <Mail className="w-3 h-3" /> {u.email}
                            </p>
                            {u.merchantId && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium flex items-center gap-0.5">
                                <Store className="w-2.5 h-2.5" />
                                تاجر
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-1 rounded-md font-medium ${
                            u.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {u.status === 'active' ? 'نشط' : u.status === 'locked_device' ? '🔒 مقفل' : 'معلق'}
                          </span>
                          {expandedUserId === u.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {expandedUserId === u.id && (
                        <div className="border-t border-white/5 p-4 space-y-4 animate-fade-in">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                              <Mail className={`w-4 h-4 ${u.emailVerified ? 'text-green-400' : 'text-muted-foreground'}`} />
                              <div>
                                <p className="text-[10px] text-muted-foreground">البريد</p>
                                <p className="text-xs font-medium">{u.emailVerified ? 'متحقق ✓' : 'غير متحقق'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                              <Phone className={`w-4 h-4 ${u.phoneVerified ? 'text-green-400' : u.phone ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                              <div>
                                <p className="text-[10px] text-muted-foreground">الهاتف</p>
                                <p className="text-xs font-medium">{u.phone ? (u.phoneVerified ? '+967 ' + u.phone + ' ✓' : '+967 ' + u.phone) : 'غير محدد'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
                              <DollarSign className="w-4 h-4 text-gold" />
                              <div>
                                <p className="text-[10px] text-muted-foreground">الرصيد</p>
                                <p className="text-xs font-bold gold-text">{(u.balance ?? 0).toFixed(2)} USDT</p>
                              </div>
                            </div>
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

                          {/* Action buttons: main admin sees all, sub-admin sees limited */}
                          <div className="grid grid-cols-4 gap-2 pt-2">
                            {/* Suspend / Activate — main admin always, sub-admin only for regular users */}
                            {(!hasPermissions || (hasPermissions && u.role !== 'admin')) && (
                              u.status === 'active' ? (
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
                                  {u.status === 'locked_device' ? 'فتح' : 'تفعيل'}
                                </button>
                              )
                            )}
                            {/* Device management — always visible (needed for locked_device unlock) */}
                            <button
                              onClick={() => openDeviceDialog(u)}
                              className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors font-medium"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              الأجهزة
                            </button>
                            {/* Promote / Remove admin — main admin only */}
                            {!hasPermissions && (
                              <button
                                onClick={() => handleRoleChange(u, u.role === 'admin' ? 'user' : 'admin')}
                                disabled={actionLoading === u.id}
                                className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors font-medium"
                              >
                                {actionLoading === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                                {u.role === 'admin' ? 'إزالة' : 'ترقية'}
                              </button>
                            )}
                            {/* Delete — main admin only */}
                            {!hasPermissions && (
                              <button
                                onClick={() => openDeleteDialog(u)}
                                className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600/20 transition-colors font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                حذف
                              </button>
                            )}
                            {/* Add balance — main admin only */}
                            {!hasPermissions && (
                              <button
                                onClick={() => { setBalanceDialogUser(u); setBalanceAction('add'); setBalanceAmount('') }}
                                className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors font-medium"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                إضافة رصيد
                              </button>
                            )}
                            {/* Withdraw balance — main admin only */}
                            {!hasPermissions && (
                              <button
                                onClick={() => { setBalanceDialogUser(u); setBalanceAction('withdraw'); setBalanceAmount('') }}
                                className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors font-medium"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                سحب رصيد
                              </button>
                            )}
                            {/* Remove merchant — main admin only, merchants only */}
                            {!hasPermissions && u.merchantId && (
                              <button
                                onClick={() => setRemoveMerchantDialogUser(u)}
                                className="flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors font-medium"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                إزالة التاجر
                              </button>
                            )}
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
          {effectiveActiveTab === 'deposits' && (
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
                        <p className="text-sm font-bold gold-text">{(d.netAmount ?? d.amount ?? 0).toFixed(2)} USDT</p>
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${DEPOSIT_STATUS_MAP[d.status]?.color || ''}`}>
                          {DEPOSIT_STATUS_MAP[d.status]?.label || d.status}
                        </span>
                      </div>
                    </div>
                    {/* Fee breakdown */}
                    {(d.fee ?? 0) > 0 && (
                      <div className="p-2 rounded-lg bg-white/5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">المبلغ المدفوع: <strong className="text-foreground">{(d.amount ?? 0).toFixed(2)} USDT</strong></span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">المبلغ الصافي للمستخدم: <strong className="text-green-400">{(d.netAmount ?? 0).toFixed(2)} USDT</strong></span>
                          <span className="text-muted-foreground">الرسوم → حساب الإدارة: <strong className="text-gold">{(d.fee ?? 0).toFixed(2)} USDT</strong></span>
                        </div>
                      </div>
                    )}
                    {/* Screenshot */}
                    {d.screenshot && (
                      <div className="pt-1">
                        <button
                          onClick={() => setPreviewImage(d.screenshot)}
                          className="rounded-xl overflow-hidden border border-white/10 block"
                        >
                          <img src={d.screenshot} alt="إثبات الدفع" className="w-full h-32 object-cover" />
                        </button>
                      </div>
                    )}
                    {/* Actions */}
                    {d.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleUpdateDeposit(d.id, 'reviewing')} disabled={actionLoading === d.id} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium">
                          <Eye className="w-3 h-3" /> مراجعة
                        </button>
                      </div>
                    )}
                    {d.status === 'reviewing' && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleUpdateDeposit(d.id, 'confirmed')} disabled={actionLoading === d.id} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors font-medium">
                          <Check className="w-3 h-3" /> تأكيد
                        </button>
                        <button onClick={() => handleUpdateDeposit(d.id, 'rejected')} disabled={actionLoading === d.id} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium">
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
          {effectiveActiveTab === 'withdrawals' && (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {withdrawals.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">لا توجد سحوبات</div>
              ) : (
                withdrawals.map((w) => (
                  <div key={w.id} className="glass-card rounded-xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-sm font-bold gold-text">
                          {(w.user.fullName || w.user.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{w.user.fullName || 'بدون اسم'}</p>
                          <p className="text-xs text-muted-foreground" dir="ltr">{w.user.email}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold gold-text">{(w.amount ?? 0).toFixed(2)} USDT</p>
                        {(w.fee ?? 0) > 0 && (
                          <p className="text-[10px] text-muted-foreground">الصافي: {(w.netAmount ?? (w.amount - w.fee) ?? 0).toFixed(2)} USDT</p>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${WITHDRAWAL_STATUS_MAP[w.status]?.color || ''}`}>
                          {WITHDRAWAL_STATUS_MAP[w.status]?.label || w.status}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <p className="text-xs text-muted-foreground font-medium mb-2">بيانات الساحب:</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {w.user.fullName && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 group">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">الاسم</span>
                              <span className="text-xs font-medium truncate">{w.user.fullName}</span>
                            </div>
                            <button onClick={() => copyField(`${w.id}-name`, w.user.fullName!)} className="text-muted-foreground hover:text-gold transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                              {copiedField === `${w.id}-name` ? <CheckIcon className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                        {w.user.phone && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 group">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">الهاتف</span>
                              <span className="text-xs font-medium truncate" dir="ltr">{w.user.phone}</span>
                            </div>
                            <button onClick={() => copyField(`${w.id}-phone`, w.user.phone!)} className="text-muted-foreground hover:text-gold transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                              {copiedField === `${w.id}-phone` ? <CheckIcon className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 group">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">البريد</span>
                            <span className="text-xs font-medium truncate" dir="ltr">{w.user.email}</span>
                          </div>
                          <button onClick={() => copyField(`${w.id}-email`, w.user.email)} className="text-muted-foreground hover:text-gold transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                            {copiedField === `${w.id}-email` ? <CheckIcon className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-2 mt-2">
                        <p className="text-xs text-muted-foreground font-medium mb-2">بيانات السحب:</p>
                        <div className="grid grid-cols-1 gap-1.5">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">الطريقة</span>
                              <span className="text-xs font-medium">
                                {w.paymentMethodName ||
                                 (w.method === 'crypto' || w.method === 'blockchain' ? 'عملات رقمية' :
                                  w.method === 'bank_deposit' ? 'إيداع لمحفظة' :
                                  w.method === 'atm_transfer' ? 'تحويل عبر صراف' :
                                  w.method === 'bank_transfer' ? 'تحويل بنكي' : w.method)}
                              </span>
                            </div>
                            {w.network && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gold/10 text-gold">{w.network}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 group">
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] text-muted-foreground block mb-0.5">
                                {w.method === 'crypto' || w.method === 'blockchain' ? 'عنوان المحفظة' : 'بيانات الاستلام'}
                              </span>
                              <p className={`text-xs font-medium ${w.method === 'crypto' || w.method === 'blockchain' ? 'font-mono' : ''}`}
                                 dir={w.method === 'crypto' || w.method === 'blockchain' ? 'ltr' : 'rtl'}>
                                {w.toAddress}
                              </p>
                            </div>
                            <button onClick={() => copyWithdrawalAddress(w)} className="text-gold hover:text-gold-light transition-colors flex-shrink-0 mr-2">
                              {copiedWithdrawalId === w.id ? <CheckIcon className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">الرسوم → حساب الإدارة: <strong className="text-gold">{(w.fee ?? 0).toFixed(2)} USDT</strong></span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">الصافي للمستلم: <strong className="text-green-400">{(w.netAmount ?? ((w.amount ?? 0) - (w.fee ?? 0))).toFixed(2)} USDT</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Payment proof */}
                      {w.screenshot && (
                        <div className="pt-2">
                          <button onClick={() => setPreviewImage(w.screenshot)} className="rounded-xl overflow-hidden border border-white/10 block">
                            <img src={w.screenshot} alt="إثبات الدفع" className="w-full h-32 object-cover" />
                          </button>
                        </div>
                      )}

                      {/* Date */}
                      <div className="text-[10px] text-muted-foreground pt-1">{formatDate(w.createdAt)}</div>
                    </div>

                    {/* Withdrawal Actions */}
                    {w.status === 'pending' && (
                      <div className="flex gap-2 p-4 pt-0">
                        <button onClick={() => handleUpdateWithdrawal(w.id, 'approved')} disabled={actionLoading === w.id} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium">
                          {actionLoading === w.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} قبول
                        </button>
                        <button onClick={() => openRejectDialog(w)} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium">
                          <X className="w-3 h-3" /> رفض
                        </button>
                      </div>
                    )}
                    {w.status === 'approved' && (
                      <div className="flex gap-2 p-4 pt-0">
                        <button onClick={() => openProofDialog(w)} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors font-medium">
                          <Upload className="w-3 h-3" /> رفع صورة الدفع
                        </button>
                        <button onClick={() => openRejectDialog(w)} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium">
                          <X className="w-3 h-3" /> رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ===================== PAYMENT METHODS TAB ===================== */}
          {effectiveActiveTab === 'payment-methods' && (
            <PaymentMethodsManager methods={paymentMethods} onRefresh={() => { fetchPaymentMethods() }} />
          )}

          {/* ===================== ADMIN SETTINGS TAB ===================== */}
          {effectiveActiveTab === 'admin-settings' && (
            <AdminSettingsPanel settings={adminSettings} onRefresh={fetchAdminSettings} />
          )}

          {/* ===================== CHATS TAB ===================== */}
          {effectiveActiveTab === 'chats' && (
            <Suspense fallback={
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />
                ))}
              </div>
            }>
              <AdminChat />
            </Suspense>
          )}

          {/* ===================== REFERRAL SETTINGS TAB ===================== */}
          {effectiveActiveTab === 'referral-settings' && (
            <Suspense fallback={
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />
                ))}
              </div>
            }>
              <AdminReferralSettings />
            </Suspense>
          )}

          {/* ===================== FAQ BOT TAB ===================== */}
          {effectiveActiveTab === 'faq-bot' && (
            <Suspense fallback={
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />
                ))}
              </div>
            }>
              <AdminFaqManager />
            </Suspense>
          )}

          {/* ===================== P2P TAB ===================== */}
          {effectiveActiveTab === 'p2p' && (
            <Suspense fallback={
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass-card p-4 shimmer h-24 rounded-xl" />
                ))}
              </div>
            }>
              <AdminP2P />
            </Suspense>
          )}

          {/* ===================== KYC TAB ===================== */}
          {effectiveActiveTab === 'kyc' && (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {kycRecords.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">لا توجد طلبات تحقق</div>
              ) : (
                kycRecords.map((k) => (
                  <div key={k.id} className="glass-card p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{k.user?.fullName || k.user?.email || 'مستخدم غير معروف'}</p>
                        <p className="text-xs text-muted-foreground">
                          {k.type === 'id_photo' ? 'صورة الهوية' : 'صورة شخصية'}
                          {k.user?.phone ? ` | ${k.user.phone}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-md status-${k.status}`}>
                        {k.status === 'pending' ? 'معلق' : k.status === 'approved' ? 'مقبول' : 'مرفوض'}
                      </span>
                    </div>
                    {/* FIX 3: Image with error handler */}
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5 relative">
                      <img
                        src={k.fileUrl || ''}
                        alt={k.type}
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-white/5 hidden">
                        <div className="text-center">
                          <ImageOff className="w-8 h-8 text-muted-foreground/30 mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground">فشل تحميل الصورة</p>
                        </div>
                      </div>
                    </div>
                    {/* Notes */}
                    {k.notes && (
                      <div className="p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-400">
                        سبب الرفض: {k.notes}
                      </div>
                    )}
                    {k.status === 'pending' && k.userId && (
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateKYC(k.id, 'approved', k.userId)} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                          <Check className="w-3 h-3" /> قبول
                        </button>
                        <button onClick={() => { setKycRejectDialog({ recordId: k.id, userId: k.userId }); setKycRejectReason('') }} className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          <X className="w-3 h-3" /> رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== DEVICE MANAGEMENT DIALOG ===================== */}
      {deviceDialogUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeviceDialogUser(null)}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-purple-500/20 w-full max-w-sm rounded-2xl p-6 space-y-4 animate-scale-in max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto">
                <Settings className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold">إدارة أجهزة المستخدم</h3>
              <p className="text-sm text-muted-foreground">{deviceDialogUser.fullName || deviceDialogUser.email}</p>
            </div>

            <div className={`p-3 rounded-xl text-xs ${deviceDialogUser.status === 'locked_device' ? 'bg-red-500/5 border border-red-500/10 text-red-400' : 'bg-green-500/5 border border-green-500/10 text-green-400'}`}>
              {deviceDialogUser.status === 'locked_device'
                ? '🔒 الحساب مقفل - يجب تصريح جهاز جديد لفتحه'
                : '✓ الحساب مفتوح'}
            </div>

            {/* Pending Device Info */}
            {pendingDevice ? (
              <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-400 space-y-1">
                <p className="font-medium">📱 طلب تصريح معلق:</p>
                <p>الجهاز: {pendingDevice.deviceName || 'جهاز غير معروف'}</p>
                <p className="text-[10px]" dir="ltr">البصمة: {pendingDevice.fingerprint ? pendingDevice.fingerprint.substring(0, 24) + '...' : 'N/A'}</p>
                <p className="text-[10px]">الوقت: {pendingDevice.requestedAt ? new Date(pendingDevice.requestedAt).toLocaleDateString('ar-SA') : 'غير معروف'}</p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground text-center">
                لا يوجد طلب تصريح معلق. اطلب من المستخدم تسجيل الدخول من الجهاز الجديد أولاً.
              </div>
            )}

            {/* Current Devices */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">الأجهزة المسجلة ({deviceList.length}):</p>
              {deviceList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center p-3">لا توجد أجهزة مسجلة</p>
              ) : (
                deviceList.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div>
                      <p className="text-xs font-medium">{d.deviceName || 'جهاز غير معروف'}</p>
                      <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                        {d.fingerprint ? d.fingerprint.substring(0, 16) + '...' : 'N/A'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        آخر استخدام: {d.lastUsed ? new Date(d.lastUsed).toLocaleDateString('ar-SA') : 'غير معروف'}
                      </p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                ))
              )}
            </div>

            {/* Authorize/Remove buttons */}
            <div className="space-y-3 border-t border-white/5 pt-4">
              <button
                onClick={handleAuthorizeDevice}
                disabled={deviceLoading || !pendingDevice}
                className="w-full h-10 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all text-sm"
              >
                {deviceLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تصريح الجهاز المعلق'}
              </button>
              {deviceList.length > 0 && (
                <button
                  onClick={handleRemoveAllDevices}
                  disabled={deviceLoading}
                  className="w-full h-10 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium rounded-xl transition-all text-sm"
                >
                  إزالة جميع الأجهزة
                </button>
              )}
              <button
                onClick={() => setDeviceDialogUser(null)}
                className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all text-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== DELETE USER DIALOG ===================== */}
      {deleteDialogUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDeleteDialog}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-red-500/20 w-full max-w-sm rounded-2xl p-6 space-y-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {deleteStep === 'confirm' && (
              <>
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                    <Trash2 className="w-7 h-7 text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-red-400">حذف المستخدم</h3>
                  <p className="text-sm text-muted-foreground">
                    {deleteDialogUser.fullName || deleteDialogUser.email}
                  </p>
                </div>
                <button onClick={handleSendDeleteOtp} disabled={deleteLoading} className="w-full h-11 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all text-sm">
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'التالي'}
                </button>
                <button onClick={closeDeleteDialog} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all text-sm">إلغاء</button>
              </>
            )}
            {deleteStep === 'otp' && (
              <>
                <div className="text-center space-y-2">
                  <p className="text-sm">أدخل رمز التحقق المرسل إلى بريدك</p>
                  <Input
                    value={deleteOtp}
                    onChange={(e) => setDeleteOtp(e.target.value)}
                    className="glass-input h-12 text-base text-center tracking-[0.3em] font-mono"
                    placeholder="000000"
                    maxLength={6}
                    dir="ltr"
                  />
                </div>
                <button onClick={handleVerifyDeleteOtp} disabled={deleteLoading || deleteOtp.length !== 6} className="w-full h-11 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all text-sm">
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تحقق'}
                </button>
                <button onClick={closeDeleteDialog} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all text-sm">إلغاء</button>
              </>
            )}
            {deleteStep === 'password' && (
              <>
                <div className="text-center space-y-2">
                  <p className="text-sm">أدخل كلمة المرور للإدارة للتأكيد الحذف</p>
                  <Input
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    type="password"
                    className="glass-input h-12 text-base"
                    placeholder="أدخل كلمة المرور"
                    dir="ltr"
                  />
                </div>
                <button onClick={handleConfirmDelete} disabled={deleteLoading || !deletePassword} className="w-full h-11 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all">
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'حذف نهائي'}
                </button>
                <button onClick={closeDeleteDialog} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all text-sm">إلغاء</button>
              </>
            )}
          </div>
        </div>
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

      {/* ===================== REJECT WITHDRAWAL DIALOG ===================== */}
      {rejectDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setRejectDialog(null)}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-red-500/20 w-full max-w-sm rounded-2xl p-6 space-y-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                <X className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-red-400">رفض السحب</h3>
              <p className="text-sm text-muted-foreground">
                مبلغ: <strong className="text-foreground">{(rejectDialog.amount ?? 0).toFixed(2)} USDT</strong>
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">سبب الرفض</Label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full h-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground resize-none"
                  placeholder="أدخل سبب رفض السحب..."
                />
              </div>
              <button onClick={handleRejectWithReason} disabled={rejectLoading || !rejectReason.trim()} className="w-full h-11 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all">
                {rejectLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تأكيد الرفض'}
              </button>
              <button onClick={() => setRejectDialog(null)} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== KYC REJECT DIALOG ===================== */}
      {kycRejectDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setKycRejectDialog(null)}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-red-500/20 w-full max-w-sm rounded-2xl p-6 space-y-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                <X className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-red-400">رفض المستند</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">سبب الرفض</Label>
                <textarea
                  value={kycRejectReason}
                  onChange={(e) => setKycRejectReason(e.target.value)}
                  className="w-full h-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground resize-none"
                  placeholder="أدخل سبب الرفض..."
                />
              </div>
              <button onClick={() => handleUpdateKYC(kycRejectDialog.recordId, 'rejected', kycRejectDialog.userId, kycRejectReason)} disabled={kycRejectLoading || !kycRejectReason.trim()} className="w-full h-11 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all">
                {kycRejectLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تأكيد الرفض'}
              </button>
              <button onClick={() => setKycRejectDialog(null)} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PAYMENT PROOF DIALOG ===================== */}
      {proofDialogWithdrawal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setProofDialogWithdrawal(null)}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full max-w-sm rounded-2xl p-6 space-y-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto">
                <Upload className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold gold-text">رفع صورة الدفع</h3>
              <p className="text-sm text-muted-foreground">
                مبلغ: <strong className="text-foreground">{(proofDialogWithdrawal.amount ?? 0).toFixed(2)} USDT</strong>
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col items-start gap-2 rounded-xl bg-white/5 border border-white/10 p-3 cursor-pointer hover:border-gold/30 transition-colors">
                <label className="text-xs text-muted-foreground">صورة إثبات الدفع</label>
                <input
                  ref={proofInputRef}
                  type="file"
                  accept="image/*"
                  className="w-full text-sm text-foreground file:mr-2 file:ml-0 file:rounded-lg file:border-0 file:bg-transparent file:text-foreground file:font-medium"
                />
              </div>
              <button onClick={handleUploadProof} disabled={proofLoading} className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all">
                {proofLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'رفع الصورة وتأكيد السحب'}
              </button>
              <button onClick={() => setProofDialogWithdrawal(null)} className="w-full h-10 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== FULL IMAGE PREVIEW ===================== */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-lg w-full animate-scale-in">
            <img src={previewImage} alt="معاينة" className="w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 left-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== PAYMENT METHODS MANAGER =====================

const CRYPTO_NETWORKS = [
  { value: 'TRC20', label: 'TRC20 (Tron)' },
  { value: 'BEP20', label: 'BEP20 (BSC)' },
  { value: 'ERC20', label: 'ERC20 (Ethereum)' },
  { value: 'SOL', label: 'SOL (Solana)' },
  { value: 'POLYGON', label: 'Polygon' },
  { value: 'ARBITRUM', label: 'Arbitrum' },
  { value: 'OPTIMISM', label: 'Optimism' },
  { value: 'BTC', label: 'BTC (Bitcoin)' },
]

function PaymentMethodsManager({ methods, onRefresh }: { methods: any[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editMethod, setEditMethod] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'bank_deposit', category: 'bank',
    network: '', walletAddress: '', accountName: '', accountNumber: '',
    beneficiaryName: '', phone: '', recipientName: '', recipientPhone: '',
    instructions: '', minAmount: '', maxAmount: '',
    purpose: 'deposit',
  })

  const resetForm = () => {
    setForm({ type: 'bank_deposit', category: 'bank', network: '', walletAddress: '', accountName: '', accountNumber: '', beneficiaryName: '', phone: '', recipientName: '', recipientPhone: '', instructions: '', minAmount: '', maxAmount: '', purpose: 'deposit' })
    setEditMethod(null)
    setShowAdd(false)
  }

  const handleEdit = (m: any) => {
    setEditMethod(m)
    setForm({ type: m.type || 'bank_deposit', category: m.category || 'bank', network: m.network || '', walletAddress: m.walletAddress || '', accountName: m.accountName || '', accountNumber: m.accountNumber || '', beneficiaryName: m.beneficiaryName || '', phone: m.phone || '', recipientName: m.recipientName || '', recipientPhone: m.recipientPhone || '', instructions: m.instructions || '', minAmount: m.minAmount?.toString() || '', maxAmount: m.maxAmount?.toString() || '', purpose: m.purpose || 'deposit' })
    setShowAdd(true)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const body: any = { ...form, isActive: true }
      if (editMethod) {
        body.action = 'update'; body.id = editMethod.id; body.isActive = editMethod.isActive
      } else {
        body.action = 'create'
      }
      const res = await fetch('/api/admin/payment-methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) { toast.success(data.message); resetForm(); onRefresh() }
      else { toast.error(data.message) }
    } catch { toast.error('خطأ') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الطريقة؟')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payment-methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }),
      })
      const data = await res.json()
      if (data.success) { toast.success(data.message); onRefresh() }
      else toast.error(data.message)
    } catch { toast.error('خطأ') }
    finally { setLoading(false) }
  }

  const handleToggle = async (m: any) => {
    try {
      const res = await fetch('/api/admin/payment-methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: m.id, isActive: !m.isActive }),
      })
      const data = await res.json()
      if (data.success) onRefresh()
      else toast.error(data.message)
    } catch { toast.error('خطأ') }
  }

  const TYPE_LABELS: Record<string, string> = { bank_deposit: 'إيداع لمحفظة', atm_transfer: 'تحويل عبر صراف', crypto: 'عملات رقمية' }
  const CATEGORY_LABELS: Record<string, string> = { bank: '🏦 بنكي', crypto: '₿ عملات رقمية' }

  const getMethodTitle = (m: any) => {
    if (m.category === 'crypto') { return m.network ? `عملات رقمية - ${m.network}` : 'عملات رقمية' }
    return TYPE_LABELS[m.type] || m.type
  }

  return (
    <div className="space-y-4">
      <button onClick={() => { resetForm(); setShowAdd(true) }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 transition-all text-sm font-medium">
        <Plus className="w-4 h-4" /> إضافة طريقة دفع جديدة
      </button>

      {methods.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">لا توجد طرق دفع. أضف طريقة جديدة.</div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {methods.map((m) => (
            <div key={m.id} className={`glass-card p-4 rounded-xl space-y-2 ${!m.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.category === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {m.category === 'crypto' ? <Wallet className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{getMethodTitle(m)}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[m.category] || m.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggle(m)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${m.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleEdit(m)} className="w-8 h-8 rounded-lg bg-gold/10 text-gold flex items-center justify-center hover:bg-gold/20">
                    <Ban className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 border-t border-white/5 pt-2">
                {m.accountName && <p>اسم المحفظة: <span className="text-foreground">{m.accountName}</span></p>}
                {m.accountNumber && <p>رقم الحساب: <span className="text-foreground" dir="ltr">{m.accountNumber}</span></p>}
                {m.beneficiaryName && <p>اسم المستفيد: <span className="text-foreground">{m.beneficiaryName}</span></p>}
                {m.recipientName && <p>اسم المستلم: <span className="text-foreground">{m.recipientName}</span></p>}
                {m.recipientPhone && <p>رقم الجوال: <span className="text-foreground" dir="ltr">{m.recipientPhone}</span></p>}
                {m.network && <p>الشبكة: <span className="text-foreground">{m.network}</span></p>}
                {m.walletAddress && <p>العنوان: <span className="text-foreground" dir="ltr">{m.walletAddress.substring(0, 20)}...</span></p>}
                {m.instructions && <p>ملاحظات: <span className="text-foreground">{m.instructions}</span></p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={resetForm}>
          <div className="glass-card bg-background/95 backdrop-blur-xl border-gold/20 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[80vh] mb-16 sm:mb-0 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 pb-3 border-b border-white/5 flex-shrink-0">
              <h3 className="text-lg font-bold gold-text">{editMethod ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع جديدة'}</h3>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">التصنيف</label>
                    <select value={form.category} onChange={(e) => { const cat = e.target.value; setForm({ ...form, category: cat, type: cat === 'crypto' ? 'crypto' : 'bank_deposit', network: cat === 'crypto' ? form.network : '' }) }} className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground">
                      <option value="bank">🏦 بنكي</option>
                      <option value="crypto">₿ عملات رقمية</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">النوع</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground">
                      {form.category === 'bank' ? (
                        <><option value="bank_deposit">إيداع لمحفظة</option><option value="atm_transfer">تحويل عبر صراف</option></>
                      ) : (
                        <option value="crypto">عملات رقمية</option>
                      )}
                    </select>
                  </div>
                </div>

                {form.category === 'bank' && form.type === 'bank_deposit' && (
                  <div className="space-y-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <p className="text-xs text-blue-400 font-medium">بيانات الإيداع البنكي:</p>
                    <div className="space-y-1">
                      <Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} className="glass-input h-9 text-sm" placeholder="اسم المحفظة" />
                      <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} className="glass-input h-9 text-sm" placeholder="رقم الحساب" dir="ltr" />
                      <Input value={form.beneficiaryName} onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })} className="glass-input h-9 text-sm" placeholder="اسم المستفيد" />
                    </div>
                  </div>
                )}

                {form.category === 'bank' && form.type === 'atm_transfer' && (
                  <div className="space-y-2 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                    <p className="text-xs text-green-400 font-medium">بيانات التحويل عبر صراف:</p>
                    <div className="space-y-1">
                      <Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} className="glass-input h-9 text-sm" placeholder="اسم المستلم" />
                      <Input value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} className="glass-input h-9 text-sm" placeholder="رقم الجوال" dir="ltr" />
                      <Input value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} className="glass-input h-9 text-sm" placeholder="اسم البنك / الشبكة" />
                    </div>
                  </div>
                )}

                {form.category === 'crypto' && (
                  <div className="space-y-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                    <p className="text-xs text-orange-400 font-medium">بيانات المحفظة الرقمية:</p>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">الشبكة (اختياري)</label>
                        <select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} className="w-full h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-foreground">
                          <option value="">-- اختر الشبكة --</option>
                          {CRYPTO_NETWORKS.map(n => (
                            <option key={n.value} value={n.value}>{n.label}</option>
                          ))}
                        </select>
                      </div>
                      <Input value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} className="glass-input h-9 text-sm" placeholder="عنوان المحفظة" dir="ltr" />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">تعليمات إضافية (اختياري)</label>
                  <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="w-full h-20 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground resize-none" placeholder="ملاحظات أو تعليمات للمستخدم..." />
                </div>
              </div>
            </div>

            <div className="p-5 pt-3 border-t border-white/5 flex gap-3 flex-shrink-0">
              <button onClick={handleSave} disabled={loading} className="flex-1 h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editMethod ? 'حفظ التعديلات' : 'إضافة'}
              </button>
              <button onClick={resetForm} className="flex-1 h-11 bg-white/10 hover:bg-white/20 text-foreground font-medium rounded-xl transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== ADMIN SETTINGS PANEL =====================

function AdminSettingsPanel({ settings, onRefresh }: { settings: { email: string; phone: string | null; hasPIN: boolean }; onRefresh: () => void }) {
  const { user } = useAuthStore()
  const [activeSection, setActiveSection] = useState<'phone' | 'email' | 'password' | 'pin' | 'fees' | 'social' | 'cleanup' | 'bot'>('phone')
  const [loading, setLoading] = useState(false)

  // Phone form
  const [newPhone, setNewPhone] = useState('')
  const [phonePassword, setPhonePassword] = useState('')
  // Email form
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  // PIN form
  const [pinPassword, setPinPassword] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  // Cleanup form
  const [cleanupPassword, setCleanupPassword] = useState('')
  const [cleanupConfirmText, setCleanupConfirmText] = useState('')
  const [cleanupResults, setCleanupResults] = useState<Record<string, number> | null>(null)
  // Fee form
  const [depositFee, setDepositFee] = useState('')
  const [withdrawalFee, setWithdrawalFee] = useState('')
  // Social links form
  const [socialWhatsapp, setSocialWhatsapp] = useState('')
  const [socialPhone, setSocialPhone] = useState('')
  const [socialTelegram, setSocialTelegram] = useState('')
  const [socialFacebook, setSocialFacebook] = useState('')
  const [socialInstagram, setSocialInstagram] = useState('')
  const [socialTwitter, setSocialTwitter] = useState('')
  const [socialTiktok, setSocialTiktok] = useState('')
  // Bot toggle
  const [botEnabledSetting, setBotEnabledSetting] = useState(true)

  // Fetch fees & social links & bot setting on mount
  useEffect(() => {
    fetchFees()
    fetchSocialLinks()
    fetchBotSetting()
  }, [])

  const fetchFees = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.success && data.settings) {
        setDepositFee(String(data.settings.depositFee || 0))
        setWithdrawalFee(String(data.settings.withdrawalFee || 0.1))
      }
    } catch { /* silent */ }
  }

  const fetchSocialLinks = async () => {
    try {
      const res = await fetch('/api/admin/social-links')
      const data = await res.json()
      if (data.success && data.socialLinks) {
        setSocialWhatsapp(data.socialLinks.whatsapp || '')
        setSocialPhone(data.socialLinks.phone || '')
        setSocialTelegram(data.socialLinks.telegram || '')
        setSocialFacebook(data.socialLinks.facebook || '')
        setSocialInstagram(data.socialLinks.instagram || '')
        setSocialTwitter(data.socialLinks.twitter || '')
        setSocialTiktok(data.socialLinks.tiktok || '')
      }
    } catch { /* silent */ }
  }

  const fetchBotSetting = () => {
    try {
      const saved = localStorage.getItem('forexyemeni-bot-enabled')
      setBotEnabledSetting(saved === null ? true : saved === 'true')
    } catch {}
 }

  const toggleBotSetting = () => {
    const newState = !botEnabledSetting
    setBotEnabledSetting(newState)
    try {
      localStorage.setItem('forexyemeni-bot-enabled', String(newState))
    } catch {}
    toast.success(newState ? 'تم تفعيل الروبوت' : 'تم إيقاف الروبوت')
  }

  const handleSaveSocialLinks = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/social-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          role: 'admin',
          whatsapp: socialWhatsapp,
          phone: socialPhone,
          telegram: socialTelegram,
          facebook: socialFacebook,
          instagram: socialInstagram,
          twitter: socialTwitter,
          tiktok: socialTiktok,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم تحديث روابط التواصل الاجتماعي')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (actionKey: string, payload?: any) => {
    setLoading(true)
    try {
      const body = payload || {}
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, action: actionKey, ...body }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        if (actionKey === 'change_email' && data.message.includes('تسجيل الدخول')) {
          toast.info('سيتم تسجيل الخروج لتحديث البريد')
          setTimeout(() => useAuthStore.getState().logout(), 2000)
        }
        if (actionKey === 'update_fees') fetchFees()
        onRefresh()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, password: cleanupPassword, confirmText: cleanupConfirmText }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setCleanupResults(data.results)
        setCleanupPassword('')
        setCleanupConfirmText('')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const sections = [
    { key: 'fees' as const, label: 'الرسوم', icon: DollarSign },
    { key: 'phone' as const, label: 'الهاتف', icon: Phone, hasValue: !!settings.phone, value: settings.phone },
    { key: 'email' as const, label: 'البريد', icon: Mail, hasValue: !!settings.email, value: settings.email },
    { key: 'password' as const, label: 'كلمة المرور', icon: Lock, hasValue: true },
    { key: 'pin' as const, label: 'رمز PIN', icon: Shield, hasValue: settings.hasPIN, value: settings.hasPIN ? 'مُفعّل ✓' : 'غير معين' },
    { key: 'social' as const, label: 'تواصل', icon: MessageCircle },
    { key: 'bot' as const, label: 'الروبوت', icon: MessageSquare },
    { key: 'cleanup' as const, label: 'تنظيف', icon: Trash2 },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Info */}
      <div className="glass-card p-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h3 className="text-sm font-bold">إعدادات الإدارة</h3>
            <p className="text-[10px] text-muted-foreground">إدارة بيانات الحساب والأمان والرسوم</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/5 pt-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="truncate" dir="ltr">{settings.email}</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span dir="ltr">{settings.phone || 'غير محدد'}</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>كلمة المرور</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
            <Shield className={`w-3.5 h-3.5 ${settings.hasPIN ? 'text-green-400' : 'text-red-400'}`} />
            <span>PIN: {settings.hasPIN ? 'مُفعّل ✓' : 'غير مُفعّل ✗'}</span>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {sections.map((sec) => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0 ${
              activeSection === sec.key
                ? 'bg-gold/10 text-gold border border-gold/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            <sec.icon className="w-4 h-4" />
            {sec.label}
          </button>
        ))}
      </div>

      {/* Fees Section */}
      {activeSection === 'fees' && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold">إعدادات الرسوم</h3>
          <p className="text-xs text-muted-foreground">تحديد نسبة الرسوم على الإيداعات والسحوب</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">رسوم الإيداع (%)</Label>
              <Input type="number" value={depositFee} onChange={(e) => setDepositFee(e.target.value)} className="glass-input h-10 text-sm" placeholder="0" dir="ltr" step="0.1" min="0" max="100" />
              <p className="text-[10px] text-muted-foreground">النسبة رسوم الإيداع (0 يعني بدون رسوم)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">رسوم السحب (%)</Label>
              <Input type="number" value={withdrawalFee} onChange={(e) => setWithdrawalFee(e.target.value)} className="glass-input h-10 text-sm" placeholder="0.1" dir="ltr" step="0.1" min="0" max="100" />
              <p className="text-[10px] text-muted-foreground">نسبة رسوم السحب (0.1 يعني 0.1%)</p>
            </div>
          </div>
          <button
            onClick={() => handleSave('update_fees', { depositFee: parseFloat(depositFee) || 0, withdrawalFee: parseFloat(withdrawalFee) || 0.1 })}
            disabled={loading}
            className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'حفظ الرسوم'}
          </button>
        </div>
      )}

      {/* Phone Section */}
      {activeSection === 'phone' && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold">تغيير رقم الهاتف</h3>
          <p className="text-xs text-muted-foreground">رقم الهاتف يُستخدم لاستعادة كلمة المرور في حالة فقدان البريد الإلكتروني</p>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">الرقم الحالي</label>
              <Input disabled value={settings.phone ? `+967 ${settings.phone}` : 'غير محدد'} className="glass-input h-10 text-sm opacity-60" dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">الرقم الجديد</label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="glass-input h-10 text-sm" placeholder="7XXXXXXXX" dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">كلمة المرور للتأكيد</label>
              <Input type="password" value={phonePassword} onChange={(e) => setPhonePassword(e.target.value)} className="glass-input h-10 text-sm" placeholder="أدخل كلمة المرور" dir="ltr" />
            </div>
          </div>
          <button onClick={() => handleSave('change_phone', { action: 'change_phone', newPhone, currentPassword: phonePassword })} disabled={loading || !newPhone || !phonePassword} className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تغيير الرقم'}
          </button>
        </div>
      )}

      {/* Email Section */}
      {activeSection === 'email' && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold">تغيير البريد الإلكتروني</h3>
          <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 text-xs text-gold">
            ⚠️ تغيير البريد يتطلب تسجيل الدخول بالبريد الجديد
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">البريد الحالي</label>
              <Input disabled value={settings.email} className="glass-input h-10 text-sm opacity-60" dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">البريد الجديد</label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="glass-input h-10 text-sm" placeholder="new@email.com" dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">كلمة المرور للتأكيد</label>
              <Input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className="glass-input h-10 text-sm" placeholder="أدخل كلمة المرور" dir="ltr" />
            </div>
          </div>
          <button onClick={() => handleSave('change_email', { action: 'change_email', newEmail, currentPassword: emailPassword })} disabled={loading || !newEmail || !emailPassword} className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تغيير البريد'}
          </button>
        </div>
      )}

      {/* Password Section */}
      {activeSection === 'password' && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold">تغيير كلمة المرور</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">كلمة المرور الحالية</label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="glass-input h-10 text-sm" placeholder="أدخل كلمة المرور الحالية" dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">كلمة المرور الجديدة (8 أحرف على الأقل)</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="glass-input h-10 text-sm" placeholder="أدخل كلمة المرور الجديدة" dir="ltr" />
            </div>
          </div>
          <button onClick={() => handleSave('change_password', { action: 'change_password', currentPassword, newPassword })} disabled={loading || !currentPassword || !newPassword || newPassword.length < 8} className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تغيير كلمة المرور'}
          </button>
        </div>
      )}

      {/* PIN Section */}
      {activeSection === 'pin' && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold">رمز PIN للاستعادة</h3>
          <p className="text-xs text-muted-foreground">رمز PIN يُستخدم لاستعادة كلمة المرور عند فقدان البريد الإلكتروني. يجب أن يكون بين 4 و 8 أرقام.</p>

          {settings.hasPIN ? (
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-xs text-green-400">
              ✓ تم تعيين رمز PIN بالفعل. يمكنك تغييره أدناه.
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-400">
              ✗ لم يتم تعيين رمز PIN. بدون PIN لن تتمكن من استعادة كلمة المرور بسهولة.
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">كلمة المرور للتأكيد</label>
              <Input type="password" value={pinPassword} onChange={(e) => setPinPassword(e.target.value)} className="glass-input h-10 text-sm" placeholder="أدخل كلمة المرور" dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">رمز PIN (4-8 أرقام)</label>
              <Input type="text" maxLength={8} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))} className="glass-input h-10 text-sm text-center tracking-[0.3em] font-mono" placeholder="••••" dir="ltr" />
            </div>
            {settings.hasPIN && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">تأكيد رمز PIN الجديد</label>
                <Input type="text" maxLength={8} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))} className="glass-input h-10 text-sm text-center tracking-[0.3em] font-mono" placeholder="••••" dir="ltr" />
              </div>
            )}
          </div>
          <button
            onClick={() => handleSave('set_pin', { action: 'set_pin', pin: pinCode, currentPassword: pinPassword })}
            disabled={loading || !pinPassword || !pinCode || pinCode.length < 4 || (settings.hasPIN && pinCode !== pinConfirm)}
            className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : settings.hasPIN ? 'تغيير PIN' : 'تعيين PIN'}
          </button>
        </div>
      )}

      {/* Social Links Section */}
      {activeSection === 'social' && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold">روابط التواصل الاجتماعي</h3>
              <p className="text-[10px] text-muted-foreground">الروابط تظهر للمستخدمين عبر زر التواصل العائم</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">واتساب (WhatsApp)</Label>
              <Input value={socialWhatsapp} onChange={(e) => setSocialWhatsapp(e.target.value)} className="glass-input h-10 text-sm" placeholder="967771234567" dir="ltr" />
              <p className="text-[10px] text-muted-foreground">رقم الهاتف مع رمز الدولة بدون +</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">هاتف (Phone)</Label>
              <Input value={socialPhone} onChange={(e) => setSocialPhone(e.target.value)} className="glass-input h-10 text-sm" placeholder="967771234567" dir="ltr" />
              <p className="text-[10px] text-muted-foreground">رقم الهاتف المباشر مع رمز الدولة</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">تيلجرام (Telegram)</Label>
              <Input value={socialTelegram} onChange={(e) => setSocialTelegram(e.target.value)} className="glass-input h-10 text-sm" placeholder="username" dir="ltr" />
              <p className="text-[10px] text-muted-foreground">اسم المستخدم بدون @</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">فيسبوك (Facebook)</Label>
              <Input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} className="glass-input h-10 text-sm" placeholder="https://facebook.com/..." dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">إنستقرام (Instagram)</Label>
              <Input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} className="glass-input h-10 text-sm" placeholder="https://instagram.com/..." dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">تويتر (Twitter/X)</Label>
              <Input value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} className="glass-input h-10 text-sm" placeholder="https://twitter.com/..." dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">تيك توك (TikTok)</Label>
              <Input value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} className="glass-input h-10 text-sm" placeholder="https://tiktok.com/@..." dir="ltr" />
            </div>
          </div>

          <button
            onClick={handleSaveSocialLinks}
            disabled={loading}
            className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'حفظ الروابط'}
          </button>
        </div>
      )}

      {/* Bot Section */}
      {activeSection === 'bot' && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">الروبوت الذكي</h3>
              <p className="text-[10px] text-muted-foreground">التحكم بمساعد الدعم الذكي</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div>
              <p className="text-sm font-medium">تشغيل الروبوت</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                الروبوت يرد تلقائياً على أسئلة المستخدمين بالذكاء الاصطناعي
              </p>
            </div>
            <button
              onClick={toggleBotSetting}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                botEnabledSetting ? 'bg-emerald-500' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                  botEnabledSetting ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="p-3 rounded-lg bg-gold/5 border border-gold/10">
            <p className="text-[11px] text-muted-foreground">
              {botEnabledSetting ? (
                <>🟢 الروبوت <span className="text-emerald-400 font-medium">مفعّل</span> - يظهر للمستخدمين ويجيب على أسئلتهم تلقائياً</>
              ) : (
                <>🔴 الروبوت <span className="text-red-400 font-medium">متوقف</span> - لن يظهر للمستخدمين</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Cleanup Section */}
      {activeSection === 'cleanup' && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-400">تنظيف قاعدة البيانات</h3>
              <p className="text-[10px] text-muted-foreground">حذف جميع البيانات والبدء من الصفر</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-400 space-y-2">
            <p className="font-bold">⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!</p>
            <p>سيتم حذف:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li>جميع المستخدمين (غير الإدارة)</li>
              <li>جميع طلبات الإيداع</li>
              <li>جميع طلبات السحب</li>
              <li>جميع المعاملات</li>
              <li>جميع الإشعارات</li>
              <li>جميع سجلات KYC</li>
              <li>جميع رموز OTP</li>
              <li>جميع بيانات الأجهزة</li>
            </ul>
            <p className="font-medium text-red-400 mt-1">سيتم الاحتفاظ بـ: حساب الإدارة، طرق الدفع، إعدادات الرسوم</p>
            <p className="font-medium text-gold">سيتم تصفير رصيد حساب الإدارة إلى 0</p>
          </div>

          {cleanupResults && (
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-xs space-y-1">
              <p className="font-bold text-green-400">✅ تم التنظيف بنجاح:</p>
              {Object.entries(cleanupResults).map(([key, value]) => (
                <p key={key} className="text-muted-foreground">
                  {key}: <span className="text-green-400 font-medium">{value}</span>
                </p>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">كلمة المرور للتأكيد</label>
              <Input
                type="password"
                value={cleanupPassword}
                onChange={(e) => setCleanupPassword(e.target.value)}
                className="glass-input h-10 text-sm"
                placeholder="أدخل كلمة المرور"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-red-400 font-medium">اكتب "حذف الكل" للتأكيد</label>
              <Input
                type="text"
                value={cleanupConfirmText}
                onChange={(e) => setCleanupConfirmText(e.target.value)}
                className="glass-input h-10 text-sm border-red-500/20 focus:border-red-500/40"
                placeholder="حذف الكل"
              />
            </div>
          </div>

          <button
            onClick={handleCleanup}
            disabled={loading || !cleanupPassword || cleanupConfirmText !== 'حذف الكل'}
            className="w-full h-11 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '🗑️ حذف جميع البيانات'}
          </button>
        </div>
      )}

      {/* ===== BALANCE ADJUSTMENT DIALOG ===== */}
      {balanceDialogUser && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setBalanceDialogUser(null)}>
          <div className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="text-center space-y-2">
              <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${balanceAction === 'add' ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                {balanceAction === 'add' ? <ArrowDownLeft className="w-7 h-7 text-green-400" /> : <ArrowUpRight className="w-7 h-7 text-orange-400" />}
              </div>
              <h3 className="text-lg font-bold">{balanceAction === 'add' ? 'إضافة رصيد' : 'سحب رصيد'}</h3>
              <p className="text-sm text-muted-foreground">{balanceDialogUser.fullName || balanceDialogUser.email}</p>
              <p className="text-xs text-muted-foreground">الرصيد الحالي: <span className="gold-text font-bold">{(balanceDialogUser.balance ?? 0).toFixed(2)} USDT</span></p>
            </div>
            <div className="space-y-3">
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="المبلغ (USDT)"
                className="w-full h-12 rounded-xl glass-input px-4 text-sm"
                dir="ltr"
                min="0"
                step="0.01"
              />
              {balanceAmount && parseFloat(balanceAmount) > 0 && (
                <p className="text-xs text-center">
                  الرصيد بعد العملية: <span className={`font-bold ${balanceAction === 'add' ? 'text-green-400' : 'text-orange-400'}`}>
                    {((balanceDialogUser.balance ?? 0) + (balanceAction === 'add' ? parseFloat(balanceAmount) : -parseFloat(balanceAmount))).toFixed(2)} USDT
                  </span>
                </p>
              )}
              <button
                onClick={handleAdjustBalance}
                disabled={balanceLoading || !balanceAmount || parseFloat(balanceAmount) <= 0}
                className={`w-full h-12 font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 ${
                  balanceAction === 'add' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                }`}
              >
                {balanceLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : balanceAction === 'add' ? 'تأكيد الإضافة' : 'تأكيد السحب'}
              </button>
              <button
                onClick={() => setBalanceDialogUser(null)}
                className="w-full h-10 bg-white/10 text-foreground rounded-xl text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== REMOVE MERCHANT CONFIRMATION DIALOG ===== */}
      {removeMerchantDialogUser && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setRemoveMerchantDialogUser(null)}>
          <div className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-orange-400">إزالة حالة التاجر</h3>
              <p className="text-sm text-muted-foreground">
                سيتم تحويل حساب <strong>{removeMerchantDialogUser.fullName || removeMerchantDialogUser.email}</strong> من تاجر إلى مستخدم عادي.
              </p>
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <p className="text-xs text-red-400">⚠️ سيتم حذف جميع إعلانات P2P المرتبطة بهذا التاجر ولن يتمكن من إنشاء إعلانات جديدة.</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleRemoveMerchant}
                disabled={removeMerchantLoading}
                className="w-full h-12 bg-orange-500 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
              >
                {removeMerchantLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تأكيد إزالة التاجر'}
              </button>
              <button
                onClick={() => setRemoveMerchantDialogUser(null)}
                className="w-full h-10 bg-white/10 text-foreground rounded-xl text-sm"
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
