'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  MessageCircle,
  Send,
  ArrowRight,
  Plus,
  Loader2,
  X,
  Check,
  CheckCheck,
  Clock,
} from 'lucide-react'

// ===================== TYPES =====================

interface ChatItem {
  id: string
  userId: string
  adminId: string
  participants: string[]
  lastMessage: string
  lastMessageAt: string
  lastMessageBy: string
  userUnreadCount: number
  adminUnreadCount: number
  status: string
  createdAt: string
  updatedAt: string
}

interface ChatMessageItem {
  id: string
  chatId: string
  senderId: string
  senderType: string
  message: string
  type: string
  imageUrl?: string | null
  read: boolean
  createdAt: string
}

// ===================== HELPER =====================

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'الآن'
  if (minutes < 60) return `منذ ${minutes} د`
  if (hours < 24) return `منذ ${hours} س`
  if (days < 7) return `منذ ${days} ي`
  return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.substring(0, len) + '...'
}

// ===================== CHAT LIST ITEM =====================

function ChatListItem({
  chat,
  isSelected,
  onClick,
}: {
  chat: ChatItem
  isSelected: boolean
  onClick: () => void
}) {
  const unreadCount = chat.userUnreadCount || 0
  const isClosed = chat.status === 'closed'

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl text-right transition-all ${
        isSelected
          ? 'bg-gold/10 border border-gold/20'
          : 'hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isClosed ? 'bg-muted/30' : 'gold-gradient'
        }`}>
          <MessageCircle className={`w-5 h-5 ${isClosed ? 'text-muted-foreground' : 'text-gray-900'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">الدعم الفني</span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {formatTime(chat.lastMessageAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-muted-foreground truncate flex-1">
              {isClosed && (
                <span className="text-red-400/60 ml-1">[مغلقة]</span>
              )}
              {chat.lastMessageBy === 'user' ? 'أنت: ' : ''}{truncate(chat.lastMessage, 35)}
            </p>
            {unreadCount > 0 && (
              <span className="min-w-5 h-5 bg-gold text-gray-900 text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 flex-shrink-0">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ===================== MESSAGE BUBBLE =====================

function MessageBubble({ msg, isUser }: { msg: ChatMessageItem; isUser: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} animate-fade-in`}>
      <div className={`max-w-[80%] md:max-w-[65%] ${isUser ? 'order-1' : 'order-1'}`}>
        {/* Admin label */}
        {!isUser && (
          <p className="text-[10px] text-gold font-medium mb-1 mr-1 flex items-center gap-1">
            <CheckCheck className="w-3 h-3" />
            الدعم الفني
          </p>
        )}
        {/* User label */}
        {isUser && (
          <p className="text-[10px] text-muted-foreground mb-1 ml-1">أنت</p>
        )}
        {/* Bubble */}
        <div
          className={`px-4 py-2.5 rounded-2xl ${
            isUser
              ? 'bg-white/5 border border-white/10 rounded-bl-md'
              : 'gold-gradient text-gray-900 rounded-br-md'
          }`}
        >
          {msg.type === 'image' && msg.imageUrl ? (
            <img
              src={msg.imageUrl}
              alt="صورة"
              className="max-w-full rounded-xl mb-1"
              loading="lazy"
            />
          ) : null}
          {msg.message && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
          )}
        </div>
        {/* Time and read status */}
        <div className={`flex items-center gap-1 mt-1 ${isUser ? 'ml-1' : 'mr-1'}`}>
          <span className="text-[10px] text-muted-foreground/60">
            {formatMessageTime(msg.createdAt)}
          </span>
          {isUser && (
            msg.read
              ? <CheckCheck className="w-3 h-3 text-gold" />
              : <Check className="w-3 h-3 text-muted-foreground/40" />
          )}
        </div>
      </div>
    </div>
  )
}

// ===================== MAIN COMPONENT =====================

export default function ChatPage() {
  const { user } = useAuthStore()
  const [chats, setChats] = useState<ChatItem[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [firstMessage, setFirstMessage] = useState('')
  const [creatingChat, setCreatingChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Get selected chat data
  const selectedChat = chats.find(c => c.id === selectedChatId) || null

  // Fetch chats
  const fetchChats = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/chats?userId=${user.id}&role=user`)
      const data = await res.json()
      if (data.success) {
        setChats(data.chats || [])
      }
    } catch {
      // silent
    } finally {
      setLoadingChats(false)
    }
  }, [user?.id])

  // Fetch messages for selected chat
  const fetchMessages = useCallback(async (chatId: string) => {
    if (!user?.id) return
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/chats/${chatId}?userId=${user.id}&role=user`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages || [])
        // Mark as read
        fetch(`/api/chats/${chatId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read', readerType: 'user' }),
        }).catch(() => {})
      }
    } catch {
      // silent
    } finally {
      setLoadingMessages(false)
    }
  }, [user?.id])

  // Initial load
  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  // Select first chat if none selected
  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      const openChat = chats.find(c => c.status === 'open')
      setSelectedChatId(openChat?.id || chats[0]?.id || null)
    }
  }, [chats, selectedChatId])

  // Fetch messages when chat selected
  useEffect(() => {
    if (selectedChatId) {
      fetchMessages(selectedChatId)
    }
  }, [selectedChatId, fetchMessages])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Polling for new messages (every 3 seconds)
  useEffect(() => {
    if (!selectedChatId || !user?.id) return

    pollingRef.current = setInterval(async () => {
      try {
        // Poll chat list for unread counts
        const chatsRes = await fetch(`/api/chats?userId=${user.id}&role=user`)
        const chatsData = await chatsRes.json()
        if (chatsData.success) {
          setChats(chatsData.chats || [])
        }

        // Poll messages if we have messages and are viewing
        if (messages.length > 0) {
          const lastMsgTime = messages[messages.length - 1].createdAt
          const msgRes = await fetch(
            `/api/chats/${selectedChatId}?userId=${user.id}&role=user&limit=50`
          )
          const msgData = await msgRes.json()
          if (msgData.success && msgData.messages) {
            const newMsgs = msgData.messages.filter(
              (m: ChatMessageItem) => !messages.find(om => om.id === m.id)
            )
            if (newMsgs.length > 0) {
              setMessages(msgData.messages)
              // Mark as read
              fetch(`/api/chats/${selectedChatId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_read', readerType: 'user' }),
              }).catch(() => {})
            }
          }
        }
      } catch {
        // silent - polling should not show errors
      }
    }, 3000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [selectedChatId, user?.id, messages.length])

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChatId || !user?.id || sendingMessage) return
    setSendingMessage(true)
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          chatId: selectedChatId,
          senderId: user.id,
          senderType: 'user',
          message: newMessage.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewMessage('')
        // Optimistically add message
        setMessages(prev => [...prev, data.message])
        // Refresh chat list
        fetchChats()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ في إرسال الرسالة')
    } finally {
      setSendingMessage(false)
      inputRef.current?.focus()
    }
  }

  // Create new chat
  const handleCreateChat = async () => {
    if (!firstMessage.trim() || !user?.id || creatingChat) return
    setCreatingChat(true)
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_chat',
          userId: user.id,
          message: firstMessage.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setFirstMessage('')
        setShowNewChat(false)
        setSelectedChatId(data.chat.id)
        fetchChats()
        toast.success(data.existingChat ? 'تم إرسال الرسالة' : 'تم إنشاء المحادثة')
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setCreatingChat(false)
    }
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold gold-text flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            الدعم الفني
          </h1>
          <p className="text-sm text-muted-foreground">تواصل مع فريق الدعم</p>
        </div>
        <Button
          onClick={() => setShowNewChat(true)}
          className="gold-gradient text-gray-900 font-bold rounded-xl h-9 px-4 gap-2 text-xs hover:opacity-90"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          محادثة جديدة
        </Button>
      </div>

      {/* New Chat Dialog */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewChat(false)}>
          <div className="glass-card p-6 space-y-4 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold gold-text">محادثة جديدة</h2>
              <button onClick={() => setShowNewChat(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">اكتب رسالتك الأولى للتواصل مع الدعم الفني</p>
            <textarea
              value={firstMessage}
              onChange={e => setFirstMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              className="w-full h-28 rounded-xl glass-input p-3 text-sm resize-none"
              dir="rtl"
              autoFocus
            />
            <Button
              onClick={handleCreateChat}
              disabled={!firstMessage.trim() || creatingChat}
              className="w-full gold-gradient text-gray-900 font-bold rounded-xl h-11 gap-2 hover:opacity-90"
            >
              {creatingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال
            </Button>
          </div>
        </div>
      )}

      {/* Chat Layout */}
      <div className="glass-card rounded-2xl overflow-hidden min-h-[60vh] max-h-[75vh] flex flex-col">
        {loadingChats ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-gold" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-medium">لا توجد محادثات</p>
              <p className="text-sm text-muted-foreground">ابدأ محادثة جديدة مع الدعم الفني</p>
            </div>
            <Button
              onClick={() => setShowNewChat(true)}
              className="gold-gradient text-gray-900 font-bold rounded-xl gap-2 hover:opacity-90"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              بدء محادثة
            </Button>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full">
            {/* Chat List - Side */}
            <div className={`w-full md:w-72 border-b md:border-b-0 md:border-l border-gold/10 flex-shrink-0 ${
              selectedChatId ? 'hidden md:block' : 'block'
            }`}>
              <div className="p-3 border-b border-gold/10">
                <p className="text-xs text-muted-foreground font-medium px-2">المحادثات ({chats.length})</p>
              </div>
              <div className="overflow-y-auto max-h-[200px] md:max-h-[65vh]">
                {chats.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isSelected={chat.id === selectedChatId}
                    onClick={() => setSelectedChatId(chat.id)}
                  />
                ))}
              </div>
            </div>

            {/* Messages Area */}
            <div className={`flex-1 flex flex-col min-h-0 ${
              selectedChatId ? 'flex' : 'hidden md:flex'
            }`}>
              {/* Chat Header */}
              {selectedChat && (
                <div className="p-4 border-b border-gold/10 flex items-center justify-between flex-shrink-0">
                  <button
                    onClick={() => setSelectedChatId(null)}
                    className="md:hidden w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-gray-900" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">الدعم الفني</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        {selectedChat.status === 'open' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            متصل
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3 text-red-400" />
                            مغلقة
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gold" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-2">
                    <MessageCircle className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">لا توجد رسائل بعد</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isUser={msg.senderType === 'user'}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedChat && selectedChat.status !== 'closed' && (
                <div className="p-4 border-t border-gold/10 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={inputRef}
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="اكتب رسالتك..."
                      className="flex-1 h-11 rounded-xl glass-input border-0 text-sm"
                      dir="rtl"
                      disabled={sendingMessage}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sendingMessage}
                      className="h-11 w-11 rounded-xl gold-gradient text-gray-900 hover:opacity-90 flex-shrink-0"
                      size="icon"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Closed chat notice */}
              {selectedChat && selectedChat.status === 'closed' && (
                <div className="p-4 border-t border-gold/10 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <X className="w-3 h-3 text-red-400" />
                    هذه المحادثة مغلقة
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
