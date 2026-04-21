import { NextRequest, NextResponse } from 'next/server'
import { notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { getDb } from '@/lib/firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

// Simple in-memory cache for unread counts (TTL: 15s)
// This prevents Firestore reads on every 30s poll
const unreadCountCache = new Map<string, { count: number; ts: number }>()
const CACHE_TTL = 15000

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const after = searchParams.get('after')
    const countOnly = searchParams.get('countOnly')
    const includeUnread = searchParams.get('includeUnread')

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Return unread count only (lightweight, for badge polling)
    // OPTIMIZED: Uses cached value when available (< 15s old)
    if (countOnly === 'true') {
      const cached = unreadCountCache.get(userId)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return NextResponse.json({ success: true, unreadCount: cached.count })
      }

      const unreadCount = await notificationOperations.countUnread(userId)
      unreadCountCache.set(userId, { count: unreadCount, ts: Date.now() })
      return NextResponse.json({ success: true, unreadCount })
    }

    // Return notifications, optionally filtered by timestamp
    const notifications = await notificationOperations.findMany(userId, after || undefined)

    // Get unread count (from cache or fresh)
    let unreadCount = 0
    if (includeUnread === 'true') {
      const cached = unreadCountCache.get(userId)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        unreadCount = cached.count
      } else {
        unreadCount = await notificationOperations.countUnread(userId)
        unreadCountCache.set(userId, { count: unreadCount, ts: Date.now() })
      }
    }

    return NextResponse.json({
      success: true,
      notifications,
      ...(includeUnread === 'true' ? { unreadCount } : {}),
    }, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId, title, message, type = 'info' } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    if (!title || !message) {
      return NextResponse.json(
        { success: false, message: 'جميع الحقول مطلوب' },
        { status: 400 }
      )
    }

    const notification = await notificationOperations.create({
      userId,
      title,
      message,
      type,
      read: false,
    })

    // Invalidate unread count cache for this user
    unreadCountCache.delete(userId)

    // Also send push notification (FCM) if user has registered tokens
    sendPushNotification(userId, title, message, type).catch(() => {})

    return NextResponse.json({
      success: true,
      notification,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    await notificationOperations.markAllRead(userId)

    // Invalidate unread count cache
    unreadCountCache.delete(userId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
