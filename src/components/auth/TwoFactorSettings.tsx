'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Shield, ShieldCheck, ShieldOff, Key, Eye, EyeOff, Copy, Check, AlertTriangle, X, RefreshCw, Mail } from 'lucide-react'

interface TwoFactorSettingsProps {
  onClose: () => void
}

type Step = 'status' | 'verify_setup' | 'confirm_disable' | 'backup_codes' | 'regenerate_confirm' | 'regenerate'

export default function TwoFactorSettings({ onClose }: TwoFactorSettingsProps) {
  const { user, updateUser } = useAuthStore()
  const [step, setStep] = useState<Step>('status')
  const [loading, setLoading] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false)

  // Setup verification
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Disable confirmation
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Regenerate
  const [regenPassword, setRegenPassword] = useState('')
  const [showRegenPassword, setShowRegenPassword] = useState(false)

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (step === 'verify_setup') {
      inputRefs.current[0]?.focus()
    }
  }, [step])

  const handleCodeChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split('')
      const newCode = [...code]
      pasted.forEach((char, i) => {
        if (index + i < 6) newCode[index + i] = char
      })
      setCode(newCode)
      const nextIndex = Math.min(index + pasted.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [code])

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // === ENABLE 2FA ===
  const handleEnable = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          action: 'enable',
          token: useAuthStore.getState().token,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إرسال رمز التحقق إلى بريدك الإلكتروني')
        setStep('verify_setup')
        setCode(['', '', '', '', '', ''])
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  // === VERIFY SETUP ===
  const handleVerifySetup = async () => {
    const codeStr = code.join('')
    if (codeStr.length !== 6) {
      toast.error('يرجى إدخال الرمز كاملاً')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          action: 'verify_setup',
          code: codeStr,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBackupCodes(data.backupCodes)
        setTwoFactorEnabled(true)
        updateUser({ twoFactorEnabled: true })
        setStep('backup_codes')
        toast.success('تم تفعيل المصادقة الثنائية بنجاح!')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  // === DISABLE 2FA ===
  const handleDisable = async () => {
    if (!password) {
      toast.error('يرجى إدخال كلمة المرور')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          action: 'disable',
          password,
          token: useAuthStore.getState().token,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTwoFactorEnabled(false)
        updateUser({ twoFactorEnabled: false })
        setPassword('')
        setStep('status')
        toast.success('تم تعطيل المصادقة الثنائية')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  // === REGENERATE BACKUP CODES ===
  const handleRegenerate = async () => {
    if (!regenPassword) {
      toast.error('يرجى إدخال كلمة المرور')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          action: 'regenerate_backup',
          password: regenPassword,
          token: useAuthStore.getState().token,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBackupCodes(data.backupCodes)
        setRegenPassword('')
        setStep('backup_codes')
        toast.success('تم إعادة إنشاء أكواد الاسترداد')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const copyCode = (index: number, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    toast.success('تم النسخ')
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="glass-card p-5 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-gold" />
          </div>
          <h3 className="text-sm font-bold">المصادقة الثنائية</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* === STATUS VIEW === */}
      {step === 'status' && (
        <div className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-3">
              {twoFactorEnabled ? (
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <ShieldOff className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold">
                  {twoFactorEnabled ? 'المصادقة الثنائية مفعلة' : 'المصادقة الثنائية غير مفعلة'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {twoFactorEnabled
                    ? 'حسابك محمي بطبقة أمان إضافية'
                    : 'قم بتفعيل المصادقة لحماية حسابك'}
                </p>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              twoFactorEnabled
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-white/5 text-muted-foreground border border-white/10'
            }`}>
              {twoFactorEnabled ? 'مفعلة ✓' : 'غير مفعلة'}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            المصادقة الثنائية تضيف طبقة حماية إضافية لحسابك. عند تفعيلها، سيتم إرسال رمز تحقق إلى بريدك الإلكتروني في كل مرة تسجل الدخول.
          </p>

          {/* Actions */}
          {!twoFactorEnabled ? (
            <Button
              onClick={handleEnable}
              disabled={loading}
              className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  تفعيل المصادقة الثنائية
                </span>
              )}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={() => setStep('regenerate_confirm')}
                className="w-full h-11 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium rounded-xl transition-all border border-blue-500/20"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  إعادة إنشاء أكواد الاسترداد
                </span>
              </Button>
              <Button
                onClick={() => setStep('confirm_disable')}
                className="w-full h-11 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl transition-all border border-red-500/20"
              >
                <span className="flex items-center gap-2">
                  <ShieldOff className="w-4 h-4" />
                  تعطيل المصادقة الثنائية
                </span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* === VERIFY SETUP VIEW === */}
      {step === 'verify_setup' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-blue-400">تم إرسال رمز التحقق إلى بريدك الإلكتروني. أدخل الرمز أدناه لتفعيل المصادقة الثنائية.</p>
          </div>

          <div className="flex justify-center gap-2" dir="ltr">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-10 h-12 text-center text-lg font-bold glass-input rounded-lg border-2 border-white/10 focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
                disabled={loading}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleVerifySetup}
              disabled={loading}
              className="flex-1 h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تحقق وتفعيل'}
            </Button>
            <Button
              onClick={() => setStep('status')}
              variant="outline"
              className="h-11 px-4 rounded-xl border-white/10"
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* === BACKUP CODES VIEW === */}
      {step === 'backup_codes' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <p className="text-xs text-yellow-400 font-medium">احفظ هذه الأكواد في مكان آمن. لن تظهر مرة أخرى!</p>
          </div>

          <div className="space-y-2">
            {backupCodes.map((bc, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 font-mono text-sm"
                dir="ltr"
              >
                <span className="text-gold font-bold tracking-wider">{bc}</span>
                <button
                  onClick={() => copyCode(index, bc)}
                  className="text-muted-foreground hover:text-gold transition-colors"
                >
                  {copiedIndex === index ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            كل كود يمكن استخدامه مرة واحدة فقط للدخول عند عدم توفر رمز البريد الإلكتروني
          </p>

          <Button
            onClick={() => setStep('status')}
            className="w-full h-11 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90"
          >
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              تم الحفظ
            </span>
          </Button>
        </div>
      )}

      {/* === CONFIRM DISABLE VIEW === */}
      {step === 'confirm_disable' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">سيتم تعطيل المصادقة الثنائية على حسابك. تأكد أنك تريد المتابعة.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">أدخل كلمة المرور للتأكيد</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input h-12 text-base pl-10"
                dir="ltr"
                placeholder="كلمة المرور"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleDisable}
              disabled={loading || !password}
              className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تعطيل المصادقة الثنائية'}
            </Button>
            <Button
              onClick={() => { setStep('status'); setPassword('') }}
              variant="outline"
              className="h-11 px-4 rounded-xl border-white/10"
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* === REGENERATE CONFIRM VIEW === */}
      {step === 'regenerate_confirm' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Key className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-blue-400">سيتم إنشاء أكواد استرداد جديدة وسيتم حذف الأكواد القديمة.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">أدخل كلمة المرور للتأكيد</Label>
            <div className="relative">
              <Input
                type={showRegenPassword ? 'text' : 'password'}
                value={regenPassword}
                onChange={(e) => setRegenPassword(e.target.value)}
                className="glass-input h-12 text-base pl-10"
                dir="ltr"
                placeholder="كلمة المرور"
              />
              <button
                type="button"
                onClick={() => setShowRegenPassword(!showRegenPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold"
              >
                {showRegenPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleRegenerate}
              disabled={loading || !regenPassword}
              className="flex-1 h-11 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  إعادة إنشاء الأكواد
                </span>
              )}
            </Button>
            <Button
              onClick={() => { setStep('status'); setRegenPassword('') }}
              variant="outline"
              className="h-11 px-4 rounded-xl border-white/10"
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
