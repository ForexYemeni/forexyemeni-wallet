'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Shield,
  Phone,
  Camera,
  UserCheck,
  Loader2,
  Check,
  X,
  ChevronLeft,
  CheckCircle2,
  FileText,
  BadgeCheck,
  CheckCircle,
  Sun,
  Clock,
  ChevronDown,
} from 'lucide-react'
import { compressImage } from '@/lib/image-compress'
import EnhancedUploadZone from '@/components/ui/EnhancedUploadZone'
import SuccessResult from '@/components/ui/SuccessResult'

type KycStep = 'phone' | 'verify' | 'upload' | 'done'

const KYC_STEPS = [
  { key: 'phone', label: 'الهاتف', icon: Phone },
  { key: 'verify', label: 'التحقق', icon: UserCheck },
  { key: 'upload', label: 'المستندات', icon: Camera },
]

const COUNTRIES = [
  { code: 'YE', dial: '967', flag: '🇾🇪' },
  { code: 'SA', dial: '966', flag: '🇸🇦' },
  { code: 'AE', dial: '971', flag: '🇦🇪' },
  { code: 'EG', dial: '20', flag: '🇪🇬' },
]

const DOCUMENT_TIPS = [
  { icon: CheckCircle, text: 'تأكد من وضوح نص البطاقة الأمامية والخلفية' },
  { icon: Camera, text: 'يجب رفع الوجه الأمامي والخلفي للبطاقة' },
  { icon: Sun, text: 'ارفع صوراً بإضاءة جيدة وخالية من الظل' },
]

function KYCProgressRing({ status }: { status: string }) {
  const config: Record<string, { percent: number; color: string }> = {
    none: { percent: 0, color: '#EF4444' },
    pending: { percent: 50, color: '#F59E0B' },
    rejected: { percent: 33, color: '#EF4444' },
    approved: { percent: 100, color: '#22C55E' },
  }
  const { percent, color } = config[status] || config.none
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="flex-shrink-0">
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-white/10"
      />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 24 24)"
        className="transition-all duration-700"
      />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="11"
        fontWeight="bold"
      >
        {percent}%
      </text>
    </svg>
  )
}

