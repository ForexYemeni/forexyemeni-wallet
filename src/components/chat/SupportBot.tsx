'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  MessageSquare,
  X,
  Send,
  Bot,
  Loader2,
  User,
  Power,
} from 'lucide-react'

interface BotMessage {
  id: string
  type: 'bot' | 'user'
  text: string
  timestamp: string
}

export default function SupportBot() {
  const { user } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<BotMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [botEnabled, setBotEnabled] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load bot enabled state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('forexyemeni-bot-enabled')
      if (saved !== null) {
        setBotEnabled(saved === 'true')
      }
    } catch {}
  }, [])

  const toggleBot = () => {
    const newState = !botEnabled
    setBotEnabled(newState)
    try {
      localStorage.setItem('forexyemeni-bot-enabled', String(newState))
    } catch {}
  }

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'init',
        type: 'bot',
        text: 'مرحباً! 👋 أنا مساعدك الذكي في محفظة فوركس يمني. كيف يمكنني مساعدتك اليوم؟',
        timestamp: new Date().toISOString(),
      }])
    }
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

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userText = input.trim()
    setInput('')
    setLoading(true)

    // Add user message
    const userMsg: BotMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      // Call AI bot endpoint
      const res = await fetch('/api/bot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      })
      const data = await res.json()

      if (data.success && data.reply) {
        const botMsg: BotMessage = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          text: data.reply,
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, botMsg])
      } else {
        const botMsg: BotMessage = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          text: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني عبر المحادثة المباشرة.',
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, botMsg])
      }
    } catch {
      const botMsg: BotMessage = {
        id: `bot-${Date.now()}`,
        type: 'bot',
        text: 'عذراً، لم أتمكن من الاتصال. يرجى المحاولة مرة أخرى.',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, botMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!user || !botEnabled) return null

  return (
    <>
      {/* Floating Button */}
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
        {!isOpen && (
          <>
            <span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-emerald-400 rounded-full animate-ping opacity-60" />
            <span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-emerald-400 rounded-full" />
          </>
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
                <p className="text-[10px] text-emerald-100">مساعد ذكي - يجيب تلقائياً</p>
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
          <div className="flex-1 bg-background/95 backdrop-blur-xl border border-emerald-500/20 border-t-0 overflow-y-auto max-h-[50vh] min-h-[250px]">
            <div className="p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id}>
                  {msg.type === 'user' ? (
                    <div className="flex justify-start mb-2">
                      <div className="bg-emerald-500/15 border border-emerald-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                        <div className="flex items-start gap-2">
                          <User className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-foreground">{msg.text}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end mb-2">
                      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                        <div className="flex items-start gap-2">
                          <Bot className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

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
          </div>

          {/* Input Area */}
          <div className="bg-background/95 backdrop-blur-xl border border-emerald-500/20 border-t-0 rounded-b-2xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب سؤالك هنا..."
                className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/40 transition-colors"
                dir="rtl"
              />
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
