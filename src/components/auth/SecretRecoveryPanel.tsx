import { apiFetch } from '@/lib/api-client'
'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  X, Eye, EyeOff, Loader2, CheckCircle, XCircle,
  Database, KeyRound, Mail, Lock, Link2, AlertTriangle,
  ShieldCheck, RefreshCw, Bell, BellRing, Trash2, Send,
  Volume2, Smartphone, Wifi, WifiOff, ChevronDown, ChevronUp,
  MonitorSmartphone, Clipboard, FileJson
} from 'lucide-react'

type Step = 'closed' | 'pin' | 'main'
type PanelTab = 'database' | 'fcm'

interface TestResult {
  success: boolean
  message: string
  projectId?: string
  totalUsers?: number
  adminExists?: boolean
}

interface FcmDiagnostics {
  projectId?: string
  firebaseMessaging?: string
  totalTokens?: number
  adminTokenCount?: number
  uniqueUsersWithTokens?: number
  tokens?: { id: string; token: string; deviceName?: string; userId?: string; createdAt?: string }[]
  error?: string
}

interface FcmTestResult {
  success: boolean
  message: string
  projectId?: string
  sentTo?: number
  successCount?: number
  failureCount?: number
  errors?: { token: string; code: string; message: string }[]
}

// PIN pad keys
const pinPadKeys = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'delete'],
]

