import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
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
  mustChangePassword: boolean
  hasPin?: boolean
  pendingConfirmation?: string | null
  twoFactorEnabled?: boolean
  createdAt: string
  merchantId?: string | null
  affiliateCode?: string | null
  accountNumber?: string | null
  permissions?: { manageUsers?: boolean; approveDeposits?: boolean; approveWithdrawals?: boolean; approveKYC?: boolean; manageSettings?: boolean } | null
}

interface AuthState {
  user: User | null
  token: string | null
  currentScreen: string
  isAuthenticated: boolean
  pendingRegistration: { email: string; fullName: string; password: string } | null
  pendingWithdrawalConfirmation: string | null
  navigationHistory: string[]
  setAuth: (user: User, token: string, mustChangePassword?: boolean) => void
  logout: () => void
  setScreen: (screen: string) => void
  goBack: () => string | null
  updateBalance: (balance: number) => void
  updateUser: (updates: Partial<User>) => void
  setPendingRegistration: (data: { email: string; fullName: string; password: string } | null) => void
  setPendingWithdrawalConfirmation: (id: string | null) => void
  clearForLock: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      currentScreen: 'login',
      isAuthenticated: false,
      pendingRegistration: null,
      pendingWithdrawalConfirmation: null,
      navigationHistory: [],
      setAuth: (user, token, mustChangePassword = false) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('forexyameni-session-start', Date.now().toString())
        }
        return set({
          user,
          token,
          isAuthenticated: true,
          currentScreen: mustChangePassword
            ? 'force-change-password'
            : !user.hasPin
              ? 'set-pin'
              : (user.role === 'admin' || (user.permissions && Object.values(user.permissions).some(v => v)))
                ? 'admin'
                : user.merchantId
                  ? 'p2p'
                  : 'dashboard',
          pendingWithdrawalConfirmation: user?.pendingConfirmation || null,
          navigationHistory: [],
        })
      },
      logout: () => set({ user: null, token: null, isAuthenticated: false, currentScreen: 'login', pendingRegistration: null, pendingWithdrawalConfirmation: null, navigationHistory: [] }),
      clearForLock: () => set({ user: null, token: null, isAuthenticated: false, currentScreen: 'device-locked', pendingRegistration: null, pendingWithdrawalConfirmation: null, navigationHistory: [] }),
      setScreen: (screen) => set((state) => {
        const prev = state.currentScreen
        if (screen === prev) return { currentScreen: screen }
        const history = Array.isArray(state.navigationHistory) ? state.navigationHistory : []
        return {
          currentScreen: screen,
          navigationHistory: [...history, prev],
        }
      }),
      goBack: () => {
        const state = get()
        const history = Array.isArray(state.navigationHistory) ? state.navigationHistory : []
        if (history.length === 0) return null
        const prev = history[history.length - 1]
        set({
          currentScreen: prev,
          navigationHistory: history.slice(0, -1),
        })
        return prev
      },
      updateBalance: (balance) => set((state) => ({ user: state.user ? { ...state.user, balance } : null })),
      updateUser: (updates) => set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
      setPendingRegistration: (data) => set({ pendingRegistration: data }),
      setPendingWithdrawalConfirmation: (id) => set({ pendingWithdrawalConfirmation: id }),
    }),
    {
      name: 'forexyameni-auth',
      version: 2,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') return undefined as any
        return {
          getItem: (name) => {
            try {
              const value = localStorage.getItem(name)
              if (!value) return null
              const parsed = JSON.parse(value)
              // Remove navigationHistory if it was accidentally stored (corrupted data)
              if (parsed?.state?.navigationHistory !== undefined) {
                delete parsed.state.navigationHistory
                try { localStorage.setItem(name, JSON.stringify(parsed)) } catch {}
              }
              return value
            } catch {
              // Corrupted data - remove it
              try { localStorage.removeItem(name) } catch {}
              return null
            }
          },
          setItem: (name, value) => {
            try { localStorage.setItem(name, value) } catch {}
          },
          removeItem: (name) => {
            try { localStorage.removeItem(name) } catch {}
          },
        }
      }),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        currentScreen: state.currentScreen,
        pendingWithdrawalConfirmation: state.pendingWithdrawalConfirmation,
      }),
      // Version migration: bump version to clear old corrupted data
      migrate: (persisted, version) => {
        if (version < 2) {
          // Clear old data that might have navigationHistory
          return {
            user: (persisted as any)?.user || null,
            token: (persisted as any)?.token || null,
            isAuthenticated: !!(persisted as any)?.isAuthenticated,
            currentScreen: (persisted as any)?.currentScreen || 'login',
            pendingWithdrawalConfirmation: (persisted as any)?.pendingWithdrawalConfirmation || null,
          }
        }
        return persisted as AuthState
      },
      // Always ensure navigationHistory exists after hydration
      onRehydrateStorage: () => (state) => {
        if (state && !Array.isArray(state.navigationHistory)) {
          useAuthStore.setState({ navigationHistory: [] })
        }
      },
    }
  )
)
