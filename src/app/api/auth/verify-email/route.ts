import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني ورمز التحقق مطلوبان' },
        { status: 400 }
      )
    }

    const otpRecord = await db.otpCode.findFirst({
      where: {
        email,
        type: 'email_verify',
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

    if (otpRecord.userId) {
      await db.user.update({
        where: { id: otpRecord.userId },
        data: { emailVerified: true },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'تم تفعيل البريد الإلكتروني بنجاح',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في التحقق'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
