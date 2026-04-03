import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword, isAdmin, pin, adminNumber, newEmail } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني ورمز التحقق مطلوبان' },
        { status: 400 }
      )
    }

    const otpRecord = await otpCodeOperations.findFirst({
      where: {
        email,
        type: isAdmin ? 'admin_password_reset' : 'password_reset',
        verified: false,
      },
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

    // For admin: verify OTP only, don't reset password yet
    if (isAdmin) {
      await otpCodeOperations.update(otpRecord.id, { verified: true })
      return NextResponse.json({
        success: true,
        otpVerified: true,
        message: 'تم التحقق من الرمز بنجاح',
        userId: otpRecord.userId,
      })
    }

    // Normal user: verify OTP and change password directly
    if (!newPassword) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور الجديدة مطلوبة' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' },
        { status: 400 }
      )
    }

    await otpCodeOperations.update(otpRecord.id, { verified: true })

    const passwordHash = await bcrypt.hash(newPassword, 12)

    if (otpRecord.userId) {
      await userOperations.update({ id: otpRecord.userId }, { passwordHash })
    }

    return NextResponse.json({
      success: true,
      otpVerified: true,
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
