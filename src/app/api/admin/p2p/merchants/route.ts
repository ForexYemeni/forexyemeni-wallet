import { NextRequest, NextResponse } from 'next/server'
import { userOperations, merchantApplicationOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

// Helper: verify admin
async function verifyAdmin(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return null
  const user = await userOperations.findUnique({ id: userId })
  if (!user || (user.role !== 'admin' && user.email !== ADMIN_EMAIL)) return null
  return user
}

// GET: list all merchant applications (pending first)
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح - مدير فقط' }, { status: 403 })
    }

    // Fetch pending first, then all
    const pendingApplications = await merchantApplicationOperations.findMany({ status: 'pending' })
    const allApplications = await merchantApplicationOperations.findMany({ status: 'all' })

    // Get non-pending applications
    const nonPending = allApplications.filter((a) => a.status !== 'pending')

    // Combine: pending first, then the rest sorted by date
    const combined = [...pendingApplications, ...nonPending]

    // Attach user info
    const results = await Promise.all(
      combined.map(async (app) => {
        const appUser = await userOperations.findUnique({ id: app.userId })
        return {
          ...app,
          user: appUser
            ? {
                id: appUser.id,
                email: appUser.email,
                fullName: appUser.fullName,
                phone: appUser.phone,
                status: appUser.status,
              }
            : null,
        }
      })
    )

    return NextResponse.json({
      success: true,
      applications: results,
      pendingCount: pendingApplications.length,
      totalCount: combined.length,
    })
  } catch (error: any) {
    console.error('[Admin P2P Merchants GET]', error)
    return NextResponse.json({ success: false, message: 'خطأ في جلب طلبات التجار' }, { status: 500 })
  }
}

// POST: approve or reject merchant application
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح - مدير فقط' }, { status: 403 })
    }

    const { action, adminId, applicationId, rejectionReason } = await req.json()

    if (!action || !adminId || !applicationId) {
      return NextResponse.json({ success: false, message: 'الإجراء ومعرف المدير ومعرف الطلب مطلوبون' }, { status: 400 })
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, message: 'إجراء غير صالح. يجب أن يكون قبول أو رفض' }, { status: 400 })
    }

    // Verify admin
    if (admin.id !== adminId && admin.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Find application
    const application = await merchantApplicationOperations.findById(applicationId)
    if (!application) {
      return NextResponse.json({ success: false, message: 'الطلب غير موجود' }, { status: 404 })
    }

    if (application.status !== 'pending') {
      return NextResponse.json({ success: false, message: 'الطلب ليس في حالة معلقة' }, { status: 400 })
    }

    if (action === 'approve') {
      await merchantApplicationOperations.approve(applicationId, adminId)

      // Set merchantId on user
      await userOperations.update({ id: application.userId }, { merchantId: applicationId })

      // Notify user
      await notificationOperations.create({
        userId: application.userId,
        title: 'تم قبول طلب التوثيق',
        message: 'تهانينا! تم قبول طلب توثيق التاجر الخاص بك. يمكنك الآن إنشاء طلبات P2P.',
        type: 'p2p',
        read: false,
      })
      sendPushNotification(application.userId, 'تم قبول طلب التوثيق', 'تم الموافقة على حسابك كتاجر P2P. يمكنك الآن إنشاء إعلانات.', 'success').catch(() => {})

      return NextResponse.json({ success: true, message: 'تم قبول طلب التاجر بنجاح' })
    }

    if (action === 'reject') {
      if (!rejectionReason) {
        return NextResponse.json({ success: false, message: 'سبب الرفض مطلوب' }, { status: 400 })
      }

      await merchantApplicationOperations.reject(applicationId, adminId, rejectionReason)

      // Notify user
      await notificationOperations.create({
        userId: application.userId,
        title: 'تم رفض طلب التوثيق',
        message: `تم رفض طلب توثيق التاجر الخاص بك. السبب: ${rejectionReason}`,
        type: 'p2p',
        read: false,
      })
      sendPushNotification(application.userId, 'تم رفض طلب التوثيق', 'تم رفض طلب توثيق التاجر. يمكنك إعادة التقديم.', 'error').catch(() => {})

      return NextResponse.json({ success: true, message: 'تم رفض طلب التاجر' })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير صالح' }, { status: 400 })
  } catch (error: any) {
    console.error('[Admin P2P Merchants POST]', error)
    return NextResponse.json({ success: false, message: 'خطأ في تحديث حالة طلب التاجر' }, { status: 500 })
  }
}
