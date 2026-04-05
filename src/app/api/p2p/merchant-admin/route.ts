import { NextRequest, NextResponse } from 'next/server'
import { userOperations, merchantOperations } from '@/lib/db-firebase'

// Helper: verify admin
async function verifyAdmin(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return null
  const user = await userOperations.findUnique({ id: userId })
  if (!user || user.role !== 'admin') return null
  return user
}

// GET: list all merchants (admin)
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) return NextResponse.json({ success: false, message: 'غير مصرح - مدير فقط' }, { status: 403 })

    const status = req.nextUrl.searchParams.get('status')
    let merchants
    if (status === 'pending') {
      merchants = await merchantOperations.findPending()
    } else {
      merchants = await merchantOperations.findAll()
    }

    // Attach user info
    const results = await Promise.all(merchants.map(async (m) => {
      const user = await userOperations.findUnique({ id: m.userId })
      return {
        ...m,
        user: user ? { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone } : null,
      }
    }))

    return NextResponse.json({ success: true, merchants: results })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في جلب بيانات التجار' }, { status: 500 })
  }
}

// POST: approve/reject merchant (admin)
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) return NextResponse.json({ success: false, message: 'غير مصرح - مدير فقط' }, { status: 403 })

    const { merchantId, action, reviewNote } = await req.json()
    if (!merchantId || !action) {
      return NextResponse.json({ success: false, message: 'معرف التاجر والإجراء مطلوب' }, { status: 400 })
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, message: 'إجراء غير صالح' }, { status: 400 })
    }

    const merchant = await merchantOperations.findUnique(merchantId)
    if (!merchant) return NextResponse.json({ success: false, message: 'التاجر غير موجود' }, { status: 404 })
    if (merchant.status !== 'pending') return NextResponse.json({ success: false, message: 'الطلب ليس معلقاً' }, { status: 400 })

    const status = action === 'approve' ? 'approved' : 'rejected'
    await merchantOperations.updateStatus(merchantId, status, reviewNote, admin.id)

    // If approved, set merchantId on user
    if (action === 'approve') {
      await userOperations.update({ id: merchant.userId }, { merchantId: merchant.id })
    }

    return NextResponse.json({ success: true, message: action === 'approve' ? 'تم قبول التاجر' : 'تم رفض التاجر' })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في تحديث حالة التاجر' }, { status: 500 })
  }
}
