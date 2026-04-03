import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني مطلوب' },
        { status: 400 }
      )
    }

    const user = await userOperations.findUnique({ email })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'هذا البريد الإلكتروني غير مسجل' },
        { status: 404 }
      )
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await otpCodeOperations.create({
      userId: user.id,
      email,
      code: otp,
      type: 'password_reset',
      expiresAt,
    })

    // Send email
    const emailSent = await sendPasswordResetEmail(email, otp)

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' 
        : 'تم إنشاء رمز التحقق (وضع التطوير)',
      otpId: user.id,
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
