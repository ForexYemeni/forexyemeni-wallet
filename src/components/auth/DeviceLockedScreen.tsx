'use client'

import { useAuthStore } from '@/lib/store'
import { Smartphone, Lock, MessageCircle, ArrowLeft } from 'lucide-react'

export default function DeviceLockedScreen() {
  const { pendingRegistration, setScreen } = useAuthStore()

  return (
    <div className="animate-slide-up w-full max-w-sm mx-auto space-y-6 p-6">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Lock className="w-10 h-10 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-red-400">حسابك مقفل</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            تم اكتشاف محاولة دخول من جهاز غير معروف. تم قفل الحساب لحماية بياناتك وأرصدتك.
          </p>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
          <Smartphone className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">جهاز غير معروف</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              تم رفض تسجيل الدخول من هذا الجهاز لأنه غير مسجل في حسابك
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">ماذا يجب أن تفعل؟</p>
          <div className="space-y-1.5">
            <p>• تواصل مع الإدارة لطلب تصريح الدخول من هذا الجهاز</p>
            <p>• سيتم إزالة جميع الأجهزة السابقة عند التصريح بالجهاز الجديد</p>
            <p>• لا يمكن تسجيل الدخول إلا من جهاز واحد فقط</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-gold/5 border border-gold/10">
          <p className="text-xs text-gold">
            لضمان أمان حسابك، لا يمكن لأي شخص غير الإدارة الموافقة على الدخول من أجهزة جديدة
          </p>
        </div>
      </div>

      <button
        onClick={() => setScreen('login')}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        العودة لتسجيل الدخول
      </button>
    </div>
  )
}
