'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { compressImage, fileToBase64 } from '@/lib/image-compress'
import { Loader2, Upload, CheckCircle, XCircle, Clock, Camera, User, FileText, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'

export default function MerchantVerification({ onVerified }: { onVerified?: () => void }) {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'none' | 'pending' | 'approved' | 'rejected'>('loading')
  const [rejectedList, setRejectedList] = useState<any[]>([])
  const [idPhoto, setIdPhoto] = useState<string | null>(null)
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null)
  const [addressProof, setAddressProof] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [warningExpanded, setWarningExpanded] = useState(true)
  const [confirmedWarning, setConfirmedWarning] = useState(false)

  useEffect(() => {
    if (user?.id) fetchStatus()
  }, [user?.id])

  const fetchStatus = async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/p2p/merchant?userId=${user.id}`)
      const data = await res.json()
      if (data.success && data.hasApplication && data.application) {
        const app = data.application
        if (app.status === 'approved') {
          setStatus('approved')
          onVerified?.()
          // Update store with merchantId if missing
          if (!user?.merchantId) {
            const { updateUser } = useAuthStore.getState()
            updateUser({ merchantId: app.id })
          }
        } else if (app.status === 'pending') {
          setStatus('pending')
        } else if (app.status === 'rejected') {
          setStatus('rejected')
          setRejectedList([app])
        } else {
          setStatus('none')
        }
      } else if (user?.merchantId) {
        // User has merchantId from old system
        setStatus('approved')
        onVerified?.()
      } else {
        setStatus('none')
      }
    } catch {
      setStatus('none')
    }
  }

  const handleImageUpload = async (setter: (v: string) => void) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const compressed = await compressImage(file)
        const base64 = await fileToBase64(compressed)
        setter(base64)
      } catch {
        toast.error('خطأ في رفع الصورة')
      }
    }
    input.click()
  }

  const handleSubmit = async () => {
    if (!confirmedWarning) {
      setConfirmedWarning(true)
      toast.error('يرجى قراءة التنبيه أعلاه والموافقة عليه أولاً')
      return
    }
    if (!idPhoto || !selfiePhoto || !addressProof || !fullName.trim() || !phone.trim()) {
      toast.error('جميع الحقول مطلوبة')
      return
    }
    if (!user?.id) {
      toast.error('يجب تسجيل الدخول أولاً')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/p2p/merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', userId: user.id, idPhoto, selfiePhoto, addressProof, fullName: fullName.trim(), phone: phone.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إرسال طلب التوثيق بنجاح')
        setStatus('pending')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في إرسال الطلب')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-lg font-bold text-green-400">أنت تاجر موثق ✓</h3>
        <p className="text-sm text-muted-foreground">يمكنك الآن إنشاء إعلانات بيع وشراء USDT</p>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-yellow-500/10 flex items-center justify-center">
          <Clock className="w-8 h-8 text-yellow-400" />
        </div>
        <h3 className="text-lg font-bold gold-text">طلب قيد المراجعة</h3>
        <p className="text-sm text-muted-foreground">تم إرسال طلب التوثيق وسيتم مراجعته من قبل الإدارة</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Rejected info */}
      {status === 'rejected' && rejectedList.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 space-y-2">
          <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            تم رفض طلب سابق
          </div>
          {rejectedList[0]?.reviewNote && (
            <p className="text-xs text-muted-foreground">سبب الرفض: {rejectedList[0].reviewNote}</p>
          )}
          <p className="text-xs text-muted-foreground">يمكنك إعادة التقديم بالأسفل</p>
        </div>
      )}

      {/* Important Warning - Always visible */}
      <div className={`rounded-xl border-2 transition-all ${confirmedWarning ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
        <button
          onClick={() => setWarningExpanded(!warningExpanded)}
          className="w-full flex items-center justify-between p-4 text-right"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className={`w-5 h-5 ${confirmedWarning ? 'text-green-400' : 'text-red-400'}`} />
            <span className={`text-sm font-bold ${confirmedWarning ? 'text-green-400' : 'text-red-400'}`}>
              {confirmedWarning ? 'تمت قراءة التنبيه ✓' : 'تنبيه هام جداً - اقرأ قبل التقديم'}
            </span>
          </div>
          {warningExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {warningExpanded && (
          <div className="px-4 pb-4 space-y-3">
            <div className="p-3 rounded-xl bg-black/20 space-y-2.5">
              <p className="text-sm font-medium text-red-300">تحذير: بمجرد قبول طلب التاجر سيحدث الآتي:</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">✕</span>
                  <p>سيتم <strong className="text-red-400">إغلاق حسابك العادي</strong> (المستخدم) بالكامل ولن تتمكن من تسجيل الدخول به كعادي بعد ذلك.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5 flex-shrink-0">⟳</span>
                  <p>سيتم فتح <strong className="text-yellow-400">حساب تاجر جديد</strong> منفصل تماماً عن حسابك الحالي بإعدادات مختلفة.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">✕</span>
                  <p>لن تتمكن من إجراء عمليات <strong>إيداع أو سحب</strong> كـمستخدم عادي بعد التحويل إلى حساب التاجر.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5 flex-shrink-0">★</span>
                  <p>حساب التاجر يُخصص <strong className="text-yellow-400">فقط</strong> لإنشاء وإدارة إعلانات بيع وشراء USDT عبر P2P.</p>
                </div>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <input
                type="checkbox"
                checked={confirmedWarning}
                onChange={(e) => setConfirmedWarning(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 accent-red-500"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                لقد قرأت التنبيه أعلاه وأفهم تماماً أن حسابي العادي سيتم إغلاقه عند قبول طلب التاجر، وأوافق على ذلك.
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="glass-card p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl gold-gradient flex items-center justify-center">
            <User className="w-7 h-7 text-gray-900" />
          </div>
          <h3 className="text-lg font-bold gold-text">توثيق التاجر P2P</h3>
          <p className="text-xs text-muted-foreground">ارفع المستندات المطلوبة لتصبح تاجر P2P</p>
        </div>

        <div className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">الاسم الكامل</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="أدخل اسمك الكامل"
              className="w-full h-11 rounded-xl glass-input px-3 text-sm"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">رقم الهاتف</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الهاتف"
              className="w-full h-11 rounded-xl glass-input px-3 text-sm"
              dir="ltr"
            />
          </div>

          {/* ID Photo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              صورة الهوية
            </label>
            {idPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                <img src={idPhoto} alt="الهوية" className="w-full h-32 object-cover" />
                <button onClick={() => setIdPhoto(null)} className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => handleImageUpload(setIdPhoto)} className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-gold/30 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">اضغط لرفع صورة الهوية</span>
              </button>
            )}
          </div>

          {/* Selfie */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              صورة سيلفي
            </label>
            {selfiePhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                <img src={selfiePhoto} alt="سيلفي" className="w-full h-32 object-cover" />
                <button onClick={() => setSelfiePhoto(null)} className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => handleImageUpload(setSelfiePhoto)} className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-gold/30 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">اضغط لرفع صورة سيلفي</span>
              </button>
            )}
          </div>

          {/* Address Proof */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              إثبات السكن
            </label>
            {addressProof ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                <img src={addressProof} alt="إثبات سكن" className="w-full h-32 object-cover" />
                <button onClick={() => setAddressProof(null)} className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => handleImageUpload(setAddressProof)} className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-gold/30 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">اضغط لرفع إثبات السكن</span>
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !idPhoto || !selfiePhoto || !addressProof || !fullName.trim() || !phone.trim()}
          className="w-full h-12 gold-gradient text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'إرسال طلب التوثيق'}
        </button>
      </div>
    </div>
  )
}
