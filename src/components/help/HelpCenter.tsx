'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  HelpCircle,
  Search,
  ChevronDown,
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
      if (data.success) setFaqs(data.items || [])
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
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors tap-effect"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center gold-glow">
            <HelpCircle className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold gold-text">مركز المساعدة</h1>
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
            onClick={() => { setActiveCategory(cat.key); setExpandedId(null) }}
            className={`px-3 py-2 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0 tap-effect ${
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
        <div className="space-y-3 stagger-list">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="glass-card p-4 flex items-center gap-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="skeleton-circle w-8 h-8 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-line w-2/3" />
                <div className="skeleton-line w-full h-3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="glass-card p-8 text-center empty-state-enhanced space-y-3">
          <div className="empty-state-icon">
            <HelpCircle className="w-10 h-10 text-gold/20 mx-auto" />
          </div>
          <p className="text-muted-foreground text-sm">
            {search ? 'لا توجد نتائج لبحثك' : 'لا توجد أسئلة شائعة حالياً'}
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-gold hover:text-gold-light transition-colors tap-effect">
              مسح البحث
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filteredFaqs.length} سؤال</p>
          <div className="space-y-2 stagger-list">
            {filteredFaqs.map((faq, index) => {
              const isExpanded = expandedId === faq.id
              return (
                <div
                  key={faq.id}
                  className={`glass-card rounded-xl overflow-hidden transition-all ${
                    isExpanded ? 'border-gold/20' : 'hover:border-gold/10'
                  }`}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <button
                    onClick={() => toggleExpand(faq.id)}
                    className="w-full flex items-center justify-between p-4 text-right hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {faq.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-gold/10 text-gold whitespace-nowrap">
                          {CATEGORY_LABELS[faq.category] || faq.category}
                        </span>
                      )}
                      <span className="text-sm font-medium">{faq.question}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 mr-2 accordion-chevron ${
                      isExpanded ? 'rotated text-gold' : 'text-muted-foreground'
                    }`} />
                  </button>
                  <div className={`accordion-content px-4 mx-4 border-t border-white/5 ${isExpanded ? 'expanded' : ''}`}>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Contact Support */}
      <div className="glass-card p-5 rounded-xl space-y-3 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-gold/10 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-gold" />
        </div>
        <div>
          <p className="text-sm font-bold">لم تجد إجابتك؟</p>
          <p className="text-xs text-muted-foreground mt-1">تواصل مع فريق الدعم الفني مباشرة</p>
        </div>
        <button
          onClick={() => setScreen('chat')}
          className="h-10 px-6 bg-gold/10 border border-gold/20 text-gold font-medium rounded-xl hover:bg-gold/20 transition-all text-sm flex items-center gap-2 mx-auto tap-effect"
        >
          <MessageCircle className="w-4 h-4" />
          تواصل مع الدعم
        </button>
      </div>
    </div>
  )
}
