'use client'

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
import AppLayout from '@/components/layout/AppLayout'

export default function Home() {
  const { currentScreen, isAuthenticated, setScreen } = useAuthStore()

  // Force change password screen (shown after login with temp password)
  if (isAuthenticated && currentScreen === 'force-change-password') {
    return <ForceChangePassword />
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
