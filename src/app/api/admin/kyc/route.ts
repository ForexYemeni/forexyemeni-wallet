import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all KYC records (admin)
export async function GET() {
  try {
    const kycRecords = await db.kYCRecord.findMany({
      include: { user: { select: { id: true, email: true, fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ success: true, kycRecords })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST update KYC status (admin)
export async function POST(request: NextRequest) {
  try {
    const { recordId, status, notes, userId } = await request.json()

    if (!recordId || !status || !userId) {
      return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, message: 'حالة غير صحيحة' }, { status: 400 })
    }

    const updatedRecord = await db.kYCRecord.update({
      where: { id: recordId },
      data: {
        status,
        notes: notes || null,
        reviewedAt: new Date(),
      },
    })

    // Check if all KYC records for this user are approved
    if (status === 'approved') {
      const pendingRecords = await db.kYCRecord.count({
        where: {
          userId,
          status: { in: ['pending'] },
        },
      })

      if (pendingRecords === 0) {
        await db.user.update({
          where: { id: userId },
          data: { kycStatus: 'approved' },
        })

        await db.notification.create({
          data: {
            userId,
            title: 'تم قبول التحقق',
            message: 'تم قبول جميع مستندات التحقق الخاصة بك',
            type: 'success',
          },
        })
      }
    }

    if (status === 'rejected') {
      await db.user.update({
        where: { id: userId },
        data: { kycStatus: 'rejected' },
      })

      await db.notification.create({
        data: {
          userId,
          title: 'تم رفض التحقق',
          message: 'تم رفض أحد مستندات التحقق. يرجى إعادة الرفع.',
          type: 'warning',
        },
      })
    }

    return NextResponse.json({ success: true, kycRecord: updatedRecord })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
