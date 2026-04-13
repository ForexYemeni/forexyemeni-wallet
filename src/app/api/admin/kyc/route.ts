import { NextRequest, NextResponse } from 'next/server'
import { userOperations, kycRecordOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { sendUserKycApprovedEmail, sendUserKycRejectedEmail } from '@/lib/email'
import { requireAdmin } from '@/lib/auth-server'
import { getDb } from '@/lib/firebase'

// GET all KYC records (admin)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
  try {
    const kycRecords = await kycRecordOperations.findMany()

    return NextResponse.json({ success: true, kycRecords }, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST update KYC status (admin)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
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
      // Clean up stale pending records for this user (duplicates from re-uploads)
      try {
        const db = getDb()
        const stalePending = await db.collection('kycRecords')
          .where('userId', '==', userId)
          .where('status', '==', 'pending')
          .get()
        if (!stalePending.empty) {
          const batch = db.batch()
          for (const doc of stalePending.docs) {
            batch.delete(doc.ref)
          }
          await batch.commit()
        }
      } catch (cleanupErr) {
        console.warn('[KYC Approve] Could not clean stale records:', cleanupErr)
      }

      // Now count remaining pending (should be 0 after cleanup)
      const pendingRecords = await kycRecordOperations.countPending(userId)

      if (pendingRecords === 0) {
        await userOperations.update({ id: userId }, { kycStatus: 'approved' })

        const title = 'تم قبول التحقق'
        const message = 'تم قبول جميع مستندات التحقق الخاصة بك'
        await notificationOperations.create({ userId, title, message, type: 'success', read: false })
        sendPushNotification(userId, title, message, 'success').catch(() => {})

        // Send email to user
        try {
          const kycUser = await userOperations.findUnique({ id: userId })
          if (kycUser) {
            sendUserKycApprovedEmail(kycUser.email, kycUser.fullName || kycUser.email)
          }
        } catch {}
      }
    }

    if (status === 'rejected') {
      await userOperations.update({ id: userId }, { kycStatus: 'rejected' })

      const reason = adminNote ? ` (${adminNote})` : ''
      const title = 'تم رفض التحقق'
      const message = `تم رفض أحد مستندات التحقق. يرجى إعادة الرفع.${reason}`
      await notificationOperations.create({ userId, title, message, type: 'warning', read: false })
      sendPushNotification(userId, title, message, 'warning').catch(() => {})

      // Send email to user
      try {
        const kycUser = await userOperations.findUnique({ id: userId })
        if (kycUser) {
          sendUserKycRejectedEmail(kycUser.email, kycUser.fullName || kycUser.email, adminNote || '')
        }
      } catch {}
    }

    return NextResponse.json({ success: true, kycRecord: updatedRecord })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
