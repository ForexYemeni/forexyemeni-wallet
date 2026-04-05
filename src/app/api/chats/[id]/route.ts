import { NextRequest, NextResponse } from 'next/server'
import { chatOperations, userOperations } from '@/lib/db-firebase'

// GET - get chat messages (with pagination)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role')
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') || undefined

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم والدور مطلوبان' },
        { status: 400 }
      )
    }

    // Verify chat exists
    const chat = await chatOperations.findChat(id)
    if (!chat) {
      return NextResponse.json(
        { success: false, message: 'المحادثة غير موجودة' },
        { status: 404 }
      )
    }

    // Verify user is a participant
    if (!chat.participants.includes(userId)) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح بالدخول' },
        { status: 403 }
      )
    }

    const messages = await chatOperations.findMessages(id, limit, before)

    // Also return chat data with user info for admin
    let chatData = chat
    if (role === 'admin') {
      const chatUser = await userOperations.findUnique({ id: chat.userId })
      chatData = {
        ...chat,
        user: chatUser ? { id: chatUser.id, fullName: chatUser.fullName, email: chatUser.email } : null,
      } as any
    }

    return NextResponse.json({
      success: true,
      chat: chatData,
      messages,
      hasMore: messages.length >= limit,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}

// POST - send message, mark read, or close chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    // Verify chat exists
    const chat = await chatOperations.findChat(id)
    if (!chat) {
      return NextResponse.json(
        { success: false, message: 'المحادثة غير موجودة' },
        { status: 404 }
      )
    }

    // === SEND MESSAGE ===
    if (action === 'send_message') {
      const { senderId, senderType, message, type } = body

      if (!senderId || !senderType || !message) {
        return NextResponse.json(
          { success: false, message: 'جميع الحقول مطلوبة' },
          { status: 400 }
        )
      }

      // Verify sender is participant
      if (!chat.participants.includes(senderId)) {
        return NextResponse.json(
          { success: false, message: 'غير مصرح بالدخول' },
          { status: 403 }
        )
      }

      // Verify closed chat
      if (chat.status === 'closed' && senderType !== 'admin') {
        return NextResponse.json(
          { success: false, message: 'هذه المحادثة مغلقة' },
          { status: 403 }
        )
      }

      const msg = await chatOperations.sendMessage(id, senderId, senderType, message, type || 'text')
      return NextResponse.json({ success: true, message: msg })
    }

    // === MARK READ ===
    if (action === 'mark_read') {
      const { readerType } = body

      if (!readerType) {
        return NextResponse.json(
          { success: false, message: 'نوع القارئ مطلوب' },
          { status: 400 }
        )
      }

      await chatOperations.markRead(id, readerType)
      return NextResponse.json({ success: true })
    }

    // === CLOSE CHAT (admin only) ===
    if (action === 'close_chat') {
      const { userId, role } = body

      if (!userId || role !== 'admin') {
        return NextResponse.json(
          { success: false, message: 'غير مصرح - المدير فقط يمكنه إغلاق المحادثة' },
          { status: 403 }
        )
      }

      // Verify the user is a participant
      if (!chat.participants.includes(userId)) {
        return NextResponse.json(
          { success: false, message: 'غير مصرح بالدخول' },
          { status: 403 }
        )
      }

      await chatOperations.closeChat(id)
      return NextResponse.json({ success: true, message: 'تم إغلاق المحادثة' })
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
