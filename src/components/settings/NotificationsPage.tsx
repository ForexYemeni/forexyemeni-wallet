'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  Bell,
  Check,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
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
      const res = await fetch(`/api/notifications?userId=${user.id}`)
      const data = await res.json()
      if (data.success) setNotifications(data.notifications)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
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
      default: return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-6 animate-fade-in">
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
            className="text-xs text-gold hover:text-gold-light"
          >
            <Check className="w-3 h-3 ml-1" />
            قراءة الكل
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-4 shimmer h-20 rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Bell className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">لا توجد إشعارات</p>
          <p className="text-xs text-muted-foreground/50 mt-1">ستظهر الإشعارات هنا عند وجود تحديثات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`glass-card glass-card-hover p-4 rounded-xl space-y-2 ${
                !notif.read ? 'border-gold/20 bg-gold/[0.02]' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {getTypeIcon(notif.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold truncate">{notif.title}</h3>
                    {!notif.read && (
                      <span className="w-2 h-2 bg-gold rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                  <p className="text-xs text-muted-foreground/50 mt-2">{formatDate(notif.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
