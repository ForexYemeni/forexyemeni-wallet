import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendPhoneVerificationEmail } from '@/lib/email'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId, phone, country } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح' },
        { status: 403 }
      )
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, message: 'رقم الهاتف مطلوب' },
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

    const otp = crypto.randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await otpCodeOperations.create({
      userId,
      email: user.email,
      phone,
      code: otp,
      type: 'phone_verify',
      purpose: `phone:${phone}`,
      expiresAt,
      verified: false,
    })

    // Send email with phone verification code
    const emailSent = await sendPhoneVerificationEmail(user.email, phone, otp)

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? `تم إرسال رمز التحقق إلى بريدك الإلكتروني ${user.email} للتحقق من رقم الهاتف` 
        : `تم إنشاء رمز التحقق - تحقق من بريدك ${user.email} (وضع التطوير)`,
      otpId: userId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
