import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { userId, code } = await request.json()

    if (!userId || !code) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم ورمز التحقق مطلوبان' },
        { status: 400 }
      )
    }

    const otpRecord = await db.otpCode.findFirst({
      where: {
        userId,
        type: 'phone_verify',
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

    await db.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        phone: otpRecord.phone || otpRecord.purpose?.replace('phone:', '') || null,
        kycStatus: 'pending',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'تم التحقق من رقم الهاتف بنجاح',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
