'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  X, Eye, EyeOff, Loader2, CheckCircle, XCircle,
  Database, KeyRound, Mail, Lock, Link2, AlertTriangle,
  ShieldCheck, RefreshCw
} from 'lucide-react'

type Step = 'closed' | 'pin' | 'main'

interface TestResult {
  success: boolean
  message: string
  projectId?: string
  totalUsers?: number
  adminExists?: boolean
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
      const res = await fetch('/api/emergency/recovery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin }),
      })
      const data = await res.json()

      if (data.success) {
        setStep('main')
        fetchStatus()
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
      const res = await fetch('/api/emergency/secret-recovery', {
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
      const res = await fetch('/api/emergency/secret-recovery', {
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

    if (!confirm('⚠️ تأكيد: سيتم تبديل قاعدة البيانات.\n\nتأكد من صحة البيانات قبل المتابعة.')) {
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/emergency/secret-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          serviceAccountKey: serviceAccountKey.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message, { duration: 8000 })
        setStep('closed')
        setServiceAccountKey('')
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
      const res = await fetch('/api/emergency/recovery-pin', {
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

  const handleClose = () => {
    setStep('closed')
    setTapCount(0)
    setShowChangePin(false)
    setCurrentPinInput('')
    setNewPinInput('')
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
                <h3 className="text-sm font-bold text-amber-400">🔒 استعادة قاعدة البيانات</h3>
              </div>
              <button onClick={handleClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
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
                <span className="text-xs font-medium mr-2">{testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}</span>
              </Button>

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
                    disabled={saving || !isValidEmail(adminEmail) || adminPassword.length < 6}
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
