import { apiFetch } from '@/lib/api-client'
'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  Bell,
  Check,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Shield,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

function getTimeGroup(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'اليوم'
  if (diffDays === 1) return 'أمس'
  if (diffDays < 7) return 'هذا الأسبوع'
  if (diffDays < 30) return 'هذا الشهر'
  return 'أقدم'
}

function groupNotifications(notifications: Notification[]): { group: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {}
  for (const notif of notifications) {
    const group = getTimeGroup(notif.createdAt)
    if (!groups[group]) groups[group] = []
    groups[group].push(notif)
  }
  const seen = new Set<string>()
  const ordered: { group: string; items: Notification[] }[] = []
  for (const notif of notifications) {
    const group = getTimeGroup(notif.createdAt)
    if (!seen.has(group)) {
      seen.add(group)
      ordered.push({ group, items: groups[group] })
    }
  }
  return ordered
}

export default function NotificationsPage() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) fetchNotifications()
  }, [user?.id])

  const fetchNotifications = async () => {
    if (!user?.id) return
    try {
      const res = await apiFetch(`/api/notifications?userId=${user.id}`)
      const data = await res.json()
      if (data.success) setNotifications(data.notifications)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const markAllRead = async () => {
    if (!user?.id) return
    try {
      await apiFetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
    } catch {
      // Fallback to local-only
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'error': return <XCircle className="w-5 h-5 text-red-400" />
      case 'chat': return <MessageCircle className="w-5 h-5 text-blue-400" />
      case 'deposit': return <ArrowDownLeft className="w-5 h-5 text-green-400" />
      case 'withdrawal': return <ArrowUpRight className="w-5 h-5 text-red-400" />
      case 'bonus': return <TrendingUp className="w-5 h-5 text-gold" />
      case 'kyc': return <Shield className="w-5 h-5 text-indigo-400" />
      default: return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'success': case 'deposit': return 'bg-green-500/10'
      case 'warning': case 'bonus': return 'bg-yellow-500/10'
      case 'error': case 'withdrawal': return 'bg-red-500/10'
      case 'kyc': return 'bg-indigo-500/10'
      case 'chat': return 'bg-blue-500/10'
      default: return 'bg-blue-500/10'
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const grouped = groupNotifications(notifications)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold">الإشعارات</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : 'لا توجد إشعارات جديدة'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            className="text-xs text-gold hover:text-gold-light tap-effect"
          >
            <Check className="w-3 h-3 ml-1" />
            قراءة الكل
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3 stagger-list">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="glass-card p-4 space-y-2"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-2">
                <div className="skeleton-circle w-8 h-8 shrink-0" />
                <div className="skeleton-line w-2/3" />
              </div>
              <div className="skeleton-line w-full h-3" />
              <div className="skeleton-line w-1/4 h-3" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card p-8 text-center empty-state-enhanced">
          <div className="empty-state-icon">
            <Bell className="w-12 h-12 text-gold/20 mx-auto mb-3" />
          </div>
          <p className="text-muted-foreground text-sm">لا توجد إشعارات</p>
          <p className="text-xs text-muted-foreground/50 mt-1">ستظهر الإشعارات هنا عند وجود تحديثات</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              {/* Time group header */}
              <div className="time-group-header px-1">
                <p className="text-xs font-bold gold-text">{group}</p>
              </div>

              {/* Notifications in group */}
              <div className="space-y-2 stagger-list">
                {items.map((notif, index) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.read) markAsRead(notif.id)
                      const screenMap: Record<string, string> = {
                        success: 'dashboard', warning: 'dashboard', error: 'dashboard',
                        info: 'notifications', chat: 'chat', deposit: 'deposit',
                        withdrawal: 'withdraw', transfer: 'dashboard', kyc: 'kyc',
                        bonus: 'dashboard',
                      }
                      const target = screenMap[notif.type] || 'dashboard'
                      useAuthStore.getState().setScreen(target)
                    }}
                    className={`glass-card notif-card rounded-xl p-4 cursor-pointer tap-effect ${
                      notif.read ? '' : `unread type-${notif.type}`
                    }`}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getTypeBg(notif.type)}`}>
                        {getTypeIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className={`text-sm truncate ${notif.read ? 'font-medium' : 'font-bold'}`}>
                            {notif.title}
                          </h3>
                          {!notif.read && (
                            <span className="w-2 h-2 bg-gold rounded-full flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-2">{formatDate(notif.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
