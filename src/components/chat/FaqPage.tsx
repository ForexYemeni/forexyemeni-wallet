'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  Search,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ArrowRight,
  Loader2,
  BookOpen,
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
        if (data.success) {
          setItems(data.items || [])
          setFilteredItems(data.items || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredItems = useMemo(() => {
    let result = items

    // Filter by category
    if (activeCategory !== 'all') {
      result = result.filter(item => item.category === activeCategory)
    }

    // Filter by search query
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

  // Group filtered items by category
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
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
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
        <div>
          <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            الأسئلة الشائعة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">ابحث عن إجابات لأكثر الأسئلة شيوعاً</p>
        </div>
        <button
          onClick={() => setScreen('dashboard')}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
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
          className="w-full h-12 pr-11 pl-4 rounded-xl glass-input text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0 ${
              activeCategory === cat.key
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
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
        <div className="glass-card p-8 text-center">
          <HelpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
          <p className="text-xs text-muted-foreground/70 mt-1">جرب تغيير كلمة البحث أو التصنيف</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {CATEGORY_LABELS[category] || category}
                <span className="text-xs text-muted-foreground font-normal">
                  ({categoryItems.length})
                </span>
              </h3>
              <div className="space-y-2">
                {categoryItems.map(item => (
                  <div
                    key={item.id}
                    className="glass-card rounded-xl overflow-hidden hover:border-emerald-500/20 transition-colors"
                  >
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="w-full flex items-center gap-3 p-4 text-right"
                    >
                      <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <HelpCircle className="w-4 h-4 text-emerald-400" />
                      </span>
                      <span className="text-sm font-medium flex-1 text-foreground">
                        {item.question}
                      </span>
                      {expandedId === item.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    {expandedId === item.id && (
                      <div className="px-4 pb-4 animate-fade-in">
                        <div className="border-t border-white/5 pt-3 mr-11">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </div>
                    )}
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
