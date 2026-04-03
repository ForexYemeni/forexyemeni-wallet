import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

const TEMP_ADMIN_PASSWORD = 'admin123admin123admin123'

export async function POST(request: NextRequest) {
  try {
    const { userId, newPassword } = await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم وكلمة المرور الجديدة مطلوبان' },
        { status: 400 }
      )
    }

    // Validate new password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' },
        { status: 400 }
      )
    }

    if (newPassword === TEMP_ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, message: 'لا يمكن استخدام كلمة المرور المؤقتة. اختر كلمة مرور مختلفة.' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    if (!user.mustChangePassword) {
      return NextResponse.json(
        { success: false, message: 'هذا الطلب غير مطلوب' },
        { status: 400 }
      )
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 12)

    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في تغيير كلمة المرور'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
