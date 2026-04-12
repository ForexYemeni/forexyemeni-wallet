import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId, code } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    if (!code) {
      return NextResponse.json(
        { success: false, message: 'رمز التحقق مطلوب' },
        { status: 400 }
      )
    }

    const otpRecord = await otpCodeOperations.findFirst({
      where: {
        userId,
        type: 'phone_verify',
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

    await otpCodeOperations.update(otpRecord.id, { verified: true })

    const phone = otpRecord.phone || (otpRecord.purpose?.replace('phone:', '')) || null

    await userOperations.update({ id: userId }, {
      phoneVerified: true,
      phone,
      kycStatus: 'pending',
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
