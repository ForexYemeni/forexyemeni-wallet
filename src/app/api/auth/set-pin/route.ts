import { NextRequest, NextResponse } from 'next/server'
import { userOperations, notificationOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { userId, pin } = await request.json()

    if (!userId || !pin) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    // PIN must be 4-6 digits
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ success: false, message: 'رمز PIN يجب أن يكون 4-6 أرقام' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // PIN can only be set ONCE - admin must reset if user needs a new one
    if (user.pinHash) {
      return NextResponse.json({ success: false, message: 'رمز PIN تم إعداده مسبقاً ولا يمكن تغييره. يرجى التواصل مع الإدارة.' }, { status: 400 })
    }

    const pinHash = await bcrypt.hash(pin, 10)
    await userOperations.update({ id: userId }, { pinHash })

    // Notify user
    await notificationOperations.create({
      userId,
      title: 'تم تفعيل رمز الحماية',
      message: 'تم إعداد رمز PIN الخاص بك بنجاح. سيُطلب منك إدخاله عند إجراء عمليات السحب.',
      type: 'success',
      read: false,
    })

    return NextResponse.json({ success: true, message: 'تم إعداد رمز PIN بنجاح' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
