'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  MessageSquare,
  X,
  Send,
  Bot,
  Loader2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Search,
  BookOpen,
  User,
} from 'lucide-react'

interface BotMessage {
  id: string
  type: 'bot' | 'user'
  text: string
  faqItems?: FaqResult[]
  timestamp: string
}

interface FaqResult {
  id: string
  question: string
  answer: string
  category: string
}

const CATEGORY_MAP: Record<string, { label: string; icon: string }> = {
  general: { label: 'عام', icon: '💬' },
  deposit: { label: 'إيداع', icon: '📥' },
  withdrawal: { label: 'سحب', icon: '📤' },
  kyc: { label: 'توثيق', icon: '🛡️' },
  account: { label: 'حساب', icon: '👤' },
  fees: { label: 'رسوم', icon: '💰' },
}

export default function SupportBot() {
  const { user, setScreen } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<BotMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [botEnabled, setBotEnabled] = useState(true)
  const [greeting, setGreeting] = useState('مرحباً! كيف يمكنني مساعدتك اليوم؟')
  const [initializing, setInitializing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize bot settings
  useEffect(() => {
    if (!isOpen) return
    setInitializing(true)
    fetch('/api/faq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_bot_settings' }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBotEnabled(data.settings.isEnabled)
          setGreeting(data.settings.greeting)
          if (messages.length === 0) {
            setMessages([{
              id: 'init',
              type: 'bot',
              text: data.settings.greeting,
              timestamp: new Date().toISOString(),
            }])
          }
        }
      })
      .catch(() => {})
      .finally(() => setInitializing(false))
  }, [isOpen])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const searchFaq = useCallback(async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: query.trim() }),
      })
      const data = await res.json()

      const userMsg: BotMessage = {
        id: `user-${Date.now()}`,
        type: 'user',
        text: query.trim(),
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, userMsg])

      if (data.success && data.results && data.results.length > 0) {
        const botMsg: BotMessage = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          text: `وجدت ${data.results.length} إجابة محتملة:`,
          faqItems: data.results,
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, botMsg])
      } else {
        const botMsg: BotMessage = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          text: 'عذراً، لم أجد إجابة مطابقة لسؤالك. يمكنك تصفح الأسئلة الشائعة بالكامل أو التواصل مع الدعم.',
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, botMsg])
      }
    } catch {
      toast.error('حدث خطأ في البحث')
    } finally {
      setLoading(false)
      setInput('')
    }
  }, [])

  const handleSend = () => {
    if (!input.trim() || loading) return
    searchFaq(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCategoryClick = (category: string) => {
    const categoryQuery: Record<string, string> = {
      general: 'عام',
      deposit: 'إيداع',
      withdrawal: 'سحب',
      kyc: 'توثيق',
      account: 'حساب',
      fees: 'رسوم',
    }
    setInput(categoryQuery[category] || '')
    searchFaq(categoryQuery[category] || '')
  }

  const openFaqPage = () => {
    setScreen('faq')
    setIsOpen(false)
  }

  if (!user || !botEnabled) return null

  return (
    <>
      {/* Floating Button - bottom-right, above the bottom nav */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 md:bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 flex items-center justify-center group"
        aria-label="مساعد الدعم"
      >
        {isOpen ? (
          <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        ) : (
          <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
        )}
        {/* Pulse indicator */}
        {!isOpen && (
          <span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-emerald-400 rounded-full animate-ping opacity-60" />
        )}
        {!isOpen && (
          <span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-emerald-400 rounded-full" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-40 md:bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-96 max-h-[70vh] flex flex-col animate-scale-in"
          dir="rtl"
        >
          {/* Window Header */}
          <div className="bg-emerald-500 rounded-t-2xl px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">مساعد فوركس يمني</h3>
                <p className="text-[10px] text-emerald-100">مساعد ذكي للأسئلة الشائعة</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 bg-background/95 backdrop-blur-xl border border-emerald-500/20 border-t-0 overflow-y-auto max-h-[45vh] min-h-[200px]">
            <div className="p-4 space-y-3">
              {initializing ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id}>
                    {/* User message */}
                    {msg.type === 'user' && (
                      <div className="flex justify-start mb-2">
                        <div className="bg-emerald-500/15 border border-emerald-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                          <div className="flex items-start gap-2">
                            <User className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-foreground">{msg.text}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bot message */}
                    {msg.type === 'bot' && (
                      <div className="flex justify-end mb-2">
                        <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                          <div className="flex items-start gap-2">
                            <Bot className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-muted-foreground leading-relaxed">{msg.text}</p>
                          </div>

                          {/* FAQ results */}
                          {msg.faqItems && msg.faqItems.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.faqItems.map((faq, idx) => (
                                <FaqResultCard key={faq.id} faq={faq} index={idx} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Loading indicator */}
              {loading && (
                <div className="flex justify-end">
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-emerald-400" />
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Categories */}
            {messages.length <= 1 && !loading && (
              <div className="px-4 pb-3">
                <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  تصفح حسب التصنيف:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => handleCategoryClick(key)}
                      className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      {val.icon} {val.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={openFaqPage}
                  className="mt-3 w-full py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  عرض جميع الأسئلة الشائعة
                </button>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="bg-background/95 backdrop-blur-xl border border-emerald-500/20 border-t-0 rounded-b-2xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب سؤالك هنا..."
                  className="w-full h-10 pr-9 pl-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/40 transition-colors"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Sub-component for FAQ result cards in chat
function FaqResultCard({ faq, index }: { faq: FaqResult; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const catInfo = CATEGORY_MAP[faq.category]

  return (
    <div
      className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 overflow-hidden"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-emerald-500/10 transition-colors"
      >
        <span className="text-sm flex-1 text-emerald-300 font-medium">{faq.question}</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 animate-fade-in">
          <p className="text-xs text-muted-foreground leading-relaxed">{faq.answer}</p>
          {catInfo && (
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
              {catInfo.icon} {catInfo.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
