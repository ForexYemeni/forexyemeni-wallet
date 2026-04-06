import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Safety: clear corrupted localStorage data on import
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('forexyameni-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      const state = parsed?.state || parsed
      // Remove navigationHistory from stored data if it exists (old/corrupt data)
      if (state && state.navigationHistory !== undefined) {
        delete state.navigationHistory
        localStorage.setItem('forexyameni-auth', JSON.stringify(parsed))
      }
    }
  } catch {
    // Corrupted data - clear it
    try { localStorage.removeItem('forexyameni-auth') } catch {}
  }
}

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
    (set) => ({
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
        // Clear stale withdrawal confirmation from previous sessions
        pendingWithdrawalConfirmation: user?.pendingConfirmation || null,
        // Reset navigation history on login
        navigationHistory: [],
      })
      },
      logout: () => set({ user: null, token: null, isAuthenticated: false, currentScreen: 'login', pendingRegistration: null, pendingWithdrawalConfirmation: null, navigationHistory: [] }),
      clearForLock: () => set({ user: null, token: null, isAuthenticated: false, currentScreen: 'device-locked', pendingRegistration: null, pendingWithdrawalConfirmation: null, navigationHistory: [] }),
      setScreen: (screen) => set((state) => {
        // Don't push duplicate consecutive screens
        const prev = state.currentScreen
        if (screen === prev) return { currentScreen: screen }
        const history = state.navigationHistory || []
        return {
          currentScreen: screen,
          navigationHistory: [...history, prev],
        }
      }),
      goBack: () => {
        const state = useAuthStore.getState()
        const history = state.navigationHistory || []
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
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        currentScreen: state.currentScreen,
        pendingWithdrawalConfirmation: state.pendingWithdrawalConfirmation,
      }),
      merge: (persisted, current) => {
        try {
          const p = persisted as Record<string, unknown> | null
          return {
            ...current,
            ...(p || {}),
            // Always reset navigationHistory - never persist it
            navigationHistory: [],
          } as AuthState
        } catch {
          // If merge fails, return defaults
          return { ...current, navigationHistory: [] } as AuthState
        }
      },
    }
  )
)
