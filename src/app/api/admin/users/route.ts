import { NextRequest, NextResponse } from 'next/server'
import { userOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb } from '@/lib/firebase'
import { sendPushNotification } from '@/lib/push-notification'

// GET all users (admin)
export async function GET() {
  try {
    const users = await userOperations.findMany({
      take: 200,
    })

    return NextResponse.json({ success: true, users })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST update user (admin)
export async function POST(request: NextRequest) {
  try {
    const { userId, status, role, balance, balanceAdjustment, kycStatus, notes, permissions, merchantId, approvePinReset, rejectPinReset } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    // Handle PIN reset approval
    if (approvePinReset) {
      const db = getDb()
      const pendingDoc = await db.collection('pendingPinReset').doc(userId).get()
      if (!pendingDoc.exists) {
        return NextResponse.json({ success: false, message: 'لا يوجد طلب معلق لإعادة تعيين PIN' }, { status: 400 })
      }

      // Clear user's pinHash so they'll be prompted to set a new one
      await userOperations.update({ id: userId }, { pinHash: null as any })

      // Delete the pending request
      await db.collection('pendingPinReset').doc(userId).delete()

      // Notify user
      const targetUser = await userOperations.findUnique({ id: userId })
      if (targetUser) {
        await notificationOperations.create({
          userId,
          title: 'تم الموافقة على إعادة تعيين PIN',
          message: 'تمت الموافقة على طلبك. يرجى إعداد رمز PIN جديد عند تسجيل الدخول.',
          type: 'success',
          read: false,
        })
        await sendPushNotification(userId, 'تم الموافقة على إعادة تعيين PIN', 'يرجى إعداد رمز PIN جديد عند تسجيل الدخول.', 'success')
      }

      return NextResponse.json({ success: true, message: 'تمت الموافقة على إعادة تعيين PIN' })
    }

    // Handle PIN reset rejection
    if (rejectPinReset) {
      const db = getDb()
      const pendingDoc = await db.collection('pendingPinReset').doc(userId).get()
      if (!pendingDoc.exists) {
        return NextResponse.json({ success: false, message: 'لا يوجد طلب معلق لإعادة تعيين PIN' }, { status: 400 })
      }

      // Delete the pending request
      await db.collection('pendingPinReset').doc(userId).delete()

      // Notify user
      await notificationOperations.create({
        userId,
        title: 'تم رفض طلب إعادة تعيين PIN',
        message: 'تم رفض طلبك لإعادة تعيين رمز PIN. يرجى التواصل مع الإدارة إذا كنت بحاجة إلى مساعدة.',
        type: 'error',
        read: false,
      })
      await sendPushNotification(userId, 'تم رفض طلب إعادة تعيين PIN', 'يرجى التواصل مع الإدارة إذا كنت بحاجة إلى مساعدة.', 'error')

      return NextResponse.json({ success: true, message: 'تم رفض طلب إعادة تعيين PIN' })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (role) updateData.role = role
    if (typeof balance === 'number') updateData.balance = balance
    if (typeof balanceAdjustment === 'number' && balanceAdjustment !== 0) {
      const targetUser = await userOperations.findUnique({ id: userId })
      if (!targetUser) {
        return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
      }
      const newBalance = Math.max(0, (targetUser.balance || 0) + balanceAdjustment)
      updateData.balance = newBalance
    }
    if (kycStatus) updateData.kycStatus = kycStatus
    if (notes !== undefined) updateData.kycNotes = notes
    if (permissions) updateData.permissions = JSON.stringify(permissions)
    if (merchantId !== undefined) updateData.merchantId = merchantId

    const user = await userOperations.update({ id: userId }, updateData)

    // Send notifications based on what was changed
    try {
      // Account suspension notification
      if (status === 'suspended') {
        await notificationOperations.create({
          userId,
          title: 'تم تعليق حسابك',
          message: 'تم تعليق حسابك بواسطة الإدارة. يرجى التواصل مع الدعم للمزيد من المعلومات.',
          type: 'error',
          read: false,
        })
        await sendPushNotification(userId, 'تم تعليق حسابك', 'تم تعليق حسابك بواسطة الإدارة.', 'error')
      }

      // Account reactivation notification
      if (status === 'active') {
        await notificationOperations.create({
          userId,
          title: 'تم تفعيل حسابك',
          message: 'تم تفعيل حسابك بنجاح. يمكنك الآن استخدام جميع الخدمات.',
          type: 'success',
          read: false,
        })
        await sendPushNotification(userId, 'تم تفعيل حسابك', 'تم تفعيل حسابك بنجاح.', 'success')
      }

      // Balance adjustment notification
      if (typeof balanceAdjustment === 'number' && balanceAdjustment !== 0) {
        const targetUser = await userOperations.findUnique({ id: userId })
        const newBalance = targetUser ? (targetUser.balance || 0) : 0
        const isAdd = balanceAdjustment > 0
        await notificationOperations.create({
          userId,
          title: isAdd ? 'تم إيداع مبلغ في حسابك' : 'تم خصم مبلغ من حسابك',
          message: `${isAdd ? 'إضافة' : 'سحب'} ${Math.abs(balanceAdjustment).toFixed(2)} USDT بواسطة الإدارة. رصيدك الجديد: ${newBalance.toFixed(2)} USDT`,
          type: isAdd ? 'success' : 'warning',
          read: false,
        })
        await sendPushNotification(userId, isAdd ? 'إيداع في حسابك' : 'خصم من حسابك', `${isAdd ? '+' : '-'}${Math.abs(balanceAdjustment).toFixed(2)} USDT`, isAdd ? 'success' : 'warning')
      }

      // Merchant status removal notification
      if (merchantId === null) {
        await notificationOperations.create({
          userId,
          title: 'تم إزالة حالة التاجر',
          message: 'تم تحويل حسابك من تاجر إلى مستخدم عادي بواسطة الإدارة.',
          type: 'warning',
          read: false,
        })
        await sendPushNotification(userId, 'تم إزالة حالة التاجر', 'تم تحويل حسابك إلى مستخدم عادي.', 'warning')
      }
    } catch (notifErr) {
      console.error('Error sending user notification:', notifErr)
    }

    return NextResponse.json({ success: true, user })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
