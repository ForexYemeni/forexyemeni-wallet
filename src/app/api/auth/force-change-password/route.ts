import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId, newPassword } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح' },
        { status: 403 }
      )
    }

    if (!newPassword) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور الجديدة مطلوبة' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' },
        { status: 400 }
      )
    }

    const user = await userOperations.findUnique({ id: userId })
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

    const newHash = await bcrypt.hash(newPassword, 12)

    await userOperations.update({ id: userId }, {
      passwordHash: newHash,
      mustChangePassword: false,
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
