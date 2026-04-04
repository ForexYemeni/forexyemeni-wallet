import { NextRequest, NextResponse } from 'next/server'
import { notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const after = searchParams.get('after')
    const countOnly = searchParams.get('countOnly')

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    // Return unread count only (lightweight, for badge polling)
    if (countOnly === 'true') {
      const unreadCount = await notificationOperations.countUnread(userId)
      return NextResponse.json({ success: true, unreadCount })
    }

    // Return notifications, optionally filtered by timestamp
    const notifications = await notificationOperations.findMany(userId, after || undefined)

    return NextResponse.json({
      success: true,
      notifications,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, title, message, type = 'info' } = await request.json()

    if (!userId || !title || !message) {
      return NextResponse.json(
        { success: false, message: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    const notification = await notificationOperations.create({
      userId,
      title,
      message,
      type,
    })

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
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    await notificationOperations.markAllRead(userId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
