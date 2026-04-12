'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  Search,
  ChevronDown,
  HelpCircle,
  ArrowRight,
  Loader2,
  BookOpen,
  X,
} from 'lucide-react'

interface FaqItem {
  id: string
  question: string
  answer: string
  category: string
}

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'الكل', icon: '📋' },
  { key: 'general', label: 'عام', icon: '💬' },
  { key: 'deposit', label: 'إيداع', icon: '📥' },
  { key: 'withdrawal', label: 'سحب', icon: '📤' },
  { key: 'kyc', label: 'توثيق', icon: '🛡️' },
  { key: 'account', label: 'حساب', icon: '👤' },
  { key: 'fees', label: 'رسوم', icon: '💰' },
]

const CATEGORY_LABELS: Record<string, string> = {
  general: 'عام',
  deposit: 'إيداع',
  withdrawal: 'سحب',
  kyc: 'توثيق',
  account: 'حساب',
  fees: 'رسوم',
}

export default function FaqPage() {
  const { setScreen } = useAuthStore()
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/faq')
      .then(res => res.json())
      .then(data => {
        if (data.success) setItems(data.items || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredItems = useMemo(() => {
    let result = items
    if (activeCategory !== 'all') {
      result = result.filter(item => item.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(
        item =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query)
      )
    }
    return result
  }, [searchQuery, activeCategory, items])

  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const cat = item.category || 'general'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(item)
      return acc
    }, {} as Record<string, FaqItem[]>)
  }, [filteredItems])

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-900" />
          </div>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4 shimmer h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center gold-glow">
            <BookOpen className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold gold-text">الأسئلة الشائعة</h1>
            <p className="text-sm text-muted-foreground mt-0.5">ابحث عن إجابات لأكثر الأسئلة شيوعاً</p>
          </div>
        </div>
        <button
          onClick={() => setScreen('dashboard')}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors tap-effect"
        >
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن سؤال..."
          className="w-full h-12 pr-11 pl-10 rounded-xl glass-input text-sm text-foreground placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Category Tabs — Gold theme (consistent with app) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(cat.key); setExpandedId(null) }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0 tap-effect ${
              activeCategory === cat.key
                ? 'bg-gold/15 text-gold border border-gold/25 font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* FAQ Items by Category */}
      {filteredItems.length === 0 ? (
        <div className="glass-card p-8 text-center empty-state-enhanced">
          <div className="empty-state-icon">
            <HelpCircle className="w-12 h-12 text-gold/20 mx-auto mb-3" />
          </div>
          <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
          <p className="text-xs text-muted-foreground/70 mt-1">جرب تغيير كلمة البحث أو التصنيف</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                {CATEGORY_LABELS[category] || category}
                <span className="text-xs text-muted-foreground font-normal">
                  ({categoryItems.length})
                </span>
              </h3>
              <div className="space-y-2 stagger-list">
                {categoryItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`glass-card rounded-xl overflow-hidden transition-all ${
                      expandedId === item.id ? 'border-gold/20' : 'hover:border-gold/10'
                    }`}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="w-full flex items-center gap-3 p-4 text-right hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                        <HelpCircle className="w-4 h-4 text-gold" />
                      </span>
                      <span className="text-sm font-medium flex-1 text-foreground">
                        {item.question}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 accordion-chevron ${
                        expandedId === item.id ? 'rotated text-gold' : ''
                      }`} />
                    </button>
                    <div className={`accordion-content px-4 mx-4 border-t border-white/5 ${expandedId === item.id ? 'expanded' : ''}`}>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Count */}
      {filteredItems.length > 0 && (
        <p className="text-center text-xs text-muted-foreground pb-4">
          {filteredItems.length} سؤال
        </p>
      )}
    </div>
  )
}
