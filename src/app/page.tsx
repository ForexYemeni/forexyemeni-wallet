'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, Lock, Image as ImageIcon, RefreshCw, AlertTriangle } from 'lucide-react'

// Lazy load ALL components — only loads what's needed
const LoginForm = dynamic(() => import('@/components/auth/LoginForm'), { ssr: false })
const RegisterForm = dynamic(() => import('@/components/auth/RegisterForm'), { ssr: false })
const ForgotPasswordForm = dynamic(() => import('@/components/auth/ForgotPasswordForm'), { ssr: false })
const ForceChangePassword = dynamic(() => import('@/components/auth/ForceChangePassword'), { ssr: false })
const DeviceLockedScreen = dynamic(() => import('@/components/auth/DeviceLockedScreen'), { ssr: false })
const Dashboard = dynamic(() => import('@/components/wallet/Dashboard'), { ssr: false })
const DepositForm = dynamic(() => import('@/components/wallet/DepositForm'), { ssr: false })
const WithdrawForm = dynamic(() => import('@/components/wallet/WithdrawForm'), { ssr: false })
const TransactionHistory = dynamic(() => import('@/components/wallet/TransactionHistory'), { ssr: false })
const KYCVerification = dynamic(() => import('@/components/kyc/KYCVerification'), { ssr: false })
const SettingsPage = dynamic(() => import('@/components/settings/Settings'), { ssr: false })
const NotificationsPage = dynamic(() => import('@/components/settings/NotificationsPage'), { ssr: false })
const AdminPanel = dynamic(() => import('@/components/admin/AdminPanel'), { ssr: false })
const AppLayout = dynamic(() => import('@/components/layout/AppLayout'), { ssr: false })

interface PendingWithdrawal {
  amount: number
  fee: number
  netAmount: number
  method: string
  screenshot: string | null
  status: string
  walletAddress?: string
  walletName?: string
}

