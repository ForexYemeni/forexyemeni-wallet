import { NextRequest, NextResponse } from 'next/server'
import { userOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp, generateId } from '@/lib/firebase'
import { logAudit } from '@/lib/audit-log'
import { sendPushNotification } from '@/lib/push-notification'

// ===================== HELPER: Parse permissions =====================
function parsePermissions(permissions: string | null | undefined): Record<string, boolean> | null {
  if (!permissions) return null
  try {
    if (typeof permissions === 'string') return JSON.parse(permissions) as Record<string, boolean>
    if (typeof permissions === 'object') return permissions as Record<string, boolean>
    return null
  } catch {
    return null
  }
}

// ===================== SUPER ADMIN VERIFICATION =====================
async function verifySuperAdmin(adminId: string): Promise<{ authorized: boolean; user: Awaited<ReturnType<typeof userOperations.findUnique>>; message?: string }> {
  const user = await userOperations.findUnique({ id: adminId })
  if (!user) {
    return { authorized: false, user: null, message: 'المستخدم غير موجود' }
  }
  // Main admin = role 'admin' with no specific permissions enabled
  const parsedPerms = parsePermissions(user.permissions)
  const hasSpecificPermissions = parsedPerms && Object.values(parsedPerms).some(v => v === true)
  const isMainAdmin = user.role === 'admin' && !hasSpecificPermissions
  if (!isMainAdmin) {
    return { authorized: false, user, message: 'ليس لديك صلاحية المدير الرئيسي' }
  }
  return { authorized: true, user }
}

// ===================== POST — Broadcast notifications to users =====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminId, title, message, type, target } = body

    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المدير مطلوب' }, { status: 400 })
    }

    // Verify super admin
    const { authorized, message: authMessage } = await verifySuperAdmin(adminId)
    if (!authorized) {
      return NextResponse.json({ success: false, message: authMessage }, { status: 403 })
    }

    // Validate required fields
    if (!title || !message) {
      return NextResponse.json({ success: false, message: 'عنوان ونص الإشعار مطلوبان' }, { status: 400 })
    }

    // Validate type
    const validTypes = ['info', 'warning', 'urgent', 'success', 'error']
    const notificationType = validTypes.includes(type) ? type : 'info'

    // Validate target
    const validTargets = ['all', 'active', 'merchants']
    const targetGroup = validTargets.includes(target) ? target : 'all'

    const db = getDb()

    // Build the user query based on target
    let usersSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>
    switch (targetGroup) {
      case 'active':
        usersSnapshot = await db.collection('users')
          .where('status', '==', 'active')
          .limit(500)
          .get()
        break
      case 'merchants':
        usersSnapshot = await db.collection('users')
          .where('role', '==', 'admin')
          .where('merchantId', '!=', null)
          .limit(500)
          .get()
        // Fallback: also check users with merchantId set
        if (usersSnapshot.empty) {
          usersSnapshot = await db.collection('users')
            .where('merchantId', '!=', null)
            .limit(500)
            .get()
        }
        break
      default: // 'all'
        usersSnapshot = await db.collection('users').limit(500).get()
        break
    }

    if (usersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'لا يوجد مستخدمين مطابقين',
        data: { sentCount: 0, pushSentCount: 0, target: targetGroup },
      })
    }

    let notificationCount = 0
    let pushSentCount = 0

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id

      try {
        // Create in-app notification
        await notificationOperations.create({
          userId,
          title,
          message,
          type: notificationType,
          read: false,
        })
        notificationCount++
      } catch (err) {
      }

      // Attempt to send FCM push notification
      try {
        const pushResult = await sendPushNotification(userId, title, message, notificationType)
        if (pushResult.sent) {
          pushSentCount += pushResult.count
        }
      } catch (err) {
      }
    }

    // Audit log
    await logAudit(
      adminId,
      'settings_change',
      'broadcast',
      targetGroup,
      title,
      `إرسال إشعار جماعي [${targetGroup}]: ${title} (${notificationCount} إشعار داخلي, ${pushSentCount} إشعار دفع)`
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      message: `تم إرسال الإشعار بنجاح إلى ${notificationCount} مستخدم`,
      data: {
        sentCount: notificationCount,
        pushSentCount,
        target: targetGroup,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء إرسال الإشعار'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
