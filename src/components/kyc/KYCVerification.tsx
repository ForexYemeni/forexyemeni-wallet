'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Shield,
  Phone,
  Camera,
  UserCheck,
  Loader2,
  Check,
  X,
  Upload,
} from 'lucide-react'

export default function KYCVerification() {
  const { user, updateUser } = useAuthStore()
  const [step, setStep] = useState<'phone' | 'verify' | 'upload' | 'done'>(
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

  const handleSubmitPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone) {
      toast.error('يرجى إدخال رقم الهاتف')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/kyc/submit-phone', {
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
      const res = await fetch('/api/kyc/verify-phone', {
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

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX_SIZE = 600
        const QUALITY = 0.5
        let { width, height } = img
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE }
          else { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          else resolve(file)
        }, 'image/jpeg', QUALITY)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
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

      const res = await fetch('/api/kyc/upload', {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold">التحقق من الهوية (KYC)</h1>
          <p className="text-sm text-muted-foreground">
            الحالة الحالية: {user?.kycStatus === 'none' ? 'لم يبدأ' : user?.kycStatus === 'pending' ? 'قيد المراجعة' : user?.kycStatus === 'approved' ? 'مقبول' : user?.kycStatus === 'rejected' ? 'مرفوض' : user?.kycStatus}
          </p>
        </div>
      </div>

      {/* Steps Progress */}
      <div className="flex items-center justify-center gap-4">
        {[
          { key: 'phone', label: 'الهاتف', icon: Phone },
          { key: 'verify', label: 'التحقق', icon: UserCheck },
          { key: 'upload', label: 'المستندات', icon: Camera },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s.key || (s.key === 'phone' && step === 'verify') || (s.key !== 'phone' && (step === 'upload' || step === 'done'))
                ? 'gold-gradient text-gray-900'
                : 'bg-white/5 text-muted-foreground'
            }`}>
              <s.icon className="w-4 h-4" />
            </div>
            {i < 2 && (
              <div className={`w-8 h-0.5 ${i === 0 && step !== 'phone' ? 'bg-gold/50' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step: Phone */}
      {step === 'phone' && (
        <form onSubmit={handleSubmitPhone} className="glass-card p-5 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">رقم الهاتف</Label>
            <div className="flex gap-2">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="glass-input h-12 w-20 text-sm text-center"
              >
                <option value="YE">967+</option>
              </select>
              <Input
                placeholder="771234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="glass-input h-12 text-base flex-1"
                dir="ltr"
              />
            </div>
            <p className="text-xs text-muted-foreground">سيتم إرسال رمز التحقق إلى بريدك الإلكتروني</p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال رمز التحقق'}
          </Button>
        </form>
      )}

      {/* Step: Verify OTP */}
      {step === 'verify' && (
        <div className="glass-card p-5 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">أدخل رمز التحقق المرسل إلى بريدك الإلكتروني</p>
          </div>

          <div className="flex justify-center gap-2" dir="ltr">
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
            className="w-full h-12 gold-gradient text-gray-900 font-bold text-base rounded-xl hover:opacity-90 transition-all gold-glow"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق من الرقم'}
          </Button>
        </div>
      )}

      {/* Step: Upload Documents */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* ID Photo */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-gold" />
                <h3 className="text-sm font-bold">صورة بطاقة الهوية</h3>
              </div>
              {idPhoto && (
                <span className="flex items-center gap-1 text-xs text-green-400"><Check className="w-3 h-3" /> تم الرفع</span>
              )}
            </div>

            {idPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gold/20">
                <img src={idPreview} alt="ID" className="w-full h-48 object-cover" />
                <button
                  onClick={() => { setIdPhoto(null); setIdPreview(null) }}
                  className="absolute top-2 left-2 w-8 h-8 bg-red-500/80 rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-gold/30 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <span className="text-xs text-muted-foreground">اضغط لاختيار الصورة</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange('id_photo', e.target.files[0])}
                />
              </label>
            )}

            {!idPhoto && (
              <Button
                disabled
                className="w-full h-10 gold-gradient text-gray-900 font-bold text-sm rounded-xl opacity-50"
              >
                ارفع أولاً
              </Button>
            )}
            {idPhoto && !user?.kycIdPhoto && (
              <Button
                onClick={() => handleUpload('id_photo')}
                disabled={loading}
                className="w-full h-10 gold-gradient text-gray-900 font-bold text-sm rounded-xl hover:opacity-90"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'رفع صورة الهوية'}
              </Button>
            )}
            {user?.kycIdPhoto && (
              <p className="text-xs text-green-400 text-center">تم رفع صورة الهوية مسبقاً</p>
            )}
          </div>

          {/* Selfie */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-gold" />
                <h3 className="text-sm font-bold">صورة شخصية (سيلفي)</h3>
              </div>
              {selfie && (
                <span className="flex items-center gap-1 text-xs text-green-400"><Check className="w-3 h-3" /> تم الرفع</span>
              )}
            </div>

            {selfiePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gold/20">
                <img src={selfiePreview} alt="Selfie" className="w-full h-48 object-cover" />
                <button
                  onClick={() => { setSelfie(null); setSelfiePreview(null) }}
                  className="absolute top-2 left-2 w-8 h-8 bg-red-500/80 rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-gold/30 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <span className="text-xs text-muted-foreground">اضغط لاختيار الصورة</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange('selfie', e.target.files[0])}
                />
              </label>
            )}

            {!selfie && (
              <Button
                disabled
                className="w-full h-10 gold-gradient text-gray-900 font-bold text-sm rounded-xl opacity-50"
              >
                ارفع أولاً
              </Button>
            )}
            {selfie && !user?.kycSelfie && (
              <Button
                onClick={() => handleUpload('selfie')}
                disabled={loading}
                className="w-full h-10 gold-gradient text-gray-900 font-bold text-sm rounded-xl hover:opacity-90"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'رفع الصورة الشخصية'}
              </Button>
            )}
            {user?.kycSelfie && (
              <p className="text-xs text-green-400 text-center">تم رفع الصورة الشخصية مسبقاً</p>
            )}
          </div>

          {(user?.kycIdPhoto || idPhoto) && (user?.kycSelfie || selfie) && (
            <div className="glass-card p-4 text-center">
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
