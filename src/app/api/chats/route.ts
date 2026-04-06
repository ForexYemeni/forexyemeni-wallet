import { NextRequest, NextResponse } from 'next/server'
import { chatOperations, userOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { getDb } from '@/lib/firebase'

// GET - list chats for user or admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role')

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم والدور مطلوبان' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const chats = await chatOperations.findChats({ userId, role })

    // For admin, also fetch user info for each chat
    if (role === 'admin') {
      const userIds = [...new Set(chats.map(c => c.userId))]
      const userDocs = await Promise.all(userIds.map(uid => userOperations.findUnique({ id: uid })))
      const userMap = new Map<string, { id: string; fullName: string | null; email: string }>()
      for (const u of userDocs) {
        if (u) {
          userMap.set(u.id, { id: u.id, fullName: u.fullName, email: u.email })
        }
      }
      const enrichedChats = chats.map(chat => ({
        ...chat,
        user: userMap.get(chat.userId) || null,
      }))
      // Filter out chats with deleted users (user document no longer exists)
      const validChats = enrichedChats.filter(c => c.user !== null)

      // Cleanup: delete orphan chats where user no longer exists
      const orphanChats = enrichedChats.filter(c => c.user === null)
      if (orphanChats.length > 0) {
        try {
          const db = getDb()
          const batch = db.batch()
          for (const chat of orphanChats) {
            batch.delete(db.collection('chats').doc(chat.id))
          }
          await batch.commit()
        } catch (cleanupErr) {
          console.warn('[chats] Failed to cleanup orphan chats:', cleanupErr)
        }
      }

      return NextResponse.json({ success: true, chats: validChats })
    }

    return NextResponse.json({ success: true, chats })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}

