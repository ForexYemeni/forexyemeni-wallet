import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
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

    // Clear pendingConfirmation
    await userOperations.update({ id: userId }, { pendingConfirmation: null })

    return NextResponse.json({ success: true, message: 'تم تأكيد الاستلام بنجاح' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
