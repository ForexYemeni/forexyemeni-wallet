'use client'

import { apiFetch } from '@/lib/api-client'

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/store'
import { useOfflineStore } from '@/lib/offline-store'
import { useOfflineMode } from '@/hooks/useOfflineMode'
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Repeat,
  Clock,
  Filter,
  WifiOff,
  Search,
  RefreshCw,
  Receipt,
  ChevronDown,
  FileText,
  BadgeCheck,
  XCircle,
  HourglassIcon,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const ExportStatement = dynamic(() => import('@/components/transactions/ExportStatement'), { ssr: false })

interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string | null
  referenceId: string | null
  createdAt: string
}

function getTimeGroup(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'اليوم'
  if (diffDays === 1) return 'أمس'
  if (diffDays < 7) return `منذ ${diffDays} أيام`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `منذ ${weeks} ${weeks === 1 ? 'أسبوع' : 'أسابيع'}`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `منذ ${months} ${months === 1 ? 'شهر' : 'أشهر'}`
  }
  return 'أقدم'
}

function groupTransactions(transactions: Transaction[]): { group: string; items: Transaction[] }[] {
  const groups: Record<string, Transaction[]> = {}
  for (const tx of transactions) {
    const group = getTimeGroup(tx.createdAt)
    if (!groups[group]) groups[group] = []
    groups[group].push(tx)
  }
  // Preserve insertion order
  const seen = new Set<string>()
  const ordered: { group: string; items: Transaction[] }[] = []
  for (const tx of transactions) {
    const group = getTimeGroup(tx.createdAt)
    if (!seen.has(group)) {
      seen.add(group)
      ordered.push({ group, items: groups[group] })
    }
  }
  return ordered
}

function extractStatus(description: string | null): { label: string; className: string } | null {
  if (!description) return null
  const lower = description.toLowerCase()
  if (lower.includes('مكتمل') || lower.includes('ناجح') || lower.includes('موافق') || lower.includes('مؤكد')) {
    return { label: 'مكتمل', className: 'status-confirmed' }
  }
  if (lower.includes('معلق') || lower.includes('قيد المراجعة') || lower.includes('بانتظار')) {
    return { label: 'معلق', className: 'status-pending' }
  }
  if (lower.includes('مقبول') || lower.includes('approved')) {
    return { label: 'مقبول', className: 'status-approved' }
  }
  if (lower.includes('مرفوض') || lower.includes('فشل') || lower.includes('rejected') || lower.includes('failed')) {
    return { label: 'مرفوض', className: 'status-rejected' }
  }
  if (lower.includes('قيد المعالجة') || lower.includes('processing')) {
    return { label: 'قيد المعالجة', className: 'status-processing' }
  }
  return null
}

function getTxBorderClass(type: string): string {
  switch (type) {
    case 'deposit': return 'border-l-2 border-l-green-500/30'
    case 'withdrawal': return 'border-l-2 border-l-red-500/30'
    case 'transfer': return 'border-l-2 border-l-blue-500/30'
    case 'bonus': return 'border-l-2 border-l-gold/30'
    default: return ''
  }
}

function getStatusIcon(statusLabel: string) {
  switch (statusLabel) {
    case 'مكتمل': return <BadgeCheck className="w-3 h-3" />
    case 'مقبول': return <BadgeCheck className="w-3 h-3" />
    case 'معلق': return <HourglassIcon className="w-3 h-3" />
    case 'قيد المعالجة': return <HourglassIcon className="w-3 h-3" />
    case 'مرفوض': return <XCircle className="w-3 h-3" />
    default: return null
  }
}

