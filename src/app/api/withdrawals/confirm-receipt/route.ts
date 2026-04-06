import { NextRequest, NextResponse } from 'next/server'
import { userOperations, withdrawalOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { userId, withdrawalId, password } = await request.json()

    if (!userId || !withdrawalId || !password) {
      return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 })
    }

    // Check pendingConfirmation matches
    if (user.pendingConfirmation !== withdrawalId) {
      return NextResponse.json({ success: false, message: 'لا يوجد طلب تأكيد معلق' }, { status: 400 })
    }

    // Clear pendingConfirmation on user
    await userOperations.update({ id: userId }, { pendingConfirmation: null })

    // Update withdrawal status to 'completed'
    try {
      await withdrawalOperations.update(withdrawalId, { status: 'completed' })
    } catch (updateErr) {
      console.error('[confirm-receipt] Failed to update withdrawal status:', updateErr)
      // Don't fail the whole request — user already confirmed
    }

    // Send push notification to all admin users
    try {
      const db = (await import('@/lib/firebase')).getDb()
      const adminDocs = await db.collection('users').where('role', '==', 'admin').limit(10).get()
      for (const adminDoc of adminDocs.docs) {
        const adminId = adminDoc.id
        const withdrawal = await withdrawalOperations.findUnique(withdrawalId)
        const amount = withdrawal?.amount || 0
        await sendPushNotification(
          adminId,
          'تأكيد استلام سحب',
          `المستخدم ${user.fullName || user.email} أكد استلام سحب بقيمة ${amount.toFixed(2)} USDT`,
          'success',
          { withdrawalId, userId }
        )
      }
    } catch (notifyErr) {
      console.error('[confirm-receipt] Failed to send admin notification:', notifyErr)
      // Don't fail the whole request
    }

    return NextResponse.json({ success: true, message: 'تم تأكيد الاستلام بنجاح' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    console.error('[confirm-receipt] Error:', error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
