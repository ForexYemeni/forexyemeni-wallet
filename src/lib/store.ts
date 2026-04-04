import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  createdAt: string
  merchantId?: string | null
  affiliateCode?: string | null
  permissions?: { manageUsers?: boolean; approveDeposits?: boolean; approveWithdrawals?: boolean; approveKYC?: boolean; manageSettings?: boolean } | null
}

interface AuthState {
  user: User | null
  token: string | null
  currentScreen: string
  isAuthenticated: boolean
  pendingRegistration: { email: string; fullName: string; password: string } | null
  pendingWithdrawalConfirmation: string | null
  setAuth: (user: User, token: string, mustChangePassword?: boolean) => void
  logout: () => void
  setScreen: (screen: string) => void
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
      setAuth: (user, token, mustChangePassword = false) => set({
        user,
        token,
        isAuthenticated: true,
        currentScreen: mustChangePassword
          ? 'force-change-password'
          : (user.role === 'admin' || (user.permissions && Object.values(user.permissions).some(v => v)))
            ? 'admin'
            : !user.hasPin
              ? 'set-pin'
              : user.merchantId
                ? 'p2p'
                : 'dashboard',
        // Clear stale withdrawal confirmation from previous sessions
        pendingWithdrawalConfirmation: user?.pendingConfirmation || null,
      }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, currentScreen: 'login', pendingRegistration: null, pendingWithdrawalConfirmation: null }),
      clearForLock: () => set({ user: null, token: null, isAuthenticated: false, currentScreen: 'device-locked', pendingRegistration: null, pendingWithdrawalConfirmation: null }),
      setScreen: (screen) => set({ currentScreen: screen }),
      updateBalance: (balance) => set((state) => ({ user: state.user ? { ...state.user, balance } : null })),
      updateUser: (updates) => set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
      setPendingRegistration: (data) => set({ pendingRegistration: data }),
      setPendingWithdrawalConfirmation: (id) => set({ pendingWithdrawalConfirmation: id }),
    }),
    {
      name: 'forexyemeni-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        currentScreen: state.currentScreen,
        pendingWithdrawalConfirmation: state.pendingWithdrawalConfirmation,
      }),
    }
  )
)
