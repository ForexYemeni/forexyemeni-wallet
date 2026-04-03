import { NextRequest, NextResponse } from 'next/server'
import { userOperations, kycRecordOperations, notificationOperations } from '@/lib/db-firebase'

// GET all KYC records (admin)
export async function GET() {
  try {
    const kycRecords = await kycRecordOperations.findMany()

    return NextResponse.json({ success: true, kycRecords })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST update KYC status (admin)
export async function POST(request: NextRequest) {
  try {
    const { recordId, status, adminNote, userId } = await request.json()

    if (!recordId || !status || !userId) {
      return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, message: 'حالة غير صحيحة' }, { status: 400 })
    }

    const updatedRecord = await kycRecordOperations.update(recordId, {
      status,
      notes: adminNote || null,
      reviewedAt: new Date().toISOString(),
    })

    if (status === 'approved') {
      const pendingRecords = await kycRecordOperations.countPending(userId)

      if (pendingRecords === 0) {
        await userOperations.update({ id: userId }, { kycStatus: 'approved' })

        await notificationOperations.create({
          userId,
          title: 'تم قبول التحقق',
          message: 'تم قبول جميع مستندات التحقق الخاصة بك',
          type: 'success',
        })
      }
    }

    if (status === 'rejected') {
      await userOperations.update({ id: userId }, { kycStatus: 'rejected' })

      const reason = adminNote ? ` (${adminNote})` : ''
      await notificationOperations.create({
        userId,
        title: 'تم رفض التحقق',
        message: `تم رفض أحد مستندات التحقق. يرجى إعادة الرفع.${reason}`,
        type: 'warning',
      })
    }

    return NextResponse.json({ success: true, kycRecord: updatedRecord })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
