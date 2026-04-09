import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CachedTransaction {
  id: string
  type: string
  amount: number
  description: string | null
  createdAt: string
  balanceBefore?: number
  balanceAfter?: number
  referenceId?: string | null
}

export interface CachedUserData {
  balance: number
  frozenBalance: number
  accountNumber: string | null
  fullName: string | null
  email: string
  kycStatus: string
}

interface OfflineStore {
  // User data cache
  cachedUser: CachedUserData | null
  setCachedUser: (data: CachedUserData) => void

  // Transactions cache
  cachedTransactions: CachedTransaction[]
  setCachedTransactions: (transactions: CachedTransaction[]) => void

  // Sync tracking
  lastSyncTime: number | null
  setLastSyncTime: () => void

  // Check if cached data is fresh (less than 24 hours old)
  isDataFresh: () => boolean

  // Clear all cached data
  clearCache: () => void
}

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      cachedUser: null,
      cachedTransactions: [],
      lastSyncTime: null,

      setCachedUser: (data) => set({ cachedUser: data }),

      setCachedTransactions: (transactions) =>
        set({ cachedTransactions: transactions.slice(0, 100) }),

      setLastSyncTime: () => set({ lastSyncTime: Date.now() }),

      isDataFresh: () => {
        const { lastSyncTime } = get()
        if (!lastSyncTime) return false
        const age = Date.now() - lastSyncTime
        return age < 24 * 60 * 60 * 1000 // 24 hours
      },

      clearCache: () =>
        set({
          cachedUser: null,
          cachedTransactions: [],
          lastSyncTime: null,
        }),
    }),
    {
      name: 'forexyemeni-offline',
    }
  )
)
