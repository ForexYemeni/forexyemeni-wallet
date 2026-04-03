'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import LoginForm from '@/components/auth/LoginForm'
import RegisterForm from '@/components/auth/RegisterForm'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'
import ForceChangePassword from '@/components/auth/ForceChangePassword'
import Dashboard from '@/components/wallet/Dashboard'
import DepositForm from '@/components/wallet/DepositForm'
import WithdrawForm from '@/components/wallet/WithdrawForm'
import TransactionHistory from '@/components/wallet/TransactionHistory'
import KYCVerification from '@/components/kyc/KYCVerification'
import SettingsPage from '@/components/settings/Settings'
import NotificationsPage from '@/components/settings/NotificationsPage'
import AdminPanel from '@/components/admin/AdminPanel'
import DeviceLockedScreen from '@/components/auth/DeviceLockedScreen'
import AppLayout from '@/components/layout/AppLayout'
import { toast } from 'sonner'
import { Loader2, Lock, Image as ImageIcon } from 'lucide-react'

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

export default function Home() {
  const { currentScreen, isAuthenticated, setScreen, user, setPendingWithdrawalConfirmation, updateUser } = useAuthStore()
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [pendingWithdrawal, setPendingWithdrawal] = useState<PendingWithdrawal | null>(null)
  const [loadingWithdrawal, setLoadingWithdrawal] = useState(true)
  const [showProofImage, setShowProofImage] = useState(false)

  // Fetch withdrawal data when confirmation is pending
  useEffect(() => {
    if (isAuthenticated && user?.pendingConfirmation) {
      setLoadingWithdrawal(true)
      fetch(`/api/admin/withdrawals?id=${user.pendingConfirmation}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.withdrawals?.length > 0) {
            const w = data.withdrawals[0]
            setPendingWithdrawal({
              amount: w.amount,
              fee: w.fee || 0,
              netAmount: w.netAmount || w.amount - (w.fee || 0),
              method: w.method || '',
              screenshot: w.screenshot || null,
              status: w.status,
              walletAddress: w.walletAddress,
              walletName: w.walletName,
            })
          }
        })
        .catch(() => {})
        .finally(() => setLoadingWithdrawal(false))
    }
  }, [isAuthenticated, user?.pendingConfirmation])

  // Check pendingConfirmation on mount
  useEffect(() => {
    if (isAuthenticated && user?.pendingConfirmation) {
      // Keep the confirmation dialog visible
    }
  }, [isAuthenticated, user?.pendingConfirmation])

  // Force change password screen (shown after login with temp password)
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
              {/* Withdrawal amount details */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">مبلغ السحب</span>
                  <span className="text-lg font-bold gold-text">{pendingWithdrawal.amount.toFixed(2)} USDT</span>
                </div>
                {pendingWithdrawal.fee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الرسوم</span>
                    <span className="text-sm text-red-400">-{pendingWithdrawal.fee.toFixed(2)} USDT</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">المبلغ الصافي</span>
                  <span className="text-lg font-bold text-green-400">{pendingWithdrawal.netAmount.toFixed(2)} USDT</span>
                </div>
                {pendingWithdrawal.method && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>الطريقة</span>
                    <span>{pendingWithdrawal.method}</span>
                  </div>
                )}
              </div>

              {/* Payment proof image */}
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

        {/* Full screen image preview */}
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
                ✕ إغلاق
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
        {/* Background */}
        <div className="absolute inset-0">
          <img
            src="/hero-bg.png"
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>

        {/* Auth Content */}
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