export default function TransactionHistory() {
  const { user } = useAuthStore()
  const { cachedTransactions, setCachedTransactions, setCachedUser, setLastSyncTime } = useOfflineStore()
  const { isOffline } = useOfflineMode()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [usingOffline, setUsingOffline] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) fetchTransactions()
  }, [user?.id])

  useEffect(() => {
    if (isOffline && cachedTransactions.length > 0) {
      setTransactions(cachedTransactions as Transaction[])
      setUsingOffline(true)
      setLoading(false)
    }
  }, [isOffline, cachedTransactions])

  const fetchTransactions = async () => {
    if (!user?.id) return
    if (!navigator.onLine) {
      if (cachedTransactions.length > 0) {
        setTransactions(cachedTransactions as Transaction[])
        setUsingOffline(true)
      }
      setLoading(false)
      return
    }
    try {
      const res = await apiFetch(`/api/transactions?userId=${user.id}`)
      const data = await res.json()
      if (data.success) {
        setTransactions(data.transactions)
        setUsingOffline(false)
        setCachedTransactions(data.transactions || [])
        setCachedUser({
          balance: user?.balance ?? 0,
          frozenBalance: user?.frozenBalance ?? 0,
          accountNumber: user?.accountNumber ?? null,
          fullName: user?.fullName ?? null,
          email: user?.email ?? '',
          kycStatus: user?.kycStatus ?? 'none',
        })
        setLastSyncTime()
      }
    } catch {
      if (cachedTransactions.length > 0) {
        setTransactions(cachedTransactions as Transaction[])
        setUsingOffline(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const totalDeposits = transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
    const totalWithdrawals = transactions
      .filter(tx => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    return {
      total: transactions.length,
      deposits: totalDeposits,
      withdrawals: totalWithdrawals,
    }
  }, [transactions])

  const filtered = transactions.filter(tx => {
    const matchType = filter === 'all' || tx.type === filter
    const matchSearch = !search.trim() ||
      (tx.description || '').toLowerCase().includes(search.toLowerCase()) ||
      tx.referenceId?.toLowerCase().includes(search.toLowerCase()) ||
      tx.type.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const grouped = groupTransactions(filtered)

  // Determine the empty state type
  const getEmptyStateInfo = () => {
    if (transactions.length === 0) {
      return {
        icon: Receipt,
        title: 'لا توجد معاملات بعد',
        description: 'ستظهر المعاملات هنا بمجرد إجراء أول عملية',
        showAction: false,
      }
    }
    if (search.trim()) {
      return {
        icon: Filter,
        title: 'لا توجد معاملات تطابق البحث',
        description: `لم يتم العثور على نتائج لـ "${search}"`,
        showAction: true,
      }
    }
    // Filtered but no search
    const filterLabel = filters.find(f => f.key === filter)?.label ?? filter
    return {
      icon: Filter,
      title: `لا توجد ${filterLabel} في هذه الفترة`,
      description: 'حاول تغيير الفلتر أو البحث بكلمات أخرى',
      showAction: true,
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="w-4 h-4 text-green-400" />
      case 'withdrawal': return <ArrowUpRight className="w-4 h-4 text-red-400" />
      case 'bonus': return <TrendingUp className="w-4 h-4 text-gold" />
      case 'transfer': return <Repeat className="w-4 h-4 text-blue-400" />
      default: return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getTypeIconBg = (type: string) => {
    switch (type) {
      case 'deposit': return 'bg-green-500/10'
      case 'withdrawal': return 'bg-red-500/10'
      case 'bonus': return 'bg-gold/10'
      case 'transfer': return 'bg-blue-500/10'
      default: return 'bg-white/5'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'إيداع'
      case 'withdrawal': return 'سحب'
      case 'transfer': return 'تحويل'
      case 'bonus': return 'مكافأة'
      case 'p2p': return 'P2P'
      default: return type
    }
  }

  const filters = [
    { key: 'all', label: 'الكل' },
    { key: 'deposit', label: 'إيداعات' },
    { key: 'withdrawal', label: 'سحوبات' },
    { key: 'bonus', label: 'مكافآت' },
    { key: 'transfer', label: 'تحويلات' },
  ]

  const toggleExpand = (txId: string) => {
    setExpandedTx(prev => (prev === txId ? null : txId))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Offline Mode Indicator */}
      {usingOffline && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>أنت غير متصل — يتم عرض البيانات المخزنة مؤقتاً</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold">سجل المعاملات</h1>
          <p className="text-sm text-muted-foreground">{transactions.length} معاملة</p>
        </div>
      </div>

      {/* Summary Stats Cards */}
      {!loading && transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 animate-fade-in">
          {/* Total Transactions */}
          <div className="glass-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-gold" />
            </div>
            <p className="text-base font-bold text-foreground">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">معاملة</p>
          </div>

          {/* Total Deposits */}
          <div className="glass-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
            </div>
            <p className="text-base font-bold text-green-400">{stats.deposits.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">إيداعات</p>
          </div>

          {/* Total Withdrawals */}
          <div className="glass-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
            </div>
            <p className="text-base font-bold text-red-400">{stats.withdrawals.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">سحوبات</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في المعاملات..."
          className="w-full h-11 pr-10 pl-4 rounded-xl glass-input text-sm text-foreground placeholder:text-muted-foreground"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          >
            مسح
          </button>
        )}
      </div>

      {/* Pull-to-Refresh Visual Indicator */}
      {!loading && transactions.length > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
          <RefreshCw className="w-3 h-3" />
          <span>اسحب للتحديث</span>
        </div>
      )}

      {/* Export Statement */}
      <ExportStatement />

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`filter-pill ${filter === f.key ? 'active' : ''}`}
          >
            {f.label}{f.key !== 'all' && (
              <span className={`mr-1 text-[10px] ${filter === f.key ? 'text-gray-900/60' : 'text-muted-foreground/40'}`}>
                {transactions.filter(tx => tx.type === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="space-y-3 stagger-list">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="glass-card p-4 flex items-center gap-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="skeleton-circle w-10 h-10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-line w-2/3" />
                <div className="skeleton-line w-1/3 h-3" />
              </div>
              <div className="skeleton-line w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center empty-state-enhanced">
          {(() => {
            const info = getEmptyStateInfo()
            const EmptyIcon = info.icon
            return (
              <>
                <div className="empty-state-icon">
                  <EmptyIcon className="w-12 h-12 text-gold/30 mx-auto mb-3" />
                </div>
                <p className="text-muted-foreground text-sm mb-1">{info.title}</p>
                {info.description && (
                  <p className="text-xs text-muted-foreground/70 mb-2">{info.description}</p>
                )}
                {info.showAction && (
                  <button
                    onClick={() => { setSearch(''); setFilter('all') }}
                    className="text-xs text-gold hover:text-gold-light transition-colors tap-effect"
                  >
                    مسح الفلاتر
                  </button>
                )}
              </>
            )
          })()}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              {/* Time group header */}
              <div className="time-group-header px-1">
                <p className="text-xs font-bold gold-text">{group}</p>
              </div>

              {/* Transactions in this group */}
              <div className="space-y-2 stagger-list">
                {items.map((tx, index) => {
                  const status = extractStatus(tx.description)
                  const isExpanded = expandedTx === tx.id
                  const borderClass = getTxBorderClass(tx.type)

                  return (
                    <div
                      key={tx.id}
                      className={borderClass}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      {/* Main Card */}
                      <div
                        className={`glass-card glass-card-hover tx-card-enhanced p-4 space-y-2 cursor-pointer tap-effect ${isExpanded ? 'rounded-b-none' : ''}`}
                        title={formatFullDate(tx.createdAt)}
                        onClick={() => toggleExpand(tx.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTypeIconBg(tx.type)}`}>
                              {getTypeIcon(tx.type)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{getTypeLabel(tx.type)}</p>
                                {status && (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${status.className}`}>
                                    {getStatusIcon(status.label)}
                                    {status.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{formatTime(tx.createdAt)}</p>
                            </div>
                          </div>
                          <div className="text-left flex items-center gap-1.5">
                            <div>
                              <span className={`text-sm font-bold ${tx.amount >= 0 ? 'tx-amount-positive' : 'tx-amount-negative'}`}>
                                {tx.amount >= 0 ? '+' : ''}{Math.abs(tx.amount).toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1">
                                <p className="text-[10px] text-muted-foreground">USDT</p>
                                {tx.balanceAfter != null && (
                                  <p className="text-[9px] text-muted-foreground/60">(بعد: {tx.balanceAfter.toFixed(2)})</p>
                                )}
                              </div>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        {tx.description && (
                          <p className="text-xs text-muted-foreground border-t border-white/5 pt-2 truncate">{tx.description}</p>
                        )}
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="glass-card rounded-t-none p-4 animate-fade-in border-t-0 -mt-px">
                          <div className="space-y-3">
                            {/* Full Date/Time */}
                            <div className="flex items-start gap-3">
                              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">التاريخ والوقت</p>
                                <p className="text-xs text-foreground/90">{formatFullDate(tx.createdAt)}</p>
                              </div>
                            </div>

                            {/* Full Description */}
                            {tx.description && (
                              <div className="flex items-start gap-3">
                                <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">الوصف</p>
                                  <p className="text-xs text-foreground/90 leading-relaxed">{tx.description}</p>
                                </div>
                              </div>
                            )}

                            {/* Reference ID */}
                            {tx.referenceId && (
                              <div className="flex items-start gap-3">
                                <Receipt className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">رقم المرجع</p>
                                  <p className="text-xs text-foreground/90 font-mono">{tx.referenceId}</p>
                                </div>
                              </div>
                            )}

                            {/* Balance Before & After */}
                            <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                <div>
                                  <p className="text-[9px] text-muted-foreground">قبل</p>
                                  <p className="text-xs font-medium text-foreground/80">{tx.balanceBefore?.toFixed(2) ?? '—'} USDT</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground/30">
                                <ChevronDown className="w-3 h-3" />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${tx.amount >= 0 ? 'bg-green-400/50' : 'bg-red-400/50'}`} />
                                <div>
                                  <p className="text-[9px] text-muted-foreground">بعد</p>
                                  <p className="text-xs font-medium text-foreground/80">{tx.balanceAfter?.toFixed(2) ?? '—'} USDT</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
