import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { userOperations } from '@/lib/db-firebase'

export async function POST(request: NextRequest) {
  try {
    const { adminId, action, reportId } = await request.json()

    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المدير مطلوب' }, { status: 400 })
    }

    // Verify admin
    const admin = await userOperations.findUnique({ id: adminId })
    if (!admin || (admin.role !== 'admin' && !admin.permissions?.manageSettings)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const db = getDb()

    if (action === 'list') {
      // Fetch all reports, newest first
      const snapshot = await db.collection('withdrawalReports')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()

      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      return NextResponse.json({ success: true, reports })
    }

    if (action === 'resolve') {
      if (!reportId) {
        return NextResponse.json({ success: false, message: 'معرف البلاغ مطلوب' }, { status: 400 })
      }
      await db.collection('withdrawalReports').doc(reportId).update({
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: adminId,
      })
      return NextResponse.json({ success: true, message: 'تم حل البلاغ' })
    }

    if (action === 'delete') {
      if (!reportId) {
        return NextResponse.json({ success: false, message: 'معرف البلاغ مطلوب' }, { status: 400 })
      }
      await db.collection('withdrawalReports').doc(reportId).delete()
      return NextResponse.json({ success: true, message: 'تم حذف البلاغ' })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    console.error('[withdrawal-reports] Error:', error)
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 })
  }
}
