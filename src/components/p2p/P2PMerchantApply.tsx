'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { compressImage, fileToBase64 } from '@/lib/image-compress'
import {
  Loader2,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Camera,
  User,
  FileText,
  AlertTriangle,
  BadgeCheck,
  Shield,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'

// ===================== TYPES =====================

type MerchantStatus = 'loading' | 'none' | 'pending' | 'approved' | 'rejected'

interface MerchantApplication {
  id: string
  status: string
  rejectionReason: string | null
  appliedAt: string
  reviewedAt: string | null
}

// ===================== COMPONENT =====================

export default function P2PMerchantApply({ onBack }: { onBack?: () => void }) {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<MerchantStatus>('loading')
  const [application, setApplication] = useState<MerchantApplication | null>(null)
  const [idPhoto, setIdPhoto] = useState<string | null>(null)
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null)
  const [addressProof, setAddressProof] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const idInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)
  const addressInputRef = useRef<HTMLInputElement>(null)

  // Check merchant status on mount
  useEffect(() => {
    if (!user?.id) return
    fetchStatus()
  }, [user?.id])

  const fetchStatus = async () => {
    if (!user?.id) return
    setStatus('loading')
    try {
      const res = await fetch(`/api/p2p/merchant?userId=${user.id}`)
      const data = await res.json()
      if (data.success && data.hasApplication && data.application) {
        const app = data.application
        setApplication(app)
        if (app.status === 'approved') setStatus('approved')
        else if (app.status === 'pending') setStatus('pending')
        else if (app.status === 'rejected') setStatus('rejected')
        else setStatus('none')
      } else {
        setStatus('none')
      }
    } catch {
      setStatus('none')
    }
  }

  // Handle file upload with compression
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت')
      return
    }

    try {
      const compressed = await compressImage(file)
      const base64 = await fileToBase64(compressed)
      setter(base64)
    } catch {
      toast.error('خطأ في معالجة الصورة')
    }
  }

  const handleRemovePhoto = (setter: (val: string | null) => void) => {
    setter(null)
  }

  // Submit application
  const handleSubmit = async () => {
    if (!user?.id) return

    if (!idPhoto || !selfiePhoto || !addressProof) {
      toast.error('جميع الصور الثلاث مطلوبة')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/p2p/merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          userId: user.id,
          idPhoto,
          selfiePhoto,
          addressProof,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إرسال طلب التوثيق بنجاح')
        fetchStatus()
      } else {
        toast.error(data.message || 'فشل في إرسال الطلب')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setSubmitting(false)
    }
  }

  // ===================== RENDER: LOADING =====================
  if (status === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    )
  }

  // ===================== RENDER: APPROVED =====================
  if (status === 'approved') {
    return (
      <div className="animate-fade-in" dir="rtl">
        <div className="glass-card p-8 text-center space-y-4 rounded-xl">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
            <BadgeCheck className="w-10 h-10 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-green-400">تمت الموافقة ✓</h3>
            <p className="text-sm text-muted-foreground mt-2">
              أنت الآن تاجر P2P موثق. يمكنك إنشاء إعلانات بيع وشراء USDT.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">تاجر موثق</span>
          </div>
          {application?.appliedAt && (
            <p className="text-[10px] text-muted-foreground">
              تاريخ الموافقة: {new Date(application.appliedAt).toLocaleDateString('ar-SA')}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ===================== RENDER: PENDING =====================
  if (status === 'pending') {
    return (
      <div className="animate-fade-in" dir="rtl">
        <div className="glass-card p-8 text-center space-y-4 rounded-xl">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-yellow-500/10 flex items-center justify-center">
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold gold-text">قيد المراجعة</h3>
            <p className="text-sm text-muted-foreground mt-2">
              تم إرسال طلب توثيق التاجر وسيتم مراجعته من قبل الإدارة قريباً.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">بانتظار المراجعة</span>
          </div>
          {application?.appliedAt && (
            <p className="text-[10px] text-muted-foreground">
              تاريخ التقديم: {new Date(application.appliedAt).toLocaleDateString('ar-SA')}
            </p>
          )}
          <button
            onClick={fetchStatus}
            className="w-full h-11 bg-white/5 text-foreground rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors mt-4"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث الحالة
          </button>
        </div>
      </div>
    )
  }

  // ===================== RENDER: REJECTED =====================
  if (status === 'rejected') {
    return (
      <div className="animate-fade-in space-y-4" dir="rtl">
        {/* Rejection Info Card */}
        <div className="glass-card p-6 rounded-xl space-y-3 border border-red-500/10">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-lg font-bold text-red-400">تم الرفض</h3>
          </div>
          {application?.rejectionReason && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <p className="text-xs text-muted-foreground mb-1">سبب الرفض:</p>
              <p className="text-sm text-red-300">{application.rejectionReason}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            يمكنك إعادة التقديم بعد التأكد من استيفاء المتطلبات أدناه.
          </p>
        </div>

        {/* Re-apply Form */}
        <ApplicationForm
          idPhoto={idPhoto}
          setIdPhoto={setIdPhoto}
          selfiePhoto={selfiePhoto}
          setSelfiePhoto={setSelfiePhoto}
          addressProof={addressProof}
          setAddressProof={setAddressProof}
          idInputRef={idInputRef}
          selfieInputRef={selfieInputRef}
          addressInputRef={addressInputRef}
          submitting={submitting}
          handleSubmit={handleSubmit}
        />
      </div>
    )
  }

  // ===================== RENDER: NO APPLICATION (FORM) =====================
  return (
    <div className="animate-fade-in space-y-4" dir="rtl">
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </button>
      )}

      {/* Header */}
      <div className="glass-card p-6 text-center space-y-2 rounded-xl">
        <div className="w-16 h-16 mx-auto rounded-2xl gold-gradient flex items-center justify-center">
          <User className="w-8 h-8 text-gray-900" />
        </div>
        <h3 className="text-xl font-bold gold-text">التسجيل كتاجر P2P</h3>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          ارفع المستندات المطلوبة لتصبح تاجر P2P موثق وإنشاء إعلانات بيع وشراء USDT
        </p>
      </div>

      {/* Upload Form */}
      <ApplicationForm
        idPhoto={idPhoto}
        setIdPhoto={setIdPhoto}
        selfiePhoto={selfiePhoto}
        setSelfiePhoto={setSelfiePhoto}
        addressProof={addressProof}
        setAddressProof={setAddressProof}
        idInputRef={idInputRef}
        selfieInputRef={selfieInputRef}
        addressInputRef={addressInputRef}
        submitting={submitting}
        handleSubmit={handleSubmit}
      />
    </div>
  )
}

// ===================== APPLICATION FORM SUB-COMPONENT =====================

interface ApplicationFormProps {
  idPhoto: string | null
  setIdPhoto: (val: string | null) => void
  selfiePhoto: string | null
  setSelfiePhoto: (val: string | null) => void
  addressProof: string | null
  setAddressProof: (val: string | null) => void
  idInputRef: React.RefObject<HTMLInputElement | null>
  selfieInputRef: React.RefObject<HTMLInputElement | null>
  addressInputRef: React.RefObject<HTMLInputElement | null>
  submitting: boolean
  handleSubmit: () => void
}

function ApplicationForm({
  idPhoto,
  setIdPhoto,
  selfiePhoto,
  setSelfiePhoto,
  addressProof,
  setAddressProof,
  idInputRef,
  selfieInputRef,
  addressInputRef,
  submitting,
  handleSubmit,
}: ApplicationFormProps) {
  return (
    <div className="glass-card p-5 space-y-5 rounded-xl">
      {/* 1. ID Photo */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" />
          صورة الهوية
        </label>
        {idPhoto ? (
          <div className="relative rounded-xl overflow-hidden border border-white/10">
            <img src={idPhoto} alt="صورة الهوية" className="w-full h-36 object-cover" />
            <button
              onClick={() => setIdPhoto(null)}
              className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/60 transition-colors"
            >
              <XCircle className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => idInputRef.current?.click()}
            className="w-full h-28 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5 hover:border-gold/30 transition-colors"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">اضغط لرفع صورة الهوية</span>
            <span className="text-[10px] text-muted-foreground/60">JPG, PNG - حد أقصى 10MB</span>
          </button>
        )}
        <input
          ref={idInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFileUpload(e, setIdPhoto)
            e.target.value = ''
          }}
        />
      </div>

      {/* 2. Selfie Photo */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          صورة سيلفي مع الهوية
        </label>
        {selfiePhoto ? (
          <div className="relative rounded-xl overflow-hidden border border-white/10">
            <img src={selfiePhoto} alt="سيلفي" className="w-full h-36 object-cover" />
            <button
              onClick={() => setSelfiePhoto(null)}
              className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/60 transition-colors"
            >
              <XCircle className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => selfieInputRef.current?.click()}
            className="w-full h-28 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5 hover:border-gold/30 transition-colors"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">اضغط لرفع صورة سيلفي مع الهوية</span>
            <span className="text-[10px] text-muted-foreground/60">JPG, PNG - حد أقصى 10MB</span>
          </button>
        )}
        <input
          ref={selfieInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFileUpload(e, setSelfiePhoto)
            e.target.value = ''
          }}
        />
      </div>

      {/* 3. Address Proof */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          إثبات السكن
        </label>
        {addressProof ? (
          <div className="relative rounded-xl overflow-hidden border border-white/10">
            <img src={addressProof} alt="إثبات السكن" className="w-full h-36 object-cover" />
            <button
              onClick={() => setAddressProof(null)}
              className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/60 transition-colors"
            >
              <XCircle className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => addressInputRef.current?.click()}
            className="w-full h-28 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5 hover:border-gold/30 transition-colors"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">اضغط لرفع إثبات السكن</span>
            <span className="text-[10px] text-muted-foreground/60">فاتورة خدمات أو كشف حساب بنكي</span>
          </button>
        )}
        <input
          ref={addressInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFileUpload(e, setAddressProof)
            e.target.value = ''
          }}
        />
      </div>

      {/* Upload Progress Indicators */}
      <div className="flex gap-2">
        <div className={`flex-1 h-1 rounded-full transition-all ${idPhoto ? 'bg-green-400' : 'bg-white/10'}`} />
        <div className={`flex-1 h-1 rounded-full transition-all ${selfiePhoto ? 'bg-green-400' : 'bg-white/10'}`} />
        <div className={`flex-1 h-1 rounded-full transition-all ${addressProof ? 'bg-green-400' : 'bg-white/10'}`} />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        {[
          idPhoto ? '✓' : '○',
          selfiePhoto ? '✓' : '○',
          addressProof ? '✓' : '○',
        ].join('  ')} — صورة الهوية · السيلفي · إثبات السكن
      </p>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !idPhoto || !selfiePhoto || !addressProof}
        className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            جارٍ الإرسال...
          </>
        ) : (
          'إرسال طلب التوثيق'
        )}
      </button>
    </div>
  )
}

// Standalone helper for the sub-component
async function handleFileUpload(
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (val: string | null) => void
) {
  const file = e.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.error('يرجى اختيار ملف صورة صالح')
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    toast.error('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت')
    return
  }

  try {
    const compressed = await compressImage(file)
    const base64 = await fileToBase64(compressed)
    setter(base64)
  } catch {
    toast.error('خطأ في معالجة الصورة')
  }
}
