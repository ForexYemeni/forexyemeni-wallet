'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Database,
  Link2,
  Unlink,
  CheckCircle,
  XCircle,
  Copy,
  RefreshCw,
  AlertTriangle,
  Shield,
  Loader2,
  ClipboardPaste,
  WifiOff,
  Play,
  KeyRound,
  UserPlus,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Info,
} from 'lucide-react'

interface ConnectionStatus {
  projectId: string | null
  connected: boolean
  isCustom: boolean
  customProjectId: string | null
  updatedAt: string | null
}

interface TestResult {
  success: boolean
  message: string
  projectId?: string
  adminExists?: boolean
  totalUsers?: number
}

interface SetupResult {
  success: boolean
  message: string
  projectId?: string
  adminCreated?: boolean
  adminUpdated?: boolean
  adminEmail?: string
  adminPassword?: string
}

interface ErrorState {
  type: 'network' | 'unknown'
  message: string
}

type SetupStep = 'idle' | 'testing' | 'tested' | 'setup' | 'done'

export default function FirebaseConfig() {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorState | null>(null)
  const [serviceAccountKey, setServiceAccountKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null)
  const [setupStep, setSetupStep] = useState<SetupStep>('idle')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Pre-fill email from current user
  useEffect(() => {
    if (user?.email && !adminEmail) {
      setAdminEmail(user.email)
    }
  }, [user?.email, adminEmail])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/firebase-config')
      const data = await res.json()
      if (data.success) {
        setStatus(data)
        setError(null)
      } else {
        setError({ type: 'network', message: data.message || 'خطأ في الاتصال بالخادم' })
      }
    } catch {
      setError({ type: 'network', message: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setServiceAccountKey(text)
        setTestResult(null)
        setSetupResult(null)
        setSetupStep('idle')
        toast.success('تم اللصق من الحافظة')
      } else {
        toast.error('الحافظة فارغة')
      }
    } catch {
      toast.error('لا يمكن الوصول للحافظة. تأكد من منح الإذن.')
    }
  }

  const handleTest = async () => {
    if (!serviceAccountKey.trim()) {
      toast.error('يرجى إدخال مفتاح Service Account')
      return
    }
    try { JSON.parse(serviceAccountKey) } catch {
      toast.error('صيغة JSON غير صالحة')
      return
    }

    setTesting(true)
    setTestResult(null)
    setSetupResult(null)
    setSetupStep('testing')
    try {
      const res = await fetch('/api/admin/firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          adminEmail: adminEmail.trim(),
          serviceAccountKey: serviceAccountKey.trim(),
        }),
      })
      const data = await res.json()
      const result: TestResult = {
        success: data.success,
        message: data.message,
        projectId: data.projectId,
        adminExists: data.adminExists,
        totalUsers: data.totalUsers,
      }
      setTestResult(result)
      setSetupStep(data.success ? 'tested' : 'idle')
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch {
      setTestResult({ success: false, message: 'خطأ في الاتصال بالخادم' })
      setSetupStep('idle')
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setTesting(false)
    }
  }

  const handleSetup = async () => {
    // Validate email
    const email = adminEmail.trim()
    if (!email || !isValidEmail(email)) {
      toast.error('يرجى إدخال بريد إلكتروني صحيح')
      return
    }
    // Validate password
    if (!adminPassword.trim() || adminPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    if (!serviceAccountKey.trim()) {
      toast.error('يرجى إدخال مفتاح Service Account')
      return
    }

    setSettingUp(true)
    setSetupStep('setup')
    setSetupResult(null)
    try {
      const res = await fetch('/api/admin/firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup',
          adminEmail: email,
          adminName: user?.fullName || 'مدير النظام',
          serviceAccountKey: serviceAccountKey.trim(),
          adminPassword: adminPassword.trim(),
        }),
      })
      const data = await res.json()
      const result: SetupResult = {
        success: data.success,
        message: data.message,
        projectId: data.projectId,
        adminCreated: data.adminCreated,
        adminUpdated: data.adminUpdated,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
      }
      setSetupResult(result)
      setSetupStep(data.success ? 'done' : 'tested')
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch {
      setSetupResult({ success: false, message: 'خطأ في الاتصال بالخادم' })
      setSetupStep('tested')
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setSettingUp(false)
    }
  }

  const handleSave = async () => {
    if (!serviceAccountKey.trim()) {
      toast.error('يرجى إدخال مفتاح Service Account')
      return
    }

    const creds = setupResult || { projectId: testResult?.projectId }
    if (!confirm(`هل أنت متأكد من تفعيل قاعدة البيانات الجديدة؟\n\nالمشروع: ${creds.projectId}\nالبريد: ${adminEmail}\n\n⚠️ بعد التفعيل سجّل خروج ثم سجّل دخول بالبيانات الجديدة.`)) {
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          serviceAccountKey: serviceAccountKey.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        toast.info('تم التفعيل! سجّل خروج ثم سجّل دخول بالبيانات الجديدة.', { duration: 8000 })
        setTestResult(null)
        setSetupResult(null)
        setSetupStep('idle')
        setServiceAccountKey('')
        setAdminPassword('')
        await fetchStatus()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = async () => {
    if (!confirm('هل أنت متأكد من الرجوع للمفتاح الافتراضي؟\nسيتم التحول لقاعدة البيانات الأصلية.')) {
      return
    }
    setReverting(true)
    try {
      const res = await fetch('/api/admin/firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        toast.info('يرجى تسجيل الخروج ثم تسجيل الدخول مجدداً.', { duration: 5000 })
        setTestResult(null)
        setSetupResult(null)
        setSetupStep('idle')
        setServiceAccountKey('')
        setAdminPassword('')
        await fetchStatus()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الرجوع للمفتاح الافتراضي')
    } finally {
      setReverting(false)
    }
  }

  const handleReset = () => {
    setTestResult(null)
    setSetupResult(null)
    setSetupStep('idle')
    setAdminPassword('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold gold-text">ربط قاعدة البيانات</h2>
            <p className="text-xs text-muted-foreground">ربط تطبيقك بقاعدة بيانات Firebase مختلفة</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <h4 className="text-sm font-bold text-red-400">خطأ في الاتصال</h4>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
          <Button onClick={fetchStatus} className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-lg h-10">
            <RefreshCw className="w-4 h-4 text-gold" />
            <span className="text-xs font-medium">إعادة المحاولة</span>
          </Button>
        </div>
      </div>
    )
  }

  // Steps
  const steps = [
    { label: 'اختبار الاتصال', icon: Link2 },
    { label: 'بيانات المسؤول', icon: UserPlus },
    { label: 'تفعيل', icon: Play },
  ]
  const currentStepIndex = setupStep === 'idle' ? -1 :
    setupStep === 'testing' ? 0 :
    setupStep === 'tested' ? 1 :
    setupStep === 'setup' ? 1 :
    setupStep === 'done' ? 2 : -1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold gold-text">ربط قاعدة البيانات</h2>
            <p className="text-xs text-muted-foreground">أضف أي قاعدة Firebase وسيتم إعدادها تلقائياً</p>
          </div>
        </div>
        <button onClick={fetchStatus} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" title="تحديث">
          <RefreshCw className="w-4 h-4 text-gold" />
        </button>
      </div>

      {/* Steps Progress */}
      {setupStep !== 'idle' && (
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const Icon = step.icon
              const isCompleted = idx < currentStepIndex || setupStep === 'done'
              const isCurrent = idx === currentStepIndex && setupStep !== 'done'
              return (
                <div key={step.label} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isCompleted ? 'bg-green-500/10 border border-green-500/20' :
                    isCurrent ? 'bg-gold/10 border border-gold/20' :
                    'bg-white/5 border border-white/5'
                  }`}>
                    <Icon className={`w-4 h-4 ${isCompleted ? 'text-green-400' : isCurrent ? 'text-gold' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${isCompleted ? 'text-green-400' : isCurrent ? 'text-gold' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                    {isCompleted && <CheckCircle className="w-3 h-3 text-green-400" />}
                    {isCurrent && (testing || settingUp) && <Loader2 className="w-3 h-3 animate-spin text-gold" />}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-4 h-px mx-1 ${idx < currentStepIndex ? 'bg-green-500/30' : 'bg-white/10'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Current Connection Status */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Link2 className="w-4 h-4 text-gold" />
          حالة الاتصال الحالية
        </h3>
        {status && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">المشروع</span>
              </div>
              <span className="text-sm font-mono font-bold text-gold" dir="ltr">{status.projectId || '—'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                {status.connected ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                <span className="text-xs text-muted-foreground">الاتصال</span>
              </div>
              <span className={`text-sm font-bold ${status.connected ? 'text-green-400' : 'text-red-400'}`}>
                {status.connected ? 'متصل ✓' : 'غير متصل'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">النوع</span>
              </div>
              <span className={`text-sm font-bold ${status.isCustom ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {status.isCustom ? 'مخصص' : 'افتراضي'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* STEP 1: Admin Credentials + Service Account Key + Test */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-gold" />
          الخطوة 1: مفتاح الاتصال + بيانات المسؤول
        </h3>
        <p className="text-xs text-muted-foreground">
          أدخل بيانات المسؤول ومفتاح Firebase لاختبار الاتصال
        </p>

        {/* Admin Email */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3 text-gold" />
            بريد المسؤول (للقاعدة الجديدة) <span className="text-red-400">*</span>
          </Label>
          <Input
            type="email"
            value={adminEmail}
            onChange={(e) => { setAdminEmail(e.target.value); handleReset() }}
            placeholder="admin@example.com"
            dir="ltr"
            className="rounded-lg bg-white/5 border border-white/10 h-10 text-sm"
          />
          {!isValidEmail(adminEmail.trim()) && adminEmail.length > 0 && (
            <p className="text-[10px] text-red-400">بريد إلكتروني غير صحيح</p>
          )}
        </div>

        {/* Service Account Key */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-gold" />
            مفتاح Service Account (JSON) <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <textarea
              value={serviceAccountKey}
              onChange={(e) => { setServiceAccountKey(e.target.value); handleReset() }}
              placeholder='{"type": "service_account", "project_id": "...", ...}'
              dir="ltr"
              rows={5}
              disabled={setupStep === 'done'}
              className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50 placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
            <div className="absolute top-2 left-2 flex gap-1">
              <button type="button" onClick={handlePasteFromClipboard} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors" title="لصق">
                <ClipboardPaste className="w-3 h-3 text-gold" />
                <span className="text-[10px] text-gold">لصق</span>
              </button>
              {serviceAccountKey && (
                <button type="button" onClick={() => { setServiceAccountKey(''); handleReset(); }} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors" title="مسح">
                  <XCircle className="w-3 h-3 text-red-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-3 rounded-lg border ${testResult.success ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
            <div className="flex items-center gap-2">
              {testResult.success ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
              <div>
                <p className={`text-xs font-bold ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.success ? 'اتصال ناجح ✓' : 'فشل الاتصال ✗'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{testResult.message}</p>
                {testResult.success && (
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span className="font-mono text-green-400/70" dir="ltr">{testResult.projectId}</span>
                    <span className="text-muted-foreground">{testResult.totalUsers || 0} مستخدم</span>
                    <span>{testResult.adminExists ? '✅ مسؤول موجود' : '🆕 قاعدة فارغة'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Test Button */}
        <Button onClick={handleTest}
          disabled={testing || !serviceAccountKey.trim() || !isValidEmail(adminEmail.trim()) || setupStep === 'done'}
          className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-lg h-10 disabled:opacity-40">
          {testing ? <Loader2 className="w-4 h-4 animate-spin text-gold" /> : <Link2 className="w-4 h-4 text-gold" />}
          <span className="text-xs font-medium">{testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}</span>
        </Button>
      </div>

      {/* STEP 2: Setup Password */}
      {setupStep === 'tested' && testResult?.success && (
        <div className="glass-card p-4 rounded-xl space-y-3 border border-gold/20">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-gold" />
            الخطوة 2: إعداد كلمة المرور
          </h3>

          {/* Info: what will happen */}
          <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-gold" />
              <span className="text-xs font-bold text-gold">سيتم إنشاء:</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 mr-6">
              <li>👤 حساب مسؤول بالبريد: <span className="text-gold font-medium" dir="ltr">{adminEmail}</span></li>
              <li>🔑 بالكلمة التي تحددها أدناه</li>
              <li>⚙️ إعدادات النظام (الرسوم، العمولات، البوت)</li>
              <li>🔢 عداد الحسابات</li>
              <li>🔗 روابط التواصل الاجتماعي</li>
            </ul>
          </div>

          {/* Admin email display */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gold" />
              <span className="text-xs text-muted-foreground">بريد المسؤول</span>
            </div>
            <span className="text-xs font-medium text-gold" dir="ltr">{adminEmail}</span>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3 text-gold" />
              كلمة المرور <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="أدخل كلمة مرور (6 أحرف على الأقل)"
                className="pl-10 pr-10 rounded-lg bg-white/5 border border-white/10 h-10 text-sm"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            </div>
            {adminPassword.length > 0 && adminPassword.length < 6 && (
              <p className="text-[10px] text-red-400">كلمة المرور قصيرة جداً (6 أحرف على الأقل)</p>
            )}
            {adminPassword.length >= 6 && (
              <p className="text-[10px] text-green-400">✓ قوة كلمة المرور مقبولة</p>
            )}
          </div>

          {/* Setup Button */}
          <Button onClick={handleSetup}
            disabled={settingUp || adminPassword.length < 6}
            className="w-full flex items-center justify-center gap-2 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg h-10 disabled:opacity-40">
            {settingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span className="text-xs font-medium">
              {settingUp ? 'جارٍ إنشاء المسؤول والإعدادات...' :
               testResult.adminExists ? 'تحديث كلمة المرور في القاعدة' : 'إنشاء المسؤول وإعداد القاعدة'}
            </span>
          </Button>
        </div>
      )}

      {/* Setup Result - SUCCESS */}
      {setupResult && setupStep === 'done' && (
        <div className="glass-card p-4 rounded-xl space-y-3 border border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-bold text-green-400">تم الإعداد بنجاح!</h3>
          </div>

          {/* Credentials Card */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
            <p className="text-xs font-bold text-white/80 mb-2">🔑 بيانات تسجيل الدخول الجديدة:</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> البريد</span>
                <span className="text-sm font-bold text-green-400" dir="ltr">{setupResult.adminEmail}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> كلمة المرور</span>
                <span className="text-sm font-mono font-bold text-green-400" dir="ltr">{setupResult.adminPassword}</span>
              </div>
            </div>
            {setupResult.adminCreated && (
              <p className="text-xs text-green-400 mt-2">✅ تم إنشاء حساب المسؤول وجميع الإعدادات الأساسية</p>
            )}
            {setupResult.adminUpdated && (
              <p className="text-xs text-amber-400 mt-2">⚠️ تم تحديث كلمة المرور لحساب مسؤول موجود مسبقاً</p>
            )}
          </div>

          {/* Warning + Activate */}
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <p className="font-bold text-amber-400 mb-1">⚠️ مهم جداً</p>
                  <p>بعد التفعيل سجّل <strong className="text-white">خروج</strong> ثم سجّل <strong className="text-white">دخول</strong> بالبيانات أعلاه</p>
                </div>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg h-10">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span className="text-xs font-medium">{saving ? 'جارٍ التفعيل...' : '✅ حفظ وتفعيل القاعدة الجديدة'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Revert */}
      {status?.isCustom && setupStep !== 'done' && (
        <div className="glass-card p-4 rounded-xl">
          <Button onClick={handleRevert} disabled={reverting}
            className="w-full flex items-center justify-center gap-2 border border-red-500/20 hover:bg-red-500/10 text-red-400 rounded-lg h-10">
            {reverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
            <span className="text-xs font-medium">{reverting ? 'جارٍ الرجوع...' : 'الرجوع لقاعدة البيانات الافتراضية'}</span>
          </Button>
        </div>
      )}

      {/* Security Warning */}
      <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-400">تحذير أمني</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              مفتاح Service Account حساس جداً ويمنح وصول كامل لقاعدة البيانات. لا تشاركه مع أي شخص.
            </p>
          </div>
        </div>
      </div>

      {/* How to get the key */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Copy className="w-4 h-4 text-muted-foreground" />
          كيف تحصل على المفتاح؟
        </h3>
        <ol className="text-xs text-muted-foreground leading-relaxed list-decimal list-inside space-y-1 mr-2">
          <li>افتح <a href="https://console.firebase.google.com" target="_blank" className="text-gold underline" rel="noreferrer">Firebase Console</a></li>
          <li>اختر المشروع (أو أنشئ مشروع جديد)</li>
          <li>اذهب إلى ⚙️ Project Settings → Service Accounts</li>
          <li>اضغط &quot;Generate new private key&quot;</li>
          <li>انسخ محتوى ملف JSON بالكامل</li>
          <li>الصقه هنا واتبع الخطوات</li>
        </ol>
      </div>
    </div>
  )
}
