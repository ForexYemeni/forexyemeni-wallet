import { apiFetch } from '@/lib/api-client'
'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export default function TransactionHistory() {
  const { user } = useAuthStore()
  const { cachedTransactions, setCachedTransactions, setCachedUser, setLastSyncTime } = useOfflineStore()
  const { isOffline } = useOfflineMode()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [usingOffline, setUsingOffline] = useState(false)

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

  const filtered = transactions.filter(tx => {
    const matchType = filter === 'all' || tx.type === filter
    const matchSearch = !search.trim() ||
      (tx.description || '').toLowerCase().includes(search.toLowerCase()) ||
      tx.referenceId?.toLowerCase().includes(search.toLowerCase()) ||
      tx.type.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const grouped = groupTransactions(filtered)

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

      {/* Export Statement */}
      <ExportStatement />

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? 'gold-gradient text-gray-900 font-bold rounded-xl min-w-fit'
                : 'glass-input text-muted-foreground rounded-xl min-w-fit hover:text-gold hover:border-gold/30'
            }
          >
            {f.label}
          </Button>
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
          <div className="empty-state-icon">
            <Filter className="w-12 h-12 text-gold/30 mx-auto mb-3" />
          </div>
          <p className="text-muted-foreground text-sm mb-1">لا توجد معاملات تطابق البحث</p>
          <button onClick={() => { setSearch(''); setFilter('all') }} className="text-xs text-gold hover:text-gold-light transition-colors tap-effect">
            مسح الفلاتر
          </button>
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
                {items.map((tx, index) => (
                  <div
                    key={tx.id}
                    className="glass-card glass-card-hover tx-card-enhanced p-4 space-y-2 cursor-pointer"
                    style={{ animationDelay: `${index * 40}ms` }}
                    title={formatFullDate(tx.createdAt)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTypeIconBg(tx.type)}`}>
                          {getTypeIcon(tx.type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{getTypeLabel(tx.type)}</p>
                          <p className="text-xs text-muted-foreground">{formatTime(tx.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <span className={`text-sm font-bold ${tx.amount >= 0 ? 'tx-amount-positive' : 'tx-amount-negative'}`}>
                          {tx.amount >= 0 ? '+' : ''}{Math.abs(tx.amount).toFixed(2)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">USDT</p>
                      </div>
                    </div>
                    {tx.description && (
                      <p className="text-xs text-muted-foreground border-t border-white/5 pt-2 truncate">{tx.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
