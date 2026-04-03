import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' },
        { status: 400 }
      )
    }

    const otpRecord = await db.otpCode.findFirst({
      where: {
        email,
        type: 'password_reset',
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, message: 'رمز التحقق غير صالح أو منتهي الصلاحية' },
        { status: 400 }
      )
    }

    if (otpRecord.code !== code) {
      return NextResponse.json(
        { success: false, message: 'رمز التحقق غير صحيح' },
        { status: 400 }
      )
    }

    await db.otpCode.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    })

    const passwordHash = await bcrypt.hash(newPassword, 12)

    if (otpRecord.userId) {
      await db.user.update({
        where: { id: otpRecord.userId },
        data: { passwordHash },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
