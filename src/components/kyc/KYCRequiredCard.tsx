'use client'

import { useAuthStore } from '@/lib/store'
import {
  Shield,
  ChevronLeft,
  Lock,
  Camera,
  FileText,
  UserCheck,
  BadgeCheck,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'

interface KYCRequiredCardProps {
  type: 'deposit' | 'withdraw'
}

export default function KYCRequiredCard({ type }: KYCRequiredCardProps) {
  const { user, setScreen } = useAuthStore()

  const isDeposit = type === 'deposit'

  const handleGoToKYC = () => {
    setScreen('kyc')
  }

  const kycStatus = user?.kycStatus || 'none'

  const getStatusConfig = () => {
    switch (kycStatus) {
      case 'pending':
        return {
          badge: 'قيد المراجعة',
          badgeColor: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
          badgeIcon: <FileText className="w-3.5 h-3.5" />,
          description: 'تم إرسال مستنداتك وهي قيد المراجعة من قبل الإدارة. سيتم إشعارك بالنتيجة عبر الإشعارات.',
          showButton: false,
        }
      case 'rejected':
        return {
          badge: 'مرفوض — إعادة المحاولة',
          badgeColor: 'bg-red-500/10 border-red-500/20 text-red-400',
          badgeIcon: <Lock className="w-3.5 h-3.5" />,
          description: 'تم رفض مستنداتك السابقة. يرجى إعادة رفع المستندات بالشكل الصحيح لاستكمال عملية التوثيق.',
          showButton: true,
          buttonLabel: 'إعادة رفع المستندات',
        }
      default:
        return {
          badge: 'غير موثق',
          badgeColor: 'bg-white/5 border-white/10 text-muted-foreground',
          badgeIcon: <Shield className="w-3.5 h-3.5" />,
          description: 'لحماية حسابك وأموالك، يجب توثيق هويتك أولاً. قم برفع صورة الهوية الأمامية والخلفية لإتمام عملية التحقق.',
          showButton: true,
          buttonLabel: 'توثيق الهوية الآن',
        }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setScreen('dashboard')}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDeposit ? 'bg-green-500/10' : 'bg-red-500/10'
          }`}>
            {isDeposit
              ? <ArrowDownLeft className="w-5 h-5 text-green-400" />
              : <ArrowUpRight className="w-5 h-5 text-red-400" />
            }
          </div>
          <div>
            <h1 className="text-lg font-bold">{isDeposit ? 'إيداع' : 'سحب'}</h1>
            <p className="text-xs text-muted-foreground">{isDeposit ? 'إيداع الأموال في محفظتك' : 'سحب الأموال من محفظتك'}</p>
          </div>
        </div>
      </div>

      {/* Main KYC Required Card */}
      <div className="space-y-4 animate-slide-up">
        {/* Professional Card */}
        <div
          onClick={statusConfig.showButton ? handleGoToKYC : undefined}
          className={`glass-card p-6 rounded-2xl relative overflow-hidden ${
            statusConfig.showButton ? 'cursor-pointer hover:border-gold/30 transition-all active:scale-[0.98]' : ''
          }`}
        >
          {/* Background decorative elements */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-gold/3 rounded-full -translate-x-16 -translate-y-16" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-gold/3 rounded-full translate-x-12 translate-y-12" />

          {/* Top Icon + Badge */}
          <div className="relative flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gold/10 flex items-center justify-center gold-glow">
                <Shield className="w-10 h-10 text-gold" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-500/20 border-2 border-background flex items-center justify-center">
                <Lock className="w-4 h-4 text-red-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold">التوثيق مطلوب</h2>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                {statusConfig.description}
              </p>
            </div>

            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${statusConfig.badgeColor}`}>
              {statusConfig.badgeIcon}
              <span className="text-xs font-bold">{statusConfig.badge}</span>
            </div>
          </div>

          {/* Required Documents Section */}
          <div className="relative mt-6 border-t border-white/5 pt-5">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gold" />
              المستندات المطلوبة
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium">صورة الهوية الأمامية</p>
                  <p className="text-[10px] text-muted-foreground">الوجه الأمامي لبطاقة الهوية</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">صورة الهوية الخلفية</p>
                  <p className="text-[10px] text-muted-foreground">الوجه الخلفي لبطاقة الهوية</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">الرقم و الهوية</p>
                  <p className="text-[10px] text-muted-foreground">رقم الهاتف + بطاقة الهوية</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          {statusConfig.showButton && (
            <div className="relative mt-5">
              <button
                className="w-full h-12 gold-gradient text-gray-900 font-bold text-sm rounded-xl hover:opacity-90 transition-all gold-glow flex items-center justify-center gap-2"
              >
                <BadgeCheck className="w-5 h-5" />
                {statusConfig.buttonLabel}
              </button>
            </div>
          )}

          {/* Pending info text (when under review) */}
          {!statusConfig.showButton && (
            <div className="relative mt-5">
              <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-center">
                <p className="text-xs text-yellow-400">
                  سيتم إشعارك فور انتهاء مراجعة مستنداتك
                </p>
              </div>
              <button
                onClick={() => setScreen('dashboard')}
                className="w-full mt-3 h-11 bg-white/5 border border-white/10 text-foreground font-medium text-sm rounded-xl hover:bg-white/10 transition-all"
              >
                العودة للرئيسية
              </button>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-green-400">حماية أموالك</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                عملية التوثيق ضرورية لحماية حسابك من الاستخدام غير المصرح به وضمان أمان معاملاتك المالية.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
