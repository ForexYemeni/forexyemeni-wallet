import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendPhoneVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { userId, phone, country } = await request.json()

    if (!userId || !phone) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم ورقم الهاتف مطلوبان' },
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await otpCodeOperations.create({
      userId,
      email: user.email,
      phone,
      code: otp,
      type: 'phone_verify',
      purpose: `phone:${phone}`,
      expiresAt,
    })

    // Send email with phone verification code
    const emailSent = await sendPhoneVerificationEmail(user.email, phone, otp)

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? `تم إرسال رمز التحقق إلى بريدك الإلكتروني ${user.email} للتحقق من رقم الهاتف` 
        : `تم إنشاء رمز التحقق - تحقق من بريدك ${user.email} (وضع التطوير)`,
      otpId: userId,
      otp, // For testing only - remove in production
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