export default function SecretRecoveryPanel({ currentProjectId }: { currentProjectId?: string }) {
  const [step, setStep] = useState<Step>('closed')
  const [tapCount, setTapCount] = useState(0)
  const tapTimer = useRef<NodeJS.Timeout | null>(null)
  const [serviceAccountKey, setServiceAccountKey] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [currentDb, setCurrentDb] = useState(currentProjectId || '')

  // Panel tab
  const [activeTab, setActiveTab] = useState<PanelTab>('database')

  // PIN pad state
  const [pinDigits, setPinDigits] = useState<string[]>([])
  const [pinError, setPinError] = useState(false)
  const [pinShake, setPinShake] = useState(false)
  const [pinVerifying, setPinVerifying] = useState(false)

  // Change PIN state
  const [showChangePin, setShowChangePin] = useState(false)
  const [currentPinInput, setCurrentPinInput] = useState('')
  const [newPinInput, setNewPinInput] = useState('')
  const [changingPin, setChangingPin] = useState(false)

  // google-services.json state
  const [googleServicesJson, setGoogleServicesJson] = useState('')
  const [gsjValid, setGsjValid] = useState<boolean | null>(null)
  const [gsjProjectId, setGsjProjectId] = useState('')

  // FCM state
  const [fcmDiagnostics, setFcmDiagnostics] = useState<FcmDiagnostics | null>(null)
  const [fcmLoading, setFcmLoading] = useState(false)
  const [fcmTesting, setFcmTesting] = useState(false)
  const [fcmTestResult, setFcmTestResult] = useState<FcmTestResult | null>(null)
  const [fcmCleaning, setFcmCleaning] = useState(false)
  const [fcmCleanupResult, setFcmCleanupResult] = useState<{ success: boolean; message: string; cleanedCount?: number; totalTokens?: number; validCount?: number } | null>(null)
  const [fcmSendUserId, setFcmSendUserId] = useState('')
  const [fcmSendTitle, setFcmSendTitle] = useState('')
  const [fcmSendMessage, setFcmSendMessage] = useState('')
  const [fcmSending, setFcmSending] = useState(false)
  const [showFcmSendForm, setShowFcmSendForm] = useState(false)
  const [showFcmTokens, setShowFcmTokens] = useState(false)

  // Header tap: 10 taps → show PIN pad
  const handleHeaderTap = useCallback(() => {
    const newCount = tapCount + 1
    setTapCount(newCount)

    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => setTapCount(0), 3000)

    if (newCount >= 10) {
      setTapCount(0)
      setStep('pin')
      setPinDigits([])
      setPinError(false)
      setShowChangePin(false)
    }
  }, [tapCount])

  // PIN digit handler — auto-submit when 6 digits
  const handlePinDigit = (digit: string) => {
    if (pinDigits.length >= 6) return
    setPinError(false)
    setPinShake(false)
    const newDigits = [...pinDigits, digit]
    setPinDigits(newDigits)

    if (newDigits.length === 6) {
      const enteredPin = newDigits.join('')
      verifyPin(enteredPin)
    }
  }

  const verifyPin = async (pin: string) => {
    setPinVerifying(true)
    try {
      const res = await apiFetch('/api/emergency/recovery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin }),
      })
      const data = await res.json()

      if (data.success) {
        setStep('main')
        fetchStatus()
        // Auto-load FCM status
        fetchFcmStatus()
      } else {
        setPinError(true)
        setPinShake(true)
        setTimeout(() => {
          setPinDigits([])
          setPinShake(false)
        }, 800)
      }
    } catch {
      setPinError(true)
      setPinShake(true)
      setTimeout(() => {
        setPinDigits([])
        setPinShake(false)
      }, 800)
    } finally {
      setPinVerifying(false)
    }
  }

  const handlePinDelete = () => {
    if (pinDigits.length === 0) return
    setPinDigits(prev => prev.slice(0, -1))
    setPinError(false)
  }

  const handleClosePin = () => {
    setStep('closed')
    setPinDigits([])
    setPinError(false)
    setPinShake(false)
    setTapCount(0)
    setShowChangePin(false)
  }

  const fetchStatus = async () => {
    try {
      const res = await apiFetch('/api/emergency/secret-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      })
      const data = await res.json()
      if (data.success) {
        setCurrentDb(data.currentProjectId)
      }
    } catch {}
  }

  const handleTest = async () => {
    if (!serviceAccountKey.trim()) {
      toast.error('أدخل مفتاح Service Account')
      return
    }
    try { JSON.parse(serviceAccountKey) } catch {
      toast.error('صيغة JSON غير صالحة')
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiFetch('/api/emergency/secret-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          serviceAccountKey: serviceAccountKey.trim(),
          adminEmail: adminEmail.trim() || undefined,
        }),
      })
      const data = await res.json()
      setTestResult(data)
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch {
      setTestResult({ success: false, message: 'خطأ في الاتصال' })
    } finally {
      setTesting(false)
    }
  }

  const validateGoogleServicesJson = (json: string): { valid: boolean; projectId?: string; error?: string } => {
    try {
      const parsed = JSON.parse(json)
      if (!parsed.project_info?.project_id) {
        return { valid: false, error: 'لم يتم العثور على project_id في الملف' }
      }
      if (!parsed.client?.length) {
        return { valid: false, error: 'لم يتم العثور على بيانات التطبيق في الملف' }
      }
      const pkg = parsed.client[0]?.client_info?.android_client_info?.package_name
      if (pkg !== 'com.forexyemeni.wallet') {
        return { valid: false, error: `حزمة التطبيق غير مطابقة: ${pkg} (يجب أن تكون com.forexyemeni.wallet)` }
      }
      return { valid: true, projectId: parsed.project_info.project_id }
    } catch {
      return { valid: false, error: 'صيغة JSON غير صالحة' }
    }
  }

  const handlePasteGsj = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setGoogleServicesJson(text)
        const validation = validateGoogleServicesJson(text)
        setGsjValid(validation.valid)
        setGsjProjectId(validation.projectId || '')
        if (validation.valid) {
          toast.success('ملف google-services.json صالح ✓')
        } else {
          toast.error(validation.error || 'ملف غير صالح')
        }
      }
    } catch {
      toast.error('لا يمكن الوصول للحافظة')
    }
  }

  const handleGoogleServicesChange = (value: string) => {
    setGoogleServicesJson(value)
    if (value.trim()) {
      const validation = validateGoogleServicesJson(value)
      setGsjValid(validation.valid)
      setGsjProjectId(validation.projectId || '')
    } else {
      setGsjValid(null)
      setGsjProjectId('')
    }
  }

  const handleSave = async () => {
    if (!serviceAccountKey.trim()) {
      toast.error('أدخل مفتاح Service Account')
      return
    }
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error('البريد وكلمة المرور مطلوبان')
      return
    }
    if (adminPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    if (!googleServicesJson.trim()) {
      toast.error('ملف google-services.json مطلوب للإشعارات الصوتية')
      return
    }
    const gsjValidation = validateGoogleServicesJson(googleServicesJson)
    if (!gsjValidation.valid) {
      toast.error(gsjValidation.error || 'ملف google-services.json غير صالح')
      return
    }
    // Check project IDs match
    let saProjectId = ''
    try {
      const sa = JSON.parse(serviceAccountKey)
      saProjectId = sa.project_id || ''
    } catch {}
    if (saProjectId && gsjProjectId && saProjectId !== gsjProjectId) {
      toast.error(`معرف المشروع غير مطابق! Service Account: ${saProjectId} ≠ Google Services: ${gsjProjectId}`)
      return
    }

    if (!confirm('⚠️ تأكيد: سيتم تبديل قاعدة البيانات وملف الإشعارات.\n\nتأكد من صحة البيانات قبل المتابعة.')) {
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch('/api/emergency/secret-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          serviceAccountKey: serviceAccountKey.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword.trim(),
          googleServicesJson: googleServicesJson.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message, { duration: 8000 })
        setStep('closed')
        setServiceAccountKey('')
        setGoogleServicesJson('')
        setGsjValid(null)
        setGsjProjectId('')
        setAdminEmail('')
        setAdminPassword('')
        setTestResult(null)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setSaving(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setServiceAccountKey(text)
        setTestResult(null)
        toast.success('تم اللصق')
      }
    } catch {
      toast.error('لا يمكن الوصول للحافظة')
    }
  }

  // Change PIN handler
  const handleChangePin = async () => {
    if (!currentPinInput || currentPinInput.length < 4) {
      toast.error('أدخل رمز PIN الحالي')
      return
    }
    if (!newPinInput || newPinInput.length < 4) {
      toast.error('أدخل رمز PIN الجديد (4 أرقام على الأقل)')
      return
    }
    if (!/^\d+$/.test(newPinInput)) {
      toast.error('رمز PIN يجب أن يكون أرقاماً فقط')
      return
    }

    setChangingPin(true)
    try {
      const res = await apiFetch('/api/emergency/recovery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change',
          pin: currentPinInput,
          newPin: newPinInput,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(data.message, { duration: 5000 })
        setCurrentPinInput('')
        setNewPinInput('')
        setShowChangePin(false)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setChangingPin(false)
    }
  }

  // ===== FCM Functions =====

  const fetchFcmStatus = async () => {
    setFcmLoading(true)
    setFcmDiagnostics(null)
    setFcmTestResult(null)
    setFcmCleanupResult(null)
    try {
      const res = await apiFetch('/api/emergency/secret-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fcm-status',
          serviceAccountKey: serviceAccountKey.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setFcmDiagnostics(data.diagnostics)
      } else {
        setFcmDiagnostics({ error: data.message })
      }
    } catch {
      setFcmDiagnostics({ error: 'خطأ في الاتصال' })
    } finally {
      setFcmLoading(false)
    }
  }

  const handleFcmTest = async () => {
    setFcmTesting(true)
    setFcmTestResult(null)
    try {
      const res = await apiFetch('/api/emergency/secret-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fcm-test',
          serviceAccountKey: serviceAccountKey.trim() || undefined,
          userId: fcmSendUserId.trim() || undefined,
        }),
      })
      const data = await res.json()
      setFcmTestResult(data)
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch {
      setFcmTestResult({ success: false, message: 'خطأ في الاتصال' })
    } finally {
      setFcmTesting(false)
    }
  }

  const handleFcmCleanup = async () => {
    setFcmCleaning(true)
    setFcmCleanupResult(null)
    try {
      const res = await apiFetch('/api/emergency/secret-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fcm-cleanup',
          serviceAccountKey: serviceAccountKey.trim() || undefined,
        }),
      })
      const data = await res.json()
      setFcmCleanupResult(data)
      if (data.success) {
        toast.success(data.message)
        // Refresh FCM status after cleanup
        fetchFcmStatus()
      } else {
        toast.error(data.message)
      }
    } catch {
      setFcmCleanupResult({ success: false, message: 'خطأ في الاتصال' })
    } finally {
      setFcmCleaning(false)
    }
  }

  const handleFcmSend = async () => {
    if (!fcmSendUserId.trim()) {
      toast.error('أدخل معرف المستخدم')
      return
    }
    if (!fcmSendMessage.trim()) {
      toast.error('أدخل نص الإشعار')
      return
    }

    setFcmSending(true)
    try {
      const res = await apiFetch('/api/emergency/secret-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fcm-send',
          serviceAccountKey: serviceAccountKey.trim() || undefined,
          userId: fcmSendUserId.trim(),
          title: fcmSendTitle.trim() || 'إشعار جديد',
          message: fcmSendMessage.trim(),
          fcmType: 'info',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setFcmSendUserId('')
        setFcmSendTitle('')
        setFcmSendMessage('')
        setShowFcmSendForm(false)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setFcmSending(false)
    }
  }

  const handleClose = () => {
    setStep('closed')
    setTapCount(0)
    setShowChangePin(false)
    setCurrentPinInput('')
    setNewPinInput('')
    setGoogleServicesJson('')
    setGsjValid(null)
    setGsjProjectId('')
    setFcmDiagnostics(null)
    setFcmTestResult(null)
    setFcmCleanupResult(null)
    setActiveTab('database')
    setFcmSendUserId('')
    setFcmSendTitle('')
    setFcmSendMessage('')
    setShowFcmSendForm(false)
    setShowFcmTokens(false)
  }

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  return (
    <>
      {/* ===== Tappable header title (invisible 10-tap trigger) ===== */}
      <h1
        className="text-2xl font-bold gold-text cursor-default select-none"
        onClick={handleHeaderTap}
      >
        استعادة كلمة المرور
      </h1>

      {/* ===== PIN Pad Modal ===== */}
      {step === 'pin' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ animation: 'srfadeIn 0.2s ease-out' }}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClosePin} />

          <div
            className={`relative w-full max-w-xs bg-[#0f172a] border border-white/10 rounded-3xl p-6 space-y-5 ${pinShake ? 'sr-shake' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={handleClosePin}
              className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="text-center space-y-3 pt-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">رمز الأمان</h3>
                <p className="text-xs text-muted-foreground mt-1">أدخل رمز PIN المكون من 6 أرقام</p>
              </div>
            </div>

            {/* PIN Dots */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    pinVerifying
                      ? 'bg-amber-400/60 animate-pulse'
                      : pinError
                        ? 'bg-red-500 shadow-lg shadow-red-500/40'
                        : i < pinDigits.length
                          ? 'bg-amber-400 shadow-lg shadow-amber-400/40 scale-110'
                          : 'bg-white/10 border border-white/20'
                  }`}
                  style={{
                    animation: (i < pinDigits.length && !pinVerifying) ? 'srdotPop 0.2s ease-out' : 'none',
                    animationDelay: `${i * 0.03}s`,
                  }}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-center text-xs text-red-400" style={{ animation: 'srfadeIn 0.2s ease-out' }}>
                رمز PIN غير صحيح
              </p>
            )}

            {/* PIN Pad Grid */}
            <div className="grid grid-cols-3 gap-2">
              {pinPadKeys.flat().map((key, idx) => (
                key === '' ? (
                  <div key={idx} />
                ) : key === 'delete' ? (
                  <button
                    key={idx}
                    onClick={handlePinDelete}
                    disabled={pinVerifying}
                    className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors active:scale-95 disabled:opacity-30"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414A2 2 0 0110.828 5H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    key={idx}
                    onClick={() => handlePinDigit(key)}
                    disabled={pinVerifying}
                    className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-xl font-bold text-white transition-all active:scale-95 disabled:opacity-30"
                  >
                    {key}
                  </button>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== Main Recovery Panel ===== */}
      {step === 'main' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-[#0f172a] border border-amber-500/20 rounded-2xl my-8 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-400">🔒 لوحة التحكم السرية</h3>
              </div>
              <button onClick={handleClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex mx-4 gap-1 p-1 rounded-xl bg-white/5">
              <button
                onClick={() => setActiveTab('database')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'database'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-muted-foreground hover:text-white hover:bg-white/5'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                قاعدة البيانات
              </button>
              <button
                onClick={() => { setActiveTab('fcm'); if (!fcmDiagnostics && !fcmLoading) fetchFcmStatus() }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'fcm'
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-muted-foreground hover:text-white hover:bg-white/5'
                }`}
              >
                <BellRing className="w-3.5 h-3.5" />
                الإشعارات الصوتية
              </button>
            </div>

            <div className="px-4 pb-4 max-h-[80vh] overflow-y-auto space-y-4">
              {/* =================== DATABASE TAB =================== */}
              {activeTab === 'database' && (
                <>
                  {/* Current Status */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">القاعدة الحالية</span>
                      <span className="text-xs font-mono text-amber-400" dir="ltr">{currentDb}</span>
                    </div>
                  </div>

                  {/* Change PIN Button */}
                  {!showChangePin && !testResult?.success && (
                    <button
                      onClick={() => setShowChangePin(true)}
                      className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-white"
                    >
                      <KeyRound className="w-4 h-4" />
                      تغيير رمز PIN
                    </button>
                  )}

                  {/* Change PIN Panel */}
                  {showChangePin && (
                    <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                      <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        تغيير رمز PIN
                      </h4>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">رمز PIN الحالي</Label>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={8}
                            value={currentPinInput}
                            onChange={e => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="أدخل PIN الحالي"
                            dir="ltr"
                            className="bg-white/5 border border-white/10 h-10 text-sm text-center tracking-widest font-mono rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">رمز PIN الجديد (4 أرقام على الأقل)</Label>
                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={8}
                            value={newPinInput}
                            onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="أدخل PIN الجديد"
                            dir="ltr"
                            className="bg-white/5 border border-white/10 h-10 text-sm text-center tracking-widest font-mono rounded-lg"
                          />
                          {newPinInput.length > 0 && newPinInput.length < 4 && (
                            <p className="text-[10px] text-red-400">4 أرقام على الأقل</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => { setShowChangePin(false); setCurrentPinInput(''); setNewPinInput('') }}
                          variant="outline"
                          className="flex-1 h-9 text-xs rounded-lg border-white/10 text-muted-foreground hover:text-white hover:bg-white/10"
                        >
                          إلغاء
                        </Button>
                        <Button
                          onClick={handleChangePin}
                          disabled={changingPin || !currentPinInput || currentPinInput.length < 4 || !newPinInput || newPinInput.length < 4}
                          className="flex-1 h-9 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg disabled:opacity-40 text-xs font-bold"
                        >
                          {changingPin ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          <span className="mr-1">{changingPin ? 'جارٍ الحفظ...' : 'حفظ PIN'}</span>
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        سيتم حفظ رمز PIN الجديد بشكل دائم في قاعدة البيانات
                      </p>
                    </div>
                  )}

                  {/* Service Account Key */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-amber-400" />
                      مفتاح Service Account (JSON)
                    </Label>
                    <div className="relative">
                      <textarea
                        value={serviceAccountKey}
                        onChange={e => { setServiceAccountKey(e.target.value); setTestResult(null) }}
                        placeholder='{"type": "service_account", ...}'
                        dir="ltr"
                        rows={4}
                        className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      <button onClick={handlePaste}
                        className="absolute top-2 left-2 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] text-amber-400">
                        لصق
                      </button>
                    </div>
                  </div>

                  {/* Test Result */}
                  {testResult && (
                    <div className={`p-3 rounded-lg border ${testResult.success ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                        <span className={`text-xs font-bold ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                          {testResult.success ? 'اتصال ناجح ✓' : 'فشل ✗'}
                        </span>
                      </div>
                      {testResult.success && (
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className="font-mono text-green-400/70" dir="ltr">{testResult.projectId}</span>
                          <span className="text-muted-foreground">{testResult.totalUsers} مستخدم</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Test Button */}
                  <Button onClick={handleTest} disabled={testing || !serviceAccountKey.trim()}
                    className="w-full h-10 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-40">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    <span className="text-xs font-medium mr-2">{testing ? 'جارٍ الاختبار...' : '1️⃣ اختبار الاتصال بقاعدة البيانات'}</span>
                  </Button>

                  {/* google-services.json — Required for push notifications */}
                  {testResult?.success && (
                    <div className="space-y-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                      <h4 className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                        <MonitorSmartphone className="w-3.5 h-3.5" />
                        ملف الإشعارات (google-services.json) <span className="text-red-400">*</span>
                      </h4>
                      <div className="space-y-2">
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/10">
                          <p className="text-[10px] text-purple-300 leading-relaxed">
                            📱 لتفعيل الإشعارات الصوتية في التطبيق، أنشئ تطبيق Android في مشروع Firebase الجديد ثم انسخ ملف google-services.json والصقه هنا.
                          </p>
                          <div className="mt-2 space-y-1 text-[9px] text-purple-400/70">
                            <p className="font-bold">الخطوات:</p>
                            <p>1. من Firebase Console → إعدادات المشروع → عام</p>
                            <p>2. اضغط &quot;إضافة تطبيق&quot; → اختر Android</p>
                            <p>3. أدخل حزمة التطبيق: <span className="font-mono text-purple-300" dir="ltr">com.forexyemeni.wallet</span></p>
                            <p>4. حمّل ملف google-services.json</p>
                            <p>5. انسخ محتوى الملف والصقه هنا ↓</p>
                          </div>
                        </div>

                        <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <FileJson className="w-3 h-3 text-purple-400" />
                          محتوى google-services.json
                        </Label>
                        <div className="relative">
                          <textarea
                            value={googleServicesJson}
                            onChange={e => handleGoogleServicesChange(e.target.value)}
                            placeholder={'{\n  "project_info": {\n    "project_id": "...",\n  },\n  "client": [...]\n}'}
                            dir="ltr"
                            rows={4}
                            className={`w-full rounded-lg bg-white/5 border p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 ${
                              gsjValid === true
                                ? 'border-green-500/50 focus:ring-green-500/50'
                                : gsjValid === false
                                  ? 'border-red-500/50 focus:ring-red-500/50'
                                  : 'border-white/10 focus:ring-purple-500/50'
                            }`}
                          />
                          <button onClick={handlePasteGsj}
                            className="absolute top-2 left-2 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] text-purple-400 flex items-center gap-1">
                            <Clipboard className="w-3 h-3" />
                            لصق
                          </button>
                        </div>

                        {/* Validation status */}
                        {gsjValid === true && (
                          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-green-500/5 border border-green-500/10">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            <span className="text-[10px] text-green-400 font-mono" dir="ltr">{gsjProjectId}</span>
                            {testResult?.projectId && gsjProjectId === testResult.projectId && (
                              <span className="text-[10px] text-green-400">— مطابق ✓</span>
                            )}
                            {testResult?.projectId && gsjProjectId !== testResult.projectId && (
                              <span className="text-[10px] text-red-400">— غير مطابق ✗</span>
                            )}
                          </div>
                        )}
                        {gsjValid === false && (
                          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-red-500/5 border border-red-500/10">
                            <XCircle className="w-3 h-3 text-red-400" />
                            <span className="text-[10px] text-red-400">ملف غير صالح — تأكد من نسخ الملف كاملاً</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Admin Credentials */}
                  {testResult?.success && (
                    <div className="space-y-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        بيانات المسؤول الجديدة
                      </h4>

                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3 text-amber-400" />
                            البريد الإلكتروني <span className="text-red-400">*</span>
                          </Label>
                          <Input type="email"
                            value={adminEmail}
                            onChange={e => setAdminEmail(e.target.value)}
                            placeholder="admin@example.com"
                            dir="ltr"
                            className="bg-white/5 border border-white/10 h-10 text-sm rounded-lg"
                          />
                          {adminEmail && !isValidEmail(adminEmail) && (
                            <p className="text-[10px] text-red-400">بريد غير صحيح</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-400" />
                            كلمة المرور <span className="text-red-400">*</span>
                          </Label>
                          <div className="relative">
                            <Input type={showPassword ? 'text' : 'password'}
                              value={adminPassword}
                              onChange={e => setAdminPassword(e.target.value)}
                              placeholder="6 أحرف على الأقل"
                              className="bg-white/5 border border-white/10 h-10 text-sm pl-10 rounded-lg"
                              dir="ltr"
                            />
                            <button onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-amber-400">
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {adminPassword.length > 0 && adminPassword.length < 6 && (
                            <p className="text-[10px] text-red-400">6 أحرف على الأقل</p>
                          )}
                        </div>

                        {testResult.adminExists && adminEmail && isValidEmail(adminEmail) && (
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/10">
                            <p className="text-[10px] text-amber-400">⚠️ هذا البريد موجود مسبقاً — سيتم تحديث كلمة المرور فقط</p>
                          </div>
                        )}
                      </div>

                      <Button onClick={handleSave}
                        disabled={saving || !isValidEmail(adminEmail) || adminPassword.length < 6 || gsjValid !== true}
                        className="w-full h-10 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg disabled:opacity-40">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        <span className="text-xs font-bold mr-2">
                          {saving ? 'جارٍ الحفظ...' : '✅ حفظ وتفعيل القاعدة الجديدة'}
                        </span>
                      </Button>
                    </div>
                  )}

                  {/* Warning */}
                  <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-red-400/80 leading-relaxed">
                        ⚠️ هذه اللوحة سرية — فقط صاحب التطبيق يستطيع الوصول إليها
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* =================== FCM NOTIFICATIONS TAB =================== */}
              {activeTab === 'fcm' && (
                <>
                  {/* FCM Status Card */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <h4 className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5" />
                      حالة الإشعارات الصوتية
                    </h4>

                    {fcmLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-green-400" />
                      </div>
                    ) : fcmDiagnostics ? (
                      <div className="space-y-2.5">
                        {/* Connection Status */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">اتصال FCM</span>
                          <span className={`text-[11px] font-bold flex items-center gap-1 ${
                            fcmDiagnostics.firebaseMessaging?.includes('متصل') ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {fcmDiagnostics.firebaseMessaging?.includes('متصل')
                              ? <><CheckCircle className="w-3 h-3" /> متصل</>
                              : <><XCircle className="w-3 h-3" /> غير متصل</>
                            }
                          </span>
                        </div>

                        {/* Project */}
                        {fcmDiagnostics.projectId && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">المشروع</span>
                            <span className="text-[11px] font-mono text-blue-400" dir="ltr">{fcmDiagnostics.projectId}</span>
                          </div>
                        )}

                        {/* Token Stats */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="text-center p-2 rounded-lg bg-white/5">
                            <div className="text-lg font-bold text-green-400">{fcmDiagnostics.totalTokens || 0}</div>
                            <div className="text-[9px] text-muted-foreground">توكنات</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-white/5">
                            <div className="text-lg font-bold text-blue-400">{fcmDiagnostics.uniqueUsersWithTokens || 0}</div>
                            <div className="text-[9px] text-muted-foreground">مستخدمين</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-white/5">
                            <div className="text-lg font-bold text-amber-400">{fcmDiagnostics.adminTokenCount || 0}</div>
                            <div className="text-[9px] text-muted-foreground">أجهزة إدارة</div>
                          </div>
                        </div>

                        {/* Tokens List (collapsible) */}
                        {fcmDiagnostics.tokens && fcmDiagnostics.tokens.length > 0 && (
                          <div className="space-y-1">
                            <button
                              onClick={() => setShowFcmTokens(!showFcmTokens)}
                              className="flex items-center justify-between w-full text-[10px] text-muted-foreground hover:text-white py-1"
                            >
                              <span>الأجهزة المسجلة</span>
                              {showFcmTokens ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {showFcmTokens && (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {fcmDiagnostics.tokens.map((t, i) => (
                                  <div key={i} className="flex items-center justify-between p-1.5 rounded-md bg-white/5 text-[9px]" dir="ltr">
                                    <div className="flex items-center gap-1.5">
                                      <Smartphone className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-muted-foreground font-mono truncate max-w-[150px]">{t.token}</span>
                                    </div>
                                    <span className="text-muted-foreground">{t.deviceName || '—'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {fcmDiagnostics.error && (
                          <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                            <p className="text-[10px] text-red-400">خطأ: {fcmDiagnostics.error}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">اضغط تحديث لفحص حالة الإشعارات</p>
                    )}

                    {/* Refresh Button */}
                    <Button
                      onClick={fetchFcmStatus}
                      disabled={fcmLoading}
                      className="w-full h-8 bg-white/5 hover:bg-white/10 text-white rounded-lg disabled:opacity-40"
                    >
                      {fcmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      <span className="text-[10px] mr-1.5">{fcmLoading ? 'جارٍ الفحص...' : 'تحديث حالة FCM'}</span>
                    </Button>
                  </div>

                  {/* Test Notification */}
                  <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20 space-y-3">
                    <h4 className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5" />
                      اختبار التنبيه الصوتي
                    </h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      إرسال إشعار اختباري صوتي لجميع الأجهزة المسجلة للتأكد من عمل التنبيهات بشكل صحيح بعد تغيير قاعدة البيانات.
                    </p>

                    {/* FCM Test Result */}
                    {fcmTestResult && (
                      <div className={`p-2.5 rounded-lg border ${
                        fcmTestResult.success
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-red-500/10 border-red-500/20'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          {fcmTestResult.success
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            : <XCircle className="w-3.5 h-3.5 text-red-400" />
                          }
                          <span className={`text-[11px] font-bold ${
                            fcmTestResult.success ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {fcmTestResult.message}
                          </span>
                        </div>
                        {fcmTestResult.successCount !== undefined && (
                          <div className="mt-1.5 flex gap-3 text-[10px] text-muted-foreground">
                            <span>✓ {fcmTestResult.successCount} تم</span>
                            {(fcmTestResult.failureCount ?? 0) > 0 && (
                              <span>✗ {fcmTestResult.failureCount ?? 0} فشل</span>
                            )}
                          </div>
                        )}
                        {/* Show errors if any */}
                        {fcmTestResult.errors && fcmTestResult.errors.length > 0 && (
                          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                            {fcmTestResult.errors.map((err, i) => (
                              <div key={i} className="text-[9px] text-red-400/80 font-mono" dir="ltr">
                                {err.code}: {err.message?.substring(0, 60)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={handleFcmTest}
                      disabled={fcmTesting || !fcmDiagnostics}
                      className="w-full h-10 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg disabled:opacity-40"
                    >
                      {fcmTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                      <span className="text-xs font-bold mr-2">{fcmTesting ? 'جارٍ الإرسال...' : '🔔 إرسال إشعار اختباري صوتي'}</span>
                    </Button>
                  </div>

                  {/* Cleanup Invalid Tokens */}
                  {fcmDiagnostics && (fcmDiagnostics.totalTokens ?? 0) > 0 && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <h4 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                        تنظيف التوكنات القديمة
                      </h4>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        عند تغيير قاعدة بيانات Firebase، التوكنات القديمة من المشروع السابق تصبح غير صالحة. هذا الزر يزيلها تلقائياً.
                      </p>

                      {fcmCleanupResult && (
                        <div className={`p-2 rounded-lg ${
                          fcmCleanupResult.success ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          <span className={`text-[10px] ${fcmCleanupResult.success ? 'text-green-400' : 'text-red-400'}`}>
                            {fcmCleanupResult.message}
                          </span>
                        </div>
                      )}

                      <Button
                        onClick={handleFcmCleanup}
                        disabled={fcmCleaning}
                        variant="outline"
                        className="w-full h-8 border-orange-500/20 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 rounded-lg disabled:opacity-40"
                      >
                        {fcmCleaning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        <span className="text-[10px] mr-1.5">{fcmCleaning ? 'جارٍ التنظيف...' : 'تنظيف التوكنات غير الصالحة'}</span>
                      </Button>
                    </div>
                  )}

                  {/* Send Custom Notification */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <button
                      onClick={() => setShowFcmSendForm(!showFcmSendForm)}
                      className="w-full flex items-center justify-between"
                    >
                      <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" />
                        إرسال إشعار مخصص
                      </h4>
                      {showFcmSendForm ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>

                    {showFcmSendForm && (
                      <div className="space-y-2 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">معرف المستخدم (userId)</Label>
                          <Input
                            value={fcmSendUserId}
                            onChange={e => setFcmSendUserId(e.target.value)}
                            placeholder="admin_xxxx أو أي معرف مستخدم"
                            dir="ltr"
                            className="bg-white/5 border border-white/10 h-9 text-xs rounded-lg font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">عنوان الإشعار (اختياري)</Label>
                          <Input
                            value={fcmSendTitle}
                            onChange={e => setFcmSendTitle(e.target.value)}
                            placeholder="عنوان الإشعار"
                            className="bg-white/5 border border-white/10 h-9 text-xs rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">نص الإشعار</Label>
                          <textarea
                            value={fcmSendMessage}
                            onChange={e => setFcmSendMessage(e.target.value)}
                            placeholder="اكتب نص الإشعار هنا..."
                            rows={2}
                            className="w-full rounded-lg bg-white/5 border border-white/10 p-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                          />
                        </div>
                        <Button
                          onClick={handleFcmSend}
                          disabled={fcmSending || !fcmSendUserId.trim() || !fcmSendMessage.trim()}
                          className="w-full h-9 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg disabled:opacity-40"
                        >
                          {fcmSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          <span className="text-[10px] font-bold mr-1.5">{fcmSending ? 'جارٍ الإرسال...' : 'إرسال الإشعار'}</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* FCM Info Note */}
                  <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <div className="flex items-start gap-2">
                      <Bell className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-[10px] text-blue-400/80 leading-relaxed space-y-1">
                        <p>📡 الإشعارات تعمل عبر نفس مفتاح Service Account — عند تغيير قاعدة البيانات، يمكنك اختبار الإشعارات من هنا للتأكد من عملها.</p>
                        <p>📱 بعد تغيير المشروع، يجب على المستخدمين فتح التطبيق مجدداً لتسجيل أجهزتهم في المشروع الجديد.</p>
                        <p>🗑️ استخدم &quot;تنظيف التوكنات&quot; لإزالة الأجهزة القديمة من المشروع السابق.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS */}
      <style jsx global>{`
        @keyframes srfadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes srdotPop {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes srshake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px) rotate(-2deg); }
          30% { transform: translateX(8px) rotate(2deg); }
          45% { transform: translateX(-6px) rotate(-1deg); }
          60% { transform: translateX(6px) rotate(1deg); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
        .sr-shake {
          animation: srshake 0.5s ease-in-out;
        }
      `}</style>
    </>
  )
}
