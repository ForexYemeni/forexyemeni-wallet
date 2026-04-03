import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'

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

    return NextResponse.json({
      success: true,
      message: `تم إرسال رمز التحقق إلى بريدك الإلكتروني ${user.email} للتحقق من رقم الهاتف`,
      otpId: userId,
      otp, // For testing only
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