// POST - create new chat or send message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // === CREATE CHAT ===
    if (action === 'create_chat') {
      const { userId, message } = body

      if (!userId || !message) {
        return NextResponse.json(
          { success: false, message: 'معرف المستخدم والرسالة مطلوبان' },
          { status: 400 }
        )
      }

      // Verify user exists
      const user = await userOperations.findUnique({ id: userId })
      if (!user) {
        return NextResponse.json(
          { success: false, message: 'المستخدم غير موجود' },
          { status: 404 }
        )
      }

      // Find admin user — search specifically for admin role
      const adminSnapshot = await userOperations.findMany({ take: 50 })
      const admin = adminSnapshot.find(u => u.role === 'admin')
      if (!admin) {
        return NextResponse.json(
          { success: false, message: 'لم يتم العثور على الإدارة' },
          { status: 404 }
        )
      }

      // Check if user already has an open chat
      const existingChats = await chatOperations.findChats({ userId, role: 'user' })
      const openChat = existingChats.find(c => c.status === 'open')

      if (openChat) {
        // Send message to existing open chat instead
        const msg = await chatOperations.sendMessage(openChat.id, userId, 'user', message)

        // Notify admin
        try {
          const pushTitle = '📩 رسالة جديدة من العميل'
          const pushBody = message.length > 100 ? message.substring(0, 100) + '...' : message
          await notificationOperations.create({ userId: openChat.adminId, title: pushTitle, message: pushBody, type: 'chat', read: false })
          sendPushNotification(openChat.adminId, pushTitle, pushBody, 'info').catch(() => {})
        } catch {}

        return NextResponse.json({
          success: true,
          chat: openChat,
          message: msg,
          existingChat: true,
        })
      }

      const chat = await chatOperations.createChat(userId, admin.id, message)

      // Send automatic welcome message from admin to user
      const welcomeMsg = 'مرحباً! كيف يمكننا مساعدتك اليوم؟ 😊'
      await chatOperations.sendMessage(chat.id, admin.id, 'admin', welcomeMsg)

      // Notify admin about new chat
      try {
        const pushTitle = '📩 محادثة جديدة'
        const pushBody = message.length > 100 ? message.substring(0, 100) + '...' : message
        await notificationOperations.create({ userId: admin.id, title: pushTitle, message: pushBody, type: 'chat', read: false })
        sendPushNotification(admin.id, pushTitle, pushBody, 'info').catch(() => {})
      } catch {}
      return NextResponse.json({
        success: true,
        chat,
        message: chat.lastMessage,
        existingChat: false,
      })
    }

    // === ADMIN START CHAT ===
    if (action === 'admin_start_chat') {
      const { userId, targetUserId } = body

      if (!userId || !targetUserId) {
        return NextResponse.json(
          { success: false, message: 'معرف المستخدم والهدف مطلوبان' },
          { status: 400 }
        )
      }

      // Verify admin exists
      const admin = await userOperations.findUnique({ id: userId })
      if (!admin || (admin.role !== 'admin' && !admin.permissions)) {
        return NextResponse.json(
          { success: false, message: 'غير مصرح - المدير فقط' },
          { status: 403 }
        )
      }

      // Verify target user exists
      const targetUser = await userOperations.findUnique({ id: targetUserId })
      if (!targetUser) {
        return NextResponse.json(
          { success: false, message: 'المستخدم غير موجود' },
          { status: 404 }
        )
      }

      // Check if chat already exists between admin and this user
      const existingChats = await chatOperations.findChats({ userId: admin.id, role: 'admin' })
      const existingChat = existingChats.find(c => c.userId === targetUserId)

      if (existingChat) {
        // Return existing chat
        return NextResponse.json({
          success: true,
          chat: existingChat,
          existingChat: true,
        })
      }

      // Create new chat with admin's welcome message
      const welcomeMsg = 'مرحباً! كيف يمكننا مساعدتك؟'
      const chat = await chatOperations.createChat(targetUserId, admin.id, welcomeMsg, 'admin')

      // Notify user about new admin message
      try {
        const pushTitle = '📩 رسالة جديدة من الدعم الفني'
        await notificationOperations.create({ userId: targetUserId, title: pushTitle, message: welcomeMsg, type: 'chat', read: false })
        sendPushNotification(targetUserId, pushTitle, welcomeMsg, 'info').catch(() => {})
      } catch {}

      return NextResponse.json({
        success: true,
        chat,
        existingChat: false,
      })
    }

    // === REOPEN CHAT ===
    if (action === 'reopen_chat') {
      const { chatId, userId, role } = body

      if (!chatId || !userId) {
        return NextResponse.json(
          { success: false, message: 'معرف المحادثة والمستخدم مطلوبان' },
          { status: 400 }
        )
      }

      // Only admin can reopen
      if (role !== 'admin') {
        return NextResponse.json(
          { success: false, message: 'غير مصرح - المدير فقط' },
          { status: 403 }
        )
      }

      const db = getDb()
      const chatDoc = await db.collection('chats').doc(chatId).get()
      if (!chatDoc.exists) {
        return NextResponse.json(
          { success: false, message: 'المحادثة غير موجودة' },
          { status: 404 }
        )
      }

      await chatDoc.ref.update({
        status: 'open',
        updatedAt: new Date().toISOString(),
      })

      return NextResponse.json({ success: true, message: 'تم إعادة فتح المحادثة' })
    }

    // === SEND MESSAGE (existing chat) ===
    if (action === 'send_message') {
      const { chatId, senderId, senderType, message, type } = body

      if (!chatId || !senderId || !senderType || !message) {
        return NextResponse.json(
          { success: false, message: 'جميع الحقول مطلوبة' },
          { status: 400 }
        )
      }

      // Verify chat exists
      const chat = await chatOperations.findChat(chatId)
      if (!chat) {
        return NextResponse.json(
          { success: false, message: 'المحادثة غير موجودة' },
          { status: 404 }
        )
      }

      // Verify sender is a participant
      if (!chat.participants.includes(senderId)) {
        return NextResponse.json(
          { success: false, message: 'غير مصرح بالدخول' },
          { status: 403 }
        )
      }

      // Verify closed chat (only admin can send in closed)
      if (chat.status === 'closed' && senderType !== 'admin') {
        return NextResponse.json(
          { success: false, message: 'هذه المحادثة مغلقة' },
          { status: 403 }
        )
      }

      const msg = await chatOperations.sendMessage(chatId, senderId, senderType, message, type || 'text')

      // Notify recipient
      try {
        const recipientId = senderType === 'user' ? chat.adminId : chat.userId
        const senderName = senderType === 'admin' ? 'الدعم الفني' : 'العميل'
        const pushTitle = `📩 رسالة جديدة من ${senderName}`
        const pushBody = message.length > 100 ? message.substring(0, 100) + '...' : message
        await notificationOperations.create({ userId: recipientId, title: pushTitle, message: pushBody, type: 'chat', read: false })
        sendPushNotification(recipientId, pushTitle, pushBody, 'info').catch(() => {})
      } catch {}

      return NextResponse.json({ success: true, message: msg })
    }

    return NextResponse.json(
      { success: false, message: 'إجراء غير معروف' },
      { status: 400 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
