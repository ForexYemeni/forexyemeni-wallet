import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp } from '@/lib/firebase'
import { logAudit } from '@/lib/audit-log'

// ===================== SUPER ADMIN VERIFICATION =====================
async function verifySuperAdmin(adminId: string): Promise<{ authorized: boolean; user: Awaited<ReturnType<typeof userOperations.findUnique>>; message?: string }> {
  const user = await userOperations.findUnique({ id: adminId })
  if (!user) {
    return { authorized: false, user: null, message: 'المستخدم غير موجود' }
  }
  const isMainAdmin = user.role === 'admin' && !user.permissions
  if (!isMainAdmin) {
    return { authorized: false, user, message: 'ليس لديك صلاحية المدير الرئيسي' }
  }
  return { authorized: true, user }
}

// ===================== GET — Fetch login attempts with filters =====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('adminId')
    const status = searchParams.get('status') // 'success' | 'fail' | undefined (all)
    const startDate = searchParams.get('startDate') // ISO string
    const endDate = searchParams.get('endDate') // ISO string
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 100

    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المدير مطلوب' }, { status: 400 })
    }

    // Verify super admin
    const { authorized, message } = await verifySuperAdmin(adminId)
    if (!authorized) {
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    const db = getDb()

    // Build query with filters
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('loginAttempts')

    // Filter by status
    if (status === 'success' || status === 'fail') {
      query = query.where('success', '==', status === 'success')
    }

    // Filter by date range (startDate)
    if (startDate) {
      const start = new Date(startDate)
      if (!isNaN(start.getTime())) {
        query = query.where('createdAt', '>=', start.toISOString())
      }
    }

    // Filter by date range (endDate)
    if (endDate) {
      const end = new Date(endDate)
      if (!isNaN(end.getTime())) {
        query = query.where('createdAt', '<=', end.toISOString())
      }
    }

    // Apply limit
    const safeLimit = Math.min(Math.max(limit, 1), 500)
    query = query.limit(safeLimit)

    const snapshot = await query.get()

    // Process results and sort by createdAt descending
    const loginAttempts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const timeA = new Date((a as Record<string, unknown>).createdAt as string).getTime() || 0
        const timeB = new Date((b as Record<string, unknown>).createdAt as string).getTime() || 0
        return timeB - timeA
      })

    // Calculate summary stats
    const totalFetched = loginAttempts.length
    const successCount = loginAttempts.filter(
      (a: Record<string, unknown>) => a.success === true
    ).length
    const failCount = totalFetched - successCount

    // Unique IPs in results
    const uniqueIPs = new Set(
      loginAttempts
        .map((a: Record<string, unknown>) => a.ip as string)
        .filter(Boolean)
    )

    // Unique emails/userIds in results
    const uniqueUsers = new Set(
      loginAttempts
        .map((a: Record<string, unknown>) => a.email || a.userId as string)
        .filter(Boolean)
    )

    return NextResponse.json({
      success: true,
      data: {
        loginAttempts,
        summary: {
          total: totalFetched,
          successCount,
          failCount,
          uniqueIPs: uniqueIPs.size,
          uniqueUsers: uniqueUsers.size,
        },
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب محاولات الدخول'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// ===================== POST — Clear old login attempts =====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminId, action, olderThanDays } = body

    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المدير مطلوب' }, { status: 400 })
    }

    // Verify super admin
    const { authorized, message } = await verifySuperAdmin(adminId)
    if (!authorized) {
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    if (action !== 'clear') {
      return NextResponse.json({ success: false, message: 'إجراء غير معروف. استخدم "clear" لمسح المحاولات.' }, { status: 400 })
    }

    const db = getDb()

    // Calculate cutoff date
    const daysToKeep = typeof olderThanDays === 'number' ? olderThanDays : 30
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Fetch login attempts older than the cutoff date
    let deletedCount = 0
    let snapshot = await db.collection('loginAttempts')
      .where('createdAt', '<', cutoffDate.toISOString())
      .limit(500)
      .get()

    while (snapshot.size > 0) {
      const batch = db.batch()
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref)
      }
      await batch.commit()
      deletedCount += snapshot.size
      snapshot = await db.collection('loginAttempts')
        .where('createdAt', '<', cutoffDate.toISOString())
        .limit(500)
        .get()
    }

    // Audit log
    await logAudit(
      adminId,
      'system_cleanup',
      'loginAttempts',
      'all',
      `محاولات الدخول (${deletedCount})`,
      `مسح محاولات الدخول الأقدم من ${daysToKeep} يوم: ${deletedCount} سجل`
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      message: `تم مسح ${deletedCount} سجل من محاولات الدخول الأقدم من ${daysToKeep} يوم`,
      data: { deletedCount, cutoffDate: cutoffDate.toISOString() },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء مسح محاولات الدخول'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
