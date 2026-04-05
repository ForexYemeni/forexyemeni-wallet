import { NextRequest, NextResponse } from 'next/server'
import { userOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb } from '@/lib/firebase'
import { sendPushNotification } from '@/lib/push-notification'

// Find admin users to notify
async function getAdminUsers() {
  const db = getDb()
  const snapshot = await db.collection('users')
    .where('role', '==', 'admin')
    .limit(10)
    .get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (!user.pinHash) {
      return NextResponse.json({ success: false, message: 'لم يتم إعداد رمز PIN بعد' }, { status: 400 })
    }

    // Check if there's already a pending request
    const db = getDb()
    const existingRequest = await db.collection('pendingPinReset').doc(userId).get()
    if (existingRequest.exists) {
      const data = existingRequest.data()
      // Allow re-request if last one was more than 5 minutes ago
      const requestedAt = data!.requestedAt as string
      const fiveMinAgo = Date.now() - 5 * 60 * 1000
      if (new Date(requestedAt).getTime() > fiveMinAgo) {
        return NextResponse.json({ success: false, message: 'لديك طلب معلق بالفعل، يرجى الانتظار 5 دقائق' }, { status: 400 })
      }
    }

    // Create pending request
    await db.collection('pendingPinReset').doc(userId).set({
      userId,
      userEmail: user.email,
      userFullName: user.fullName || '',
      requestedAt: new Date().toISOString(),
      status: 'pending',
    })

    // Notify user
    await notificationOperations.create({
      userId,
      title: 'تم إرسال طلب إعادة تعيين PIN',
      message: 'تم إرسال طلبك للإدارة. سيتم مراجعته والرد عليك قريباً.',
      type: 'info',
      read: false,
    })

    // Notify all admins
    const admins = await getAdminUsers()
    for (const admin of admins) {
      await notificationOperations.create({
        userId: admin.id,
        title: 'طلب إعادة تعيين PIN',
        message: `طلب من ${user.fullName || user.email} إعادة تعيين رمز PIN الخاص به.`,
        type: 'warning',
        read: false,
      })
      await sendPushNotification(admin.id, 'طلب إعادة تعيين PIN', `طلب من ${user.fullName || user.email} إعادة تعيين رمز PIN.`, 'warning')
    }

    return NextResponse.json({ success: true, message: 'تم إرسال الطلب بنجاح' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// GET: check if there's a pending PIN reset request (admin use)
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      // Return all pending requests
      const db = getDb()
      const snapshot = await db.collection('pendingPinReset')
        .where('status', '==', 'pending')
        .limit(50)
        .get()
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Sort by requestedAt desc in JS to avoid composite index
      requests.sort((a, b) => new Date((b as any).requestedAt).getTime() - new Date((a as any).requestedAt).getTime())
      return NextResponse.json({ success: true, requests })
    }

    const db = getDb()
    const doc = await db.collection('pendingPinReset').doc(userId).get()
    if (!doc.exists) {
      return NextResponse.json({ success: true, hasRequest: false })
    }
    return NextResponse.json({ success: true, hasRequest: true, request: { id: doc.id, ...doc.data() } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
