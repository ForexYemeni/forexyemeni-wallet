'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Users,
  Gift,
  Copy,
  Share2,
  TrendingUp,
  DollarSign,
  Check,
  Crown,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'

interface ReferralStats {
  totalReferrals: number
  activeReferrals: number
  totalEarnings: number
  levelStats: { level: number; count: number; earnings: number }[]
  referralCode: string
}

interface ReferralSettings {
  isEnabled: boolean
  commissionType: string
  commissionLevels: number[]
  maxLevels: number
}

interface Commission {
  id: string
  amount: number
  level: number
  description: string
  createdAt: string
}

const REFERRAL_BASE_URL = 'https://forexyemeni-wallet.vercel.app/?ref='

const LEVEL_LABELS: Record<number, string> = {
  1: 'دعوات مباشرة',
  2: 'المستوى الثاني',
  3: 'المستوى الثالث',
  4: 'المستوى الرابع',
  5: 'المستوى الخامس',
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'text-gold border-gold/20 bg-gold/10',
  2: 'text-purple-400 border-purple-400/20 bg-purple-400/10',
  3: 'text-blue-400 border-blue-400/20 bg-blue-400/10',
  4: 'text-green-400 border-green-400/20 bg-green-400/10',
  5: 'text-orange-400 border-orange-400/20 bg-orange-400/10',
}

