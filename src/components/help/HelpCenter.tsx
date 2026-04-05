'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  X,
  ArrowLeft,
} from 'lucide-react'

interface FaqItem {
  id: string
  question: string
  answer: string
  category: string
  keywords: string[]
  isActive: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'عام',
  deposit: 'الإيداعات',
  withdrawal: 'السحوبات',
  kyc: 'التحقق (KYC)',
  account: 'الحساب',
  fees: 'الرسوم',
}

const CATEGORIES = [
  { key: 'all', label: 'الكل' },
  { key: 'general', label: 'عام' },
  { key: 'deposit', label: 'الإيداعات' },
  { key: 'withdrawal', label: 'السحوبات' },
  { key: 'kyc', label: 'التحقق' },
  { key: 'account', label: 'الحساب' },
  { key: 'fees', label: 'الرسوم' },
]

export default function HelpCenter() {
  const { setScreen } = useAuthStore()
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchFaqs()
  }, [])

  const fetchFaqs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/faq')
      const data = await res.json()
      if (data.success) {
        setFaqs(data.items || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory
    const matchesSearch = !search
      ? true
      : faq.question.toLowerCase().includes(search.toLowerCase()) ||
        faq.answer.toLowerCase().includes(search.toLowerCase()) ||
        faq.keywords?.some((kw: string) => kw.toLowerCase().includes(search.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setScreen('dashboard')}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center gold-glow">
            <HelpCircle className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold">مركز المساعدة</h1>
            <p className="text-sm text-muted-foreground">الأسئلة الشائعة والمساعدة</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="ابحث في الأسئلة الشائعة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 rounded-xl glass-input pr-10 pl-10 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3 py-2 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0 ${
              activeCategory === cat.key
                ? 'bg-gold/10 text-gold border border-gold/20 font-medium'
                : 'bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-transparent'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-16 rounded-xl" />
          ))}
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="glass-card p-8 text-center space-y-3">
          <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">
            {search ? 'لا توجد نتائج لبحثك' : 'لا توجد أسئلة شائعة حالياً'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filteredFaqs.length} سؤال</p>
          {filteredFaqs.map((faq) => {
            const isExpanded = expandedId === faq.id
            return (
              <div
                key={faq.id}
                className={`glass-card rounded-xl overflow-hidden transition-all ${
                  isExpanded ? 'border-gold/20' : ''
                }`}
              >
                <button
                  onClick={() => toggleExpand(faq.id)}
                  className="w-full flex items-center justify-between p-4 text-right hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {faq.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-gold/10 text-gold whitespace-nowrap">
                        {CATEGORY_LABELS[faq.category] || faq.category}
                      </span>
                    )}
                    <span className="text-sm font-medium">{faq.question}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gold flex-shrink-0 mr-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mr-2" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-3">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Contact Support */}
      <div className="glass-card p-5 rounded-xl space-y-3 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/10 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-bold">لم تجد إجابتك؟</p>
          <p className="text-xs text-muted-foreground mt-1">تواصل مع فريق الدعم الفني مباشرة</p>
        </div>
        <button
          onClick={() => setScreen('chat')}
          className="h-10 px-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium rounded-xl hover:bg-blue-500/20 transition-all text-sm flex items-center gap-2 mx-auto"
        >
          <MessageCircle className="w-4 h-4" />
          تواصل مع الدعم
        </button>
      </div>
    </div>
  )
}
