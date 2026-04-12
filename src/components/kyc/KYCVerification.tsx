import { apiFetch } from '@/lib/api-client'
'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
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
  Upload,
  ChevronLeft,
  CheckCircle2,
  FileText,
  BadgeCheck,
} from 'lucide-react'
import { compressImage } from '@/lib/image-compress'

type KycStep = 'phone' | 'verify' | 'upload' | 'done'

const KYC_STEPS = [
  { key: 'phone', label: 'الهاتف', icon: Phone },
  { key: 'verify', label: 'التحقق', icon: UserCheck },
  { key: 'upload', label: 'المستندات', icon: Camera },
]

export default function KYCVerification() {
  const { user, updateUser } = useAuthStore()
  const [step, setStep] = useState<KycStep>(
    user?.phoneVerified ? 'upload' : 'phone'
  )
  const [phone, setPhone] = useState(user?.phone || '')
  const [country, setCountry] = useState(user?.country || 'YE')
  const [loading, setLoading] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [idPhoto, setIdPhoto] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [idDragOver, setIdDragOver] = useState(false)
  const [selfieDragOver, setSelfieDragOver] = useState(false)

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

  const handleFileChange = async (type: 'id_photo' | 'selfie', file: File) => {
    const compressed = await compressImage(file)
    if (type === 'id_photo') {
      setIdPhoto(compressed)
      const reader = new FileReader()
      reader.onload = (e) => setIdPreview(e.target?.result as string)
      reader.readAsDataURL(compressed)
    } else {
      setSelfie(compressed)
      const reader = new FileReader()
      reader.onload = (e) => setSelfiePreview(e.target?.result as string)
      reader.readAsDataURL(compressed)
    }
  }

  const handleUpload = async (type: 'id_photo' | 'selfie') => {
    const file = type === 'id_photo' ? idPhoto : selfie
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('userId', user?.id || '')
      formData.append('type', type)
      formData.append('file', file)

      const res = await apiFetch('/api/kyc/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم رفع الملف بنجاح')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في رفع الملف')
    } finally {
      setLoading(false)
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

  // Handle drag events
  const handleDragOver = (e: React.DragEvent, setDragOver: (v: boolean) => void) => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent, setDragOver: (v: boolean) => void) => {
    e.preventDefault()
    setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent, type: 'id_photo' | 'selfie', setDragOver: (v: boolean) => void) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFileChange(type, file)
    }
  }

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

      {/* Status Badge */}
      <div className="flex items-center gap-2">
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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="bg-transparent text-xs text-muted-foreground outline-none cursor-pointer"
              >
                <option value="YE">967+</option>
              </select>
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

          <div className="flex justify-center gap-2.5" dir="ltr">
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
          <div className="info-banner-blue p-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">ارفع صورتين واضحتين لاستكمال عملية التحقق من الهوية</p>
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

            {idPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gold/20 animate-fade-in">
                <img src={idPreview} alt="ID" className="w-full h-48 object-cover" />
                <button
                  onClick={() => { setIdPhoto(null); setIdPreview(null) }}
                  className="absolute top-2 left-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 right-2 bg-green-500/90 px-2 py-1 rounded-lg flex items-center gap-1 text-xs text-white font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  تم الرفع
                </div>
              </div>
            ) : (
              <label
                className={`upload-zone h-32 ${idDragOver ? 'dragover' : 'upload-zone-hint'}`}
                onDragOver={(e) => handleDragOver(e, setIdDragOver)}
                onDragLeave={(e) => handleDragLeave(e, setIdDragOver)}
                onDrop={(e) => handleDrop(e, 'id_photo', setIdDragOver)}
              >
                <Upload className="w-8 h-8 text-gold/50 mb-2 relative z-10" />
                <span className="text-xs text-muted-foreground relative z-10">اضغط أو اسحب الصورة هنا</span>
                <span className="text-[10px] text-muted-foreground/50 mt-1 relative z-10">JPG, PNG حتى 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange('id_photo', e.target.files[0])}
                />
              </label>
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

          {/* Selfie */}
          <div className="glass-card p-5 space-y-3 section-card green-accent">
            <div className="flex items-center justify-between pr-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">صورة شخصية (سيلفي)</h3>
                  <p className="text-[10px] text-muted-foreground">صورة واضحة لوجهك مع البطاقة</p>
                </div>
              </div>
              {selfie && (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                  <Check className="w-3 h-3" /> جاهز
                </span>
              )}
            </div>

            {selfiePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-green-500/20 animate-fade-in">
                <img src={selfiePreview} alt="Selfie" className="w-full h-48 object-cover" />
                <button
                  onClick={() => { setSelfie(null); setSelfiePreview(null) }}
                  className="absolute top-2 left-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 right-2 bg-green-500/90 px-2 py-1 rounded-lg flex items-center gap-1 text-xs text-white font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  تم الرفع
                </div>
              </div>
            ) : (
              <label
                className={`upload-zone h-32 ${selfieDragOver ? 'dragover' : 'upload-zone-hint'}`}
                onDragOver={(e) => handleDragOver(e, setSelfieDragOver)}
                onDragLeave={(e) => handleDragLeave(e, setSelfieDragOver)}
                onDrop={(e) => handleDrop(e, 'selfie', setSelfieDragOver)}
              >
                <Upload className="w-8 h-8 text-green-400/50 mb-2 relative z-10" />
                <span className="text-xs text-muted-foreground relative z-10">اضغط أو اسحب الصورة هنا</span>
                <span className="text-[10px] text-muted-foreground/50 mt-1 relative z-10">JPG, PNG حتى 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange('selfie', e.target.files[0])}
                />
              </label>
            )}

            {selfie && !user?.kycSelfie && (
              <Button
                onClick={() => handleUpload('selfie')}
                disabled={loading}
                className="w-full h-11 gold-gradient text-gray-900 font-bold text-sm rounded-xl hover:opacity-90 haptic-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'رفع الصورة الشخصية'}
              </Button>
            )}
            {user?.kycSelfie && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">تم رفع الصورة الشخصية مسبقاً</span>
              </div>
            )}
          </div>

          {/* Done message */}
          {(user?.kycIdPhoto || idPhoto) && (user?.kycSelfie || selfie) && (
            <div className="glass-card p-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-green-500/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                تم إرسال مستنداتك للمراجعة. سيتم إشعارك بالنتيجة عبر الإشعارات.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