export default function ReferralPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [settings, setSettings] = useState<ReferralSettings | null>(null)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showCommissions, setShowCommissions] = useState(false)

  // Use affiliateCode from store or stats
  const displayCode = stats?.referralCode || user?.affiliateCode || ''

  useEffect(() => {
    if (user?.id) {
      fetchData()
    }
  }, [user?.id])

  const fetchData = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [statsRes, settingsRes, commissionsRes] = await Promise.all([
        fetch(`/api/referral?action=my_stats&userId=${user.id}`),
        fetch('/api/referral?action=get_settings'),
        fetch(`/api/referral?action=my_commissions&userId=${user.id}`),
      ])

      const statsData = await statsRes.json()
      const settingsData = await settingsRes.json()
      const commissionsData = await commissionsRes.json()

      if (statsData.success) setStats(statsData.stats)
      if (settingsData.success) setSettings(settingsData.settings)
      if (commissionsData.success) setCommissions(commissionsData.commissions || [])
    } catch {
      toast.error('خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    if (!displayCode) return
    navigator.clipboard.writeText(displayCode)
    setCopiedCode(true)
    toast.success('تم نسخ الكود')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const copyLink = () => {
    if (!displayCode) return
    const link = `${REFERRAL_BASE_URL}${displayCode}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    toast.success('تم نسخ رابط الدعوة')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const shareNative = async () => {
    if (!displayCode) return
    const link = `${REFERRAL_BASE_URL}${displayCode}`
    const shareData = {
      title: 'دعوة إلى فوركس يمني',
      text: `سجّل في محفظة فوركس يمني باستخدام كود الدعوة: ${displayCode}`,
      url: link,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        copyLink()
      }
    } catch {
      copyLink()
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-6 shimmer h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  const isReferralEnabled = settings?.isEnabled ?? false

  return (
    <div className="space-y-4 animate-fade-in pb-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold gold-text">برنامج الدعوات</h1>
        <p className="text-sm text-muted-foreground">ادعُ أصدقائك واحصل على عمولات من إيداعاتهم</p>
      </div>

      {/* Disabled Notice */}
      {!isReferralEnabled && (
        <div className="glass-card p-3 rounded-xl border border-yellow-500/20 flex items-center gap-3">
          <Gift className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">برنامج العمولات غير مفعل حالياً، لكن يمكنك مشاركة كود الدعوة الخاص بك</p>
        </div>
      )}

      {/* Referral Code Card */}
      <div className="gold-gradient rounded-2xl p-5 text-gray-900 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-1/4 translate-y-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5" />
            <span className="text-sm font-medium opacity-80">كود الدعوة الخاص بك</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-black/10 rounded-xl px-4 py-3 font-mono text-2xl font-bold tracking-widest text-center" dir="ltr">
              {displayCode || '----'}
            </div>
            <button
              onClick={copyCode}
              className="w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center hover:bg-black/20 transition-colors"
            >
              {copiedCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Share Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={copyLink}
          className="glass-card p-4 rounded-xl text-right hover:bg-white/10 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <ExternalLink className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium gold-text">نسخ الرابط</span>
          </div>
          <p className="text-[10px] text-muted-foreground truncate" dir="ltr">
            {REFERRAL_BASE_URL}{displayCode || '----'}
          </p>
          {copiedLink && (
            <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" />
              تم النسخ
            </p>
          )}
        </button>

        <button
          onClick={shareNative}
          className="glass-card p-4 rounded-xl text-right hover:bg-white/10 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <Share2 className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium gold-text">مشاركة</span>
          </div>
          <p className="text-[10px] text-muted-foreground">شارك عبر التطبيقات</p>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 rounded-xl text-center">
          <Users className="w-6 h-6 text-gold mx-auto mb-2" />
          <p className="text-xl font-bold">{stats?.totalReferrals || 0}</p>
          <p className="text-[10px] text-muted-foreground">إجمالي الدعوات</p>
        </div>
        <div className="glass-card p-4 rounded-xl text-center">
          <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-green-400">{stats?.activeReferrals || 0}</p>
          <p className="text-[10px] text-muted-foreground">دعوات نشطة</p>
        </div>
        <div className="glass-card p-4 rounded-xl text-center">
          <DollarSign className="w-6 h-6 text-gold mx-auto mb-2" />
          <p className="text-xl font-bold gold-text">{(stats?.totalEarnings || 0).toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">USDT ربحت</p>
        </div>
      </div>

      {/* Referral Levels */}
      {settings && (
        <div className="glass-card p-4 rounded-xl space-y-3">
          <h3 className="text-sm font-bold gold-text flex items-center gap-2">
            <Gift className="w-4 h-4" />
            مستويات العمولة
          </h3>

          {stats?.levelStats?.map((ls) => {
            const levelColor = LEVEL_COLORS[ls.level] || LEVEL_COLORS[1]
            const commissionPercent = settings.commissionLevels[ls.level - 1]
            return (
              <div key={ls.level} className={`p-3 rounded-lg border ${levelColor}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">
                    المستوى {ls.level} ({LEVEL_LABELS[ls.level] || `المستوى ${ls.level}`})
                  </span>
                  {commissionPercent !== undefined && (
                    <span className="text-[10px] font-medium">
                      {settings.commissionType === 'percentage'
                        ? `${commissionPercent}% عمولة`
                        : `${commissionPercent} USDT عمولة`
                      }
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs opacity-80">
                  <span>{ls.count} مستخدم</span>
                  <span>{ls.earnings.toFixed(2)} USDT مكتسب</span>
                </div>
              </div>
            )
          })}

          {/* Show empty levels if no referrals yet */}
          {(!stats?.levelStats || stats.levelStats.length === 0) && (
            <p className="text-center text-xs text-muted-foreground py-3">
              لم تقم بدعوة أحد بعد. شارك كود الدعوة وابدأ بالكسب!
            </p>
          )}
        </div>
      )}

      {/* Commission History */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <button
          onClick={() => setShowCommissions(!showCommissions)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-sm font-bold gold-text flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            سجل العمولات
            {commissions.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-gold/10 rounded-full text-gold">
                {commissions.length}
              </span>
            )}
          </h3>
          {showCommissions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showCommissions && (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {commissions.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
                لا توجد عمولات بعد
              </p>
            ) : (
              commissions.map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                    <span className="text-sm font-bold text-green-400">+{c.amount.toFixed(2)} USDT</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{c.description}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold mt-1 inline-block">
                    مستوى {c.level}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Terms & Conditions */}
      {settings && (
        <div className="glass-card p-4 rounded-xl space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground">شروط برنامج الدعوات</h3>
          <ul className="space-y-1.5 text-[11px] text-muted-foreground/70">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-gold mt-1.5 flex-shrink-0" />
              <span>تحصل على عمولة من كل إيداع مؤكد من الأشخاص الذين دعوتهم</span>
            </li>
            {settings.minDepositForCommission > 0 && (
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-gold mt-1.5 flex-shrink-0" />
                <span>الحد الأدنى للإيداع المؤهل للعمولة: {settings.minDepositForCommission} USDT</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-gold mt-1.5 flex-shrink-0" />
              <span>يتم توزيع العمولات تلقائياً على {settings.maxLevels} مستويات من الدعوات</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-gold mt-1.5 flex-shrink-0" />
              <span>يتم إضافة العمولة إلى رصيدك فور تأكيد الإيداع</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