export default function KYCVerification() {
  const { user, updateUser, setScreen } = useAuthStore()
  const [step, setStep] = useState<KycStep>(
    user?.phoneVerified ? 'upload' : 'phone'
  )
  const [phone, setPhone] = useState(user?.phone || '')
  const [country, setCountry] = useState(user?.country || 'YE')
  const [loading, setLoading] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [idPhoto, setIdPhoto] = useState<File | null>(null)
  const [idBack, setIdBack] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})
  const [uploadingFile, setUploadingFile] = useState<string | null>(null)

  const selectedCountry = COUNTRIES.find(c => c.code === country) || COUNTRIES[0]

  const handleSubmitPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone) {
      toast.error('يرجى إدخال رقم الهاتف')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch('/api/kyc/submit-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, phone, country }),
      })
      const data = await res.json()
      if (data.success) {
        setStep('verify')
        if (data.otp) {
          toast.info(`رمز التحقق: ${data.otp}`, { duration: 10000 })
        }
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyPhone = async () => {
    if (otp.some(d => !d)) {
      toast.error('يرجى إدخال رمز التحقق كاملاً')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch('/api/kyc/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, code: otp.join('') }),
      })
      const data = await res.json()
      if (data.success) {
        updateUser({ phoneVerified: true, phone, kycStatus: 'pending' })
        setStep('upload')
        toast.success('تم التحقق من رقم الهاتف بنجاح')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (type: 'id_photo' | 'id_back', file: File) => {
    const compressed = await compressImage(file)
    if (type === 'id_photo') {
      setIdPhoto(compressed)
      const reader = new FileReader()
      reader.onload = (e) => setIdPreview(e.target?.result as string)
      reader.readAsDataURL(compressed)
    } else {
      setIdBack(compressed)
      const reader = new FileReader()
      reader.onload = (e) => setIdBackPreview(e.target?.result as string)
      reader.readAsDataURL(compressed)
    }
  }

  const handleUpload = async (type: 'id_photo' | 'id_back') => {
    const file = type === 'id_photo' ? idPhoto : idBack
    if (!file) return

    setUploadingFile(type)
    setUploadProgress(prev => ({ ...prev, [type]: 0 }))
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('userId', user?.id || '')
      formData.append('type', type)
      formData.append('file', file)

      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[type] || 0
          if (current >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return { ...prev, [type]: current + Math.random() * 15 }
        })
      }, 200)

      const res = await apiFetch('/api/kyc/upload', {
        method: 'POST',
        body: formData,
      })
      clearInterval(progressInterval)

      const data = await res.json()
      if (data.success) {
        setUploadProgress(prev => ({ ...prev, [type]: 100 }))
        toast.success('تم رفع الملف بنجاح')
        setTimeout(() => {
          setUploadProgress(prev => ({ ...prev, [type]: -1 }))
        }, 500)
      } else {
        toast.error(data.message)
        setUploadProgress(prev => ({ ...prev, [type]: -1 }))
      }
    } catch {
      toast.error('حدث خطأ في رفع الملف')
      setUploadProgress(prev => ({ ...prev, [type]: -1 }))
    } finally {
      setLoading(false)
      setUploadingFile(null)
    }
  }

  const handleChangeOtp = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      document.getElementById(`kyc-otp-${index + 1}`)?.focus()
    }
  }

  const handleKeyDownOtp = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`kyc-otp-${index - 1}`)?.focus()
    }
    if (e.key === 'Enter' && otp.every(d => d)) {
      handleVerifyPhone()
    }
  }

  const getStepIndex = () => {
    switch (step) {
      case 'phone': return 0
      case 'verify': return 1
      case 'upload': return 2
      case 'done': return 3
      default: return 0
    }
  }

  const resetUploadState = () => {
    setIdPhoto(null)
    setIdBack(null)
    setIdPreview(null)
    setIdBackPreview(null)
  }

  const kycStatus = user?.kycStatus || 'none'
  const documentsCompleted = !!(user?.kycIdPhoto && user?.kycSelfie)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStep(step === 'verify' ? 'phone' : step === 'upload' ? 'verify' : 'phone')}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors haptic-btn"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center gold-glow">
            <Shield className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold">التحقق من الهوية</h1>
            <p className="text-xs text-muted-foreground">خطوات بسيطة لتفعيل حسابك بالكامل</p>
          </div>
        </div>
      </div>

      {/* Status Badge with Progress Ring */}
      <div className="flex items-center gap-3">
        <KYCProgressRing status={kycStatus} />
        <div>
          {user?.kycStatus === 'approved' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <BadgeCheck className="w-4 h-4 text-green-400" />
              <span className="text-xs font-bold text-green-400">حساب موثق بالكامل</span>
            </div>
          ) : user?.kycStatus === 'pending' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <FileText className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-400">قيد المراجعة</span>
            </div>
          ) : user?.kycStatus === 'rejected' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
              <X className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold text-red-400">مرفوض — إعادة المحاولة</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">غير مفعّل</span>
            </div>
          )}
        </div>
      </div>

      {/* Step Progress Bar */}
      <div className="step-progress-bar">
        {KYC_STEPS.map((s, i) => {
          const currentIdx = getStepIndex()
          const isCompleted = i < currentIdx || step === 'done'
          const isActive = i === currentIdx
          return (
            <div key={s.key} className="flex items-center">
              <div className="step-progress-item">
                <div className={`step-progress-circle ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className={`step-progress-label ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}>
                  {s.label}
                </span>
              </div>
              {i < KYC_STEPS.length - 1 && (
                <div className={`step-progress-connector ${isCompleted ? 'filled' : isActive ? 'current' : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* ===== STEP 1: Phone ===== */}
      {step === 'phone' && (
        <form onSubmit={handleSubmitPhone} className="glass-card p-5 space-y-4 animate-fade-in">
          <div className="info-banner-gold p-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-gold flex-shrink-0" />
            <p className="text-xs text-muted-foreground">سيتم إرسال رمز التحقق إلى بريدك الإلكتروني للتأكد من هويتك</p>
          </div>

          <div className="float-label-group">
            <input
              type="text"
              placeholder=" "
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="float-label-input pl-24"
              dir="ltr"
              autoComplete="tel"
            />
            <label className="float-label active">رقم الهاتف</label>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <span className="text-sm">{selectedCountry.flag}</span>
                  <span className="text-muted-foreground">{selectedCountry.dial}+</span>
                  <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showCountryDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowCountryDropdown(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden min-w-[140px] animate-fade-in">
                      {COUNTRIES.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => { setCountry(c.code); setShowCountryDropdown(false) }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/10 transition-colors ${
                            country === c.code ? 'bg-white/5 text-gold' : 'text-foreground'
                          }`}
                        >
                          <span className="text-sm">{c.flag}</span>
                          <span>{c.dial}+</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow haptic-btn"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال رمز التحقق'}
          </Button>
        </form>
      )}

      {/* ===== STEP 2: Verify OTP ===== */}
      {step === 'verify' && (
        <div className="glass-card p-5 space-y-5 animate-fade-in">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gold/10 flex items-center justify-center gold-glow">
              <UserCheck className="w-8 h-8 text-gold" />
            </div>
            <div>
              <h2 className="text-base font-bold">أدخل رمز التحقق</h2>
              <p className="text-sm text-muted-foreground mt-1">تم إرسال الرمز إلى بريدك الإلكتروني</p>
            </div>
          </div>

          {/* OTP Expiration Info Banner */}
          <div className="info-banner-blue p-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">الرمز صالح لمدة 5 دقائق</p>
          </div>

          <div className="flex justify-center gap-3 py-2" dir="ltr">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`kyc-otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChangeOtp(index, e.target.value)}
                onKeyDown={(e) => handleKeyDownOtp(index, e)}
                className="otp-input-custom"
              />
            ))}
          </div>

          <Button
            onClick={handleVerifyPhone}
            disabled={loading || otp.some(d => !d)}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow haptic-btn"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق من الرقم'}
          </Button>
        </div>
      )}

      {/* ===== STEP 3: Upload Documents ===== */}
      {step === 'upload' && (
        <div className="space-y-4 animate-fade-in">
          {/* Upload Info Banner */}
          <div className="info-banner-blue p-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">ارفع صورتين واضحتين لاستكمال عملية التحقق من الهوية</p>
          </div>

          {/* Document Tips Section */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold" />
              نصائح لرفع المستندات
            </h3>
            <div className="space-y-2.5">
              {DOCUMENT_TIPS.map((tip, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <tip.icon className="w-3.5 h-3.5 text-gold" />
                  </div>
                  <span className="text-xs text-muted-foreground leading-relaxed">{tip.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ID Photo */}
          <div className="glass-card p-5 space-y-3 section-card gold-accent">
            <div className="flex items-center justify-between pr-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">صورة بطاقة الهوية</h3>
                  <p className="text-[10px] text-muted-foreground">JPG أو PNG — واضحة ومقروءة</p>
                </div>
              </div>
              {idPhoto && (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                  <Check className="w-3 h-3" /> جاهز
                </span>
              )}
            </div>

            {!user?.kycIdPhoto && (
              <EnhancedUploadZone
                onFile={(file) => handleFileChange('id_photo', file)}
                preview={idPreview}
                onClear={() => { setIdPhoto(null); setIdPreview(null) }}
                maxSize={5 * 1024 * 1024}
                accept="image/*"
                compact={false}
              />
            )}

            {uploadProgress['id_photo'] !== undefined && uploadProgress['id_photo'] >= 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    {uploadProgress['id_photo'] >= 100 ? 'تم الرفع بنجاح' : uploadProgress['id_photo'] > 0 ? 'جاري الرفع...' : ''}
                  </span>
                  {uploadProgress['id_photo'] > 0 && (
                    <span className="text-[10px] text-gold font-medium">{Math.round(uploadProgress['id_photo'])}%</span>
                  )}
                </div>
                <div className="upload-progress-bar">
                  <div className="upload-progress-fill" style={{ width: `${Math.min(uploadProgress['id_photo'], 100)}%` }} />
                </div>
              </div>
            )}

            {idPhoto && !user?.kycIdPhoto && (
              <Button
                onClick={() => handleUpload('id_photo')}
                disabled={loading}
                className="w-full h-11 gold-gradient text-gray-900 font-bold text-sm rounded-xl hover:opacity-90 haptic-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'رفع صورة الهوية'}
              </Button>
            )}
            {user?.kycIdPhoto && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">تم رفع صورة الهوية مسبقاً</span>
              </div>
            )}
          </div>

          {/* ID Back Photo */}
          <div className="glass-card p-5 space-y-3 section-card green-accent">
            <div className="flex items-center justify-between pr-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">ظهر بطاقة الهوية</h3>
                  <p className="text-[10px] text-muted-foreground">صورة واضحة للوجه الخلفي للبطاقة</p>
                </div>
              </div>
              {idBack && (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                  <Check className="w-3 h-3" /> جاهز
                </span>
              )}
            </div>

            {!user?.kycSelfie && (
              <EnhancedUploadZone
                onFile={(file) => handleFileChange('id_back', file)}
                preview={idBackPreview}
                onClear={() => { setIdBack(null); setIdBackPreview(null) }}
                maxSize={5 * 1024 * 1024}
                accept="image/*"
                compact={false}
              />
            )}

            {uploadProgress['id_back'] !== undefined && uploadProgress['id_back'] >= 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    {uploadProgress['id_back'] >= 100 ? 'تم الرفع بنجاح' : uploadProgress['id_back'] > 0 ? 'جاري الرفع...' : ''}
                  </span>
                  {uploadProgress['id_back'] > 0 && (
                    <span className="text-[10px] text-gold font-medium">{Math.round(uploadProgress['id_back'])}%</span>
                  )}
                </div>
                <div className="upload-progress-bar">
                  <div className="upload-progress-fill" style={{ width: `${Math.min(uploadProgress['id_back'], 100)}%` }} />
                </div>
              </div>
            )}

            {idBack && !user?.kycSelfie && (
              <Button
                onClick={() => handleUpload('id_back')}
                disabled={loading}
                className="w-full h-11 gold-gradient text-gray-900 font-bold text-sm rounded-xl hover:opacity-90 haptic-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'رفع ظهر الهوية'}
              </Button>
            )}
            {user?.kycSelfie && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">تم رفع ظهر الهوية مسبقاً</span>
              </div>
            )}
          </div>

          {/* Verification Complete — SuccessResult */}
          {documentsCompleted ? (
            <div className="glass-card p-4">
              <SuccessResult
                type="success"
                title="تم إرسال المستندات بنجاح"
                message="سيتم مراجعة مستنداتك وإشعارك بالنتيجة عبر الإشعارات"
                actionLabel="العودة للرئيسية"
                onAction={() => setScreen('dashboard')}
                secondaryLabel="رفع مستندات أخرى"
                onSecondary={resetUploadState}
              />
            </div>
          ) : (idPhoto || user?.kycIdPhoto) && (idBack || user?.kycSelfie) ? (
            <div className="glass-card p-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-green-500/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                تم إرسال مستنداتك للمراجعة. سيتم إشعارك بالنتيجة عبر الإشعارات.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