// Error Boundary component to catch client-side rendering errors
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card p-6 text-center space-y-4 w-full max-w-sm animate-scale-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-red-400">حدث خطأ غير متوقع</h2>
          <p className="text-sm text-muted-foreground mt-2">
            يرجى تحديث الصفحة أو تسجيل الدخول مرة أخرى
          </p>
        </div>
        <div className="space-y-2">
          <button
            onClick={resetErrorBoundary}
            className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
          <button
            onClick={() => {
              // Clear all cached state and reload
              try { localStorage.removeItem('forexyemeni-auth') } catch {}
              window.location.href = '/'
            }}
            className="w-full h-11 bg-white/10 text-foreground font-medium rounded-xl hover:bg-white/20 transition-all text-sm"
          >
            مسح البيانات وتحديث الصفحة
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const currentScreen = useAuthStore(s => s.currentScreen)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const setScreen = useAuthStore(s => s.setScreen)
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const setPendingWithdrawalConfirmation = useAuthStore(s => s.setPendingWithdrawalConfirmation)
  const updateUser = useAuthStore(s => s.updateUser)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [pendingWithdrawal, setPendingWithdrawal] = useState<PendingWithdrawal | null>(null)
  const [loadingWithdrawal, setLoadingWithdrawal] = useState(true)
  const [showProofImage, setShowProofImage] = useState(false)

  // Hydration safety: wait until client-side is mounted
  const [mounted, setMounted] = useState(false)
  // Error state
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Global error handler — only for critical errors
  useEffect(() => {
    const handler = (event: Event | PromiseRejectionEvent) => {
      const err = event instanceof PromiseRejectionEvent
        ? new Error(String(event.reason))
        : (event as ErrorEvent).error
      console.error('[App Error]', err)
      // Don't set error state for non-critical errors
      const msg = err?.message || String(event) || ''
      const nonCriticalKeywords = [
        'AudioContext', 'Notification', 'vibrate',
        'fetch', 'network', 'Failed to fetch',
        'service worker', 'push notification',
        'Capacitor', 'FCM', 'token',
      ]
      if (nonCriticalKeywords.some(kw => msg.toLowerCase().includes(kw.toLowerCase()))) {
        return
      }
      setError(err)
    }
    window.addEventListener('error', handler)
    window.addEventListener('unhandledrejection', handler)
    return () => {
      window.removeEventListener('error', handler)
      window.removeEventListener('unhandledrejection', handler)
    }
  }, [])

  const resetError = useCallback(() => {
    setError(null)
    // Try clearing stale state
    try {
      const stored = localStorage.getItem('forexyemeni-auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        // If stored state has isAuthenticated: true but no valid user, clear it
        if (parsed?.state?.isAuthenticated && !parsed?.state?.user?.id) {
          localStorage.removeItem('forexyemeni-auth')
          window.location.reload()
          return
        }
      }
    } catch {}
  }, [])

  // Validate stored auth state on mount — clear stale state
  useEffect(() => {
    if (!mounted) return
    // If authenticated but no valid user, clear
    if (isAuthenticated && !user?.id) {
      console.warn('[Auth] Invalid state: authenticated but no user. Clearing...')
      logout()
      return
    }
    // If device-locked screen but no stored context, go to login
    if (!isAuthenticated && currentScreen === 'device-locked') {
      // Keep showing locked screen — user needs to go back to login manually
    }
  }, [mounted, isAuthenticated, user?.id, logout, currentScreen])

  // Fetch withdrawal data when confirmation is pending
  useEffect(() => {
    if (isAuthenticated && user?.pendingConfirmation) {
      setLoadingWithdrawal(true)
      fetch(`/api/admin/withdrawals?id=${user.pendingConfirmation}`)
        .then(res => {
          if (!res.ok) throw new Error('API error')
          return res.json()
        })
        .then(data => {
          if (data.success && data.withdrawals?.length > 0) {
            const w = data.withdrawals[0]
            setPendingWithdrawal({
              amount: w.amount || 0,
              fee: w.fee || 0,
              netAmount: w.netAmount || (w.amount || 0) - (w.fee || 0),
              method: w.method || '',
              screenshot: w.screenshot || null,
              status: w.status || '',
              walletAddress: w.walletAddress,
              walletName: w.walletName,
            })
          } else {
            // Invalid or expired confirmation — clear it
            setPendingWithdrawalConfirmation(null)
            updateUser({ pendingConfirmation: null } as any)
          }
        })
        .catch(() => {
          // Failed to fetch confirmation data — clear stale state
          setPendingWithdrawalConfirmation(null)
          updateUser({ pendingConfirmation: null } as any)
        })
        .finally(() => setLoadingWithdrawal(false))
    }
  }, [isAuthenticated, user?.pendingConfirmation])

  // Show loading until client hydration is complete
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    )
  }

  // Show error fallback if an error occurred
  if (error) {
    return <ErrorFallback error={error} resetErrorBoundary={resetError} />
  }

  // Force change password screen
  if (isAuthenticated && currentScreen === 'force-change-password') {
    return <ForceChangePassword />
  }

  // Withdrawal confirmation dialog (blocking)
  if (isAuthenticated && user?.pendingConfirmation) {
    const handleConfirm = async () => {
      if (!confirmPassword) { toast.error('يرجى إدخال كلمة المرور'); return }
      setConfirmLoading(true)
      try {
        const res = await fetch('/api/withdrawals/confirm-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, withdrawalId: user.pendingConfirmation, password: confirmPassword }),
        })
        const data = await res.json()
        if (data.success) {
          toast.success('تم تأكيد الاستلام بنجاح')
          setPendingWithdrawalConfirmation(null)
          updateUser({ pendingConfirmation: null } as any)
          setConfirmPassword('')
        } else {
          toast.error(data.message)
        }
      } catch {
        toast.error('حدث خطأ')
      } finally {
        setConfirmLoading(false)
      }
    }

    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-4 z-50">
        <div className="glass-card p-6 space-y-5 w-full max-w-sm animate-scale-in max-h-[90vh] overflow-y-auto">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center gold-glow">
              <Lock className="w-8 h-8 text-gold" />
            </div>
            <h2 className="text-xl font-bold gold-text">تأكيد الاستلام</h2>
            <p className="text-sm text-muted-foreground">
              تم سحب أموالك بنجاح. تحقق من التفاصيل ثم أكد الاستلام بكلمة المرور.
            </p>
          </div>

          {loadingWithdrawal ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-gold" />
            </div>
          ) : pendingWithdrawal ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">مبلغ السحب</span>
                  <span className="text-lg font-bold gold-text">{(pendingWithdrawal.amount || 0).toFixed(2)} USDT</span>
                </div>
                {pendingWithdrawal.fee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الرسوم</span>
                    <span className="text-sm text-red-400">-{pendingWithdrawal.fee.toFixed(2)} USDT</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">المبلغ الصافي</span>
                  <span className="text-lg font-bold text-green-400">{(pendingWithdrawal.netAmount || 0).toFixed(2)} USDT</span>
                </div>
                {pendingWithdrawal.method && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>الطريقة</span>
                    <span>{pendingWithdrawal.method}</span>
                  </div>
                )}
              </div>

              {pendingWithdrawal.screenshot ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">إثبات الدفع:</p>
                  <div
                    className="relative rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-gold/30 transition-colors"
                    onClick={() => setShowProofImage(true)}
                  >
                    <img
                      src={pendingWithdrawal.screenshot}
                      alt="إثبات الدفع"
                      className="w-full h-48 object-contain bg-black/30"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded-lg flex items-center gap-1 text-xs text-white">
                      <ImageIcon className="w-3 h-3" />
                      اضغط لتكبير
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-400 text-center">
                  لم يتم رفع إثبات دفع بعد
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-3">
            <input
              type="password"
              placeholder="أدخل كلمة المرور للتأكيد"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm"
              dir="ltr"
            />
            <button
              onClick={handleConfirm}
              disabled={confirmLoading || !confirmPassword}
              className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all gold-glow"
            >
              {confirmLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تأكيد الاستلام'}
            </button>
          </div>
        </div>

        {showProofImage && pendingWithdrawal?.screenshot && (
          <div
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowProofImage(false)}
          >
            <div className="relative max-w-lg w-full">
              <button
                className="absolute -top-10 left-0 text-white text-sm hover:text-gold transition-colors"
                onClick={() => setShowProofImage(false)}
              >
                إغلاق
              </button>
              <img
                src={pendingWithdrawal.screenshot}
                alt="إثبات الدفع"
                className="w-full rounded-xl"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Authentication Screens
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/hero-bg.png"
            alt=""
            className="w-full h-full object-cover opacity-30"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>

        <div className="relative z-10 w-full max-w-sm mx-auto px-4">
          {currentScreen === 'login' && <LoginForm />}
          {currentScreen === 'register' && <RegisterForm />}
          {currentScreen === 'forgot-password' && <ForgotPasswordForm />}
          {currentScreen === 'device-locked' && <DeviceLockedScreen />}
          {currentScreen === 'verify-email' && (
            <div className="glass-card p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl gold-gradient flex items-center justify-center gold-glow">
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="text-xl font-bold gold-text">يرجى تفعيل بريدك</h2>
              <p className="text-sm text-muted-foreground">أدخل رمز التحقق المرسل إلى بريدك الإلكتروني</p>
              <button
                onClick={() => setScreen('login')}
                className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all"
              >
                العودة لتسجيل الدخول
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main App Screens
  return (
    <AppLayout>
      {currentScreen === 'dashboard' && <Dashboard />}
      {currentScreen === 'deposit' && <DepositForm />}
      {currentScreen === 'withdraw' && <WithdrawForm />}
      {currentScreen === 'transactions' && <TransactionHistory />}
      {currentScreen === 'kyc' && <KYCVerification />}
      {currentScreen === 'settings' && <SettingsPage />}
      {currentScreen === 'notifications' && <NotificationsPage />}
      {currentScreen === 'admin' && <AdminPanel />}
    </AppLayout>
  )
}
