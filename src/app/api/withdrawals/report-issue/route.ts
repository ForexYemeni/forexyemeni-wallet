import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { getDb } from '@/lib/firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId, withdrawalId, message } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    if (!withdrawalId || !message) {
      return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (message.trim().length < 10) {
      return NextResponse.json({ success: false, message: 'يرجى كتابة وصف مفصل للمشكلة (10 أحرف على الأقل)' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    const db = getDb()

    const reportRef = db.collection('withdrawalReports').doc()
    await reportRef.set({
      userId,
      withdrawalId,
      message: message.trim(),
      userName: user.fullName || user.email,
      userEmail: user.email,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })

    try {
      const adminDocs = await db.collection('users').where('role', '==', 'admin').limit(10).get()
      for (const adminDoc of adminDocs.docs) {
        await sendPushNotification(
          adminDoc.id,
          'بلاغ: مشكلة في سحب',
          `المستخدم ${user.fullName || user.email} أبلغ عن مشكلة في سحب #${withdrawalId.substring(0, 8)}...`,
          'error',
          { withdrawalId, userId, reportId: reportRef.id }
        )
      }
    } catch (notifyErr) {
      console.error('[report-issue] Failed to send admin notification:', notifyErr)
    }

    return NextResponse.json({ success: true, message: 'تم إرسال البلاغ بنجاح' })
  } catch (error: unknown) {
    console.error('[report-issue] Error:', error)
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 })
  }
}
