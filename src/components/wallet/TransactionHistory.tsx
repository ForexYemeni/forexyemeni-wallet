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
  Clock,
  Filter,
  WifiOff,
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

export default function TransactionHistory() {
  const { user } = useAuthStore()
  const { cachedTransactions, setCachedTransactions, setCachedUser, setLastSyncTime } = useOfflineStore()
  const { isOffline } = useOfflineMode()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [usingOffline, setUsingOffline] = useState(false)

  useEffect(() => {
    if (user?.id) fetchTransactions()
  }, [user?.id])

  // Load offline cache when going offline
  useEffect(() => {
    if (isOffline && cachedTransactions.length > 0) {
      setTransactions(cachedTransactions as Transaction[])
      setUsingOffline(true)
      setLoading(false)
    }
  }, [isOffline, cachedTransactions])

  const fetchTransactions = async () => {
    if (!user?.id) return

    // If offline, use cached data
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
        // Save to offline cache
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
      // Network error — try cached data
      if (cachedTransactions.length > 0) {
        setTransactions(cachedTransactions as Transaction[])
        setUsingOffline(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter(tx => tx.type === filter)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
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
      default: return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'إيداع'
      case 'withdrawal': return 'سحب'
      case 'transfer': return 'تحويل'
      case 'bonus': return 'مكافأة'
      default: return type
    }
  }

  const filters = [
    { key: 'all', label: 'الكل' },
    { key: 'deposit', label: 'إيداعات' },
    { key: 'withdrawal', label: 'سحوبات' },
    { key: 'bonus', label: 'مكافآت' },
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

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold">سجل المعاملات</h1>
          <p className="text-sm text-muted-foreground">{transactions.length} معاملة</p>
        </div>
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
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Filter className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">لا توجد معاملات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => (
            <div key={tx.id} className="glass-card glass-card-hover p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.amount >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {getTypeIcon(tx.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{getTypeLabel(tx.type)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}{Math.abs(tx.amount).toFixed(2)} USDT
                </span>
              </div>
              {tx.description && (
                <p className="text-xs text-muted-foreground border-t border-white/5 pt-2">{tx.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
