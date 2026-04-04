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
  Loader2,
  X,
  Check,
  CheckCheck,
  Shield,
  Clock,
} from 'lucide-react'

// ===================== TYPES =====================

interface AdminChatItem {
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
  user?: { id: string; fullName: string | null; email: string } | null
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

// ===================== HELPERS =====================

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

// ===================== ADMIN CHAT LIST ITEM =====================

function AdminChatListItem({
  chat,
  isSelected,
  onClick,
}: {
  chat: AdminChatItem
  isSelected: boolean
  onClick: () => void
}) {
  const unreadCount = chat.adminUnreadCount || 0
  const isClosed = chat.status === 'closed'
  const userName = chat.user?.fullName || chat.user?.email || 'مستخدم'

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
          isClosed ? 'bg-muted/30' : 'bg-gold/10'
        }`}>
          {isClosed ? (
            <X className="w-5 h-5 text-muted-foreground" />
          ) : (
            <MessageCircle className="w-5 h-5 text-gold" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{userName}</span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {formatTime(chat.lastMessageAt)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">
            {chat.user?.email}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-muted-foreground truncate flex-1">
              {chat.lastMessageBy === 'admin' ? 'أنت: ' : ''}{truncate(chat.lastMessage, 30)}
            </p>
            {unreadCount > 0 && (
              <span className="min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 flex-shrink-0">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ===================== ADMIN MESSAGE BUBBLE =====================

function AdminMessageBubble({ msg }: { msg: ChatMessageItem }) {
  const isAdmin = msg.senderType === 'admin'
  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className="max-w-[80%] md:max-w-[65%]">
        {/* Label */}
        {isAdmin ? (
          <p className="text-[10px] text-gold font-medium mb-1 ml-1 flex items-center gap-1 justify-end">
            أنت
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground mb-1 mr-1">المستخدم</p>
        )}
        {/* Bubble */}
        <div
          className={`px-4 py-2.5 rounded-2xl ${
            isAdmin
              ? 'gold-gradient text-gray-900 rounded-br-md'
              : 'bg-white/5 border border-white/10 rounded-bl-md'
          }`}
        >
          {msg.type === 'image' && msg.imageUrl && (
            <img src={msg.imageUrl} alt="صورة" className="max-w-full rounded-xl mb-1" loading="lazy" />
          )}
          {msg.message && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
          )}
        </div>
        {/* Time */}
        <div className={`flex items-center gap-1 mt-1 ${isAdmin ? 'ml-1 justify-end' : 'mr-1'}`}>
          <span className="text-[10px] text-muted-foreground/60">
            {formatMessageTime(msg.createdAt)}
          </span>
          {isAdmin && (
            msg.read
              ? <CheckCheck className="w-3 h-3 text-green-400" />
              : <Check className="w-3 h-3 text-muted-foreground/40" />
          )}
        </div>
      </div>
    </div>
  )
}

// ===================== MAIN ADMIN CHAT COMPONENT =====================

export default function AdminChat() {
  const { user } = useAuthStore()
  const [chats, setChats] = useState<AdminChatItem[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [closingChat, setClosingChat] = useState(false)
  const [selectedChatData, setSelectedChatData] = useState<AdminChatItem | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch chats (for admin - all chats)
  const fetchChats = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/chats?userId=${user.id}&role=admin`)
      const data = await res.json()
      if (data.success) {
        const sorted = (data.chats || []).sort((a: AdminChatItem, b: AdminChatItem) => {
          // Open chats with unread first, then by time
          const aUnread = a.adminUnreadCount || 0
          const bUnread = b.adminUnreadCount || 0
          if (aUnread > 0 && bUnread === 0) return -1
          if (aUnread === 0 && bUnread > 0) return 1
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        })
        setChats(sorted)
      }
    } catch {
      // silent
    } finally {
      setLoadingChats(false)
    }
  }, [user?.id])

  // Fetch messages
  const fetchMessages = useCallback(async (chatId: string) => {
    if (!user?.id) return
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/chats/${chatId}?userId=${user.id}&role=admin`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages || [])
        if (data.chat) {
          setSelectedChatData(data.chat)
        }
        // Mark as read
        fetch(`/api/chats/${chatId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read', readerType: 'admin' }),
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

  // Fetch messages when chat selected
  useEffect(() => {
    if (selectedChatId) {
      fetchMessages(selectedChatId)
    }
  }, [selectedChatId, fetchMessages])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Polling
  useEffect(() => {
    if (!selectedChatId || !user?.id) return

    pollingRef.current = setInterval(async () => {
      try {
        // Poll chat list
        const chatsRes = await fetch(`/api/chats?userId=${user.id}&role=admin`)
        const chatsData = await chatsRes.json()
        if (chatsData.success) {
          const sorted = (chatsData.chats || []).sort((a: AdminChatItem, b: AdminChatItem) => {
            const aUnread = a.adminUnreadCount || 0
            const bUnread = b.adminUnreadCount || 0
            if (aUnread > 0 && bUnread === 0) return -1
            if (aUnread === 0 && bUnread > 0) return 1
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          })
          setChats(sorted)
        }

        // Poll messages
        if (messages.length > 0) {
          const msgRes = await fetch(
            `/api/chats/${selectedChatId}?userId=${user.id}&role=admin&limit=50`
          )
          const msgData = await msgRes.json()
          if (msgData.success && msgData.messages) {
            const existingIds = new Set(messages.map(m => m.id))
            const newMsgs = msgData.messages.filter((m: ChatMessageItem) => !existingIds.has(m.id))
            if (newMsgs.length > 0) {
              setMessages(msgData.messages)
              if (msgData.chat) setSelectedChatData(msgData.chat)
              fetch(`/api/chats/${selectedChatId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_read', readerType: 'admin' }),
              }).catch(() => {})
            }
          }
        }
      } catch {
        // silent
      }
    }, 3000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [selectedChatId, user?.id, messages.length, fetchChats])

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChatId || !user?.id || sendingMessage) return
    setSendingMessage(true)
    try {
      const res = await fetch(`/api/chats/${selectedChatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          senderId: user.id,
          senderType: 'admin',
          message: newMessage.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewMessage('')
        setMessages(prev => [...prev, data.message])
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

  // Close chat
  const handleCloseChat = async () => {
    if (!selectedChatId || !user?.id || closingChat) return
    setClosingChat(true)
    try {
      const res = await fetch(`/api/chats/${selectedChatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_chat',
          userId: user.id,
          role: 'admin',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم إغلاق المحادثة')
        fetchChats()
        if (selectedChatData) {
          setSelectedChatData({ ...selectedChatData, status: 'closed' })
        }
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setClosingChat(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Get user info
  const chatUser = selectedChatData?.user
  const totalUnread = chats.reduce((sum, c) => sum + (c.adminUnreadCount || 0), 0)

  return (
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
            <p className="text-sm text-muted-foreground">ستظهر المحادثات الجديدة هنا</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row h-full">
          {/* Chat List */}
          <div className={`w-full md:w-80 border-b md:border-b-0 md:border-l border-gold/10 flex-shrink-0 ${
            selectedChatId ? 'hidden md:block' : 'block'
          }`}>
            <div className="p-3 border-b border-gold/10 flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">
                المحادثات ({chats.length})
              </p>
              {totalUnread > 0 && (
                <span className="min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="overflow-y-auto max-h-[200px] md:max-h-[68vh]">
              {chats.map(chat => (
                <AdminChatListItem
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
            {selectedChatData && (
              <div className="p-4 border-b border-gold/10 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => setSelectedChatId(null)}
                  className="md:hidden w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold font-bold text-sm">
                    {(chatUser?.fullName || chatUser?.email || 'م').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[150px]">
                      {chatUser?.fullName || 'مستخدم'}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[150px]" dir="ltr">
                      {chatUser?.email}
                    </p>
                  </div>
                </div>
                {selectedChatData.status === 'open' ? (
                  <Button
                    onClick={handleCloseChat}
                    disabled={closingChat}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs gap-1"
                  >
                    {closingChat ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    إغلاق
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted/20 px-2 py-1 rounded-md">
                    <X className="w-3 h-3 text-red-400" />
                    مغلقة
                  </span>
                )}
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
                  <AdminMessageBubble key={msg.id} msg={msg} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input (admin can always send, even in closed chats) */}
            {selectedChatData && (
              <div className="p-4 border-t border-gold/10 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب ردك..."
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
          </div>
        </div>
      )}
    </div>
  )
}
