import { NextRequest, NextResponse } from 'next/server'
import { otpCodeOperations } from '@/lib/db-firebase'
import { getDb, checkAndApplyCustomFirebase } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني ورمز التحقق مطلوبان' },
        { status: 400 }
      )
    }

    await checkAndApplyCustomFirebase()
    const db = getDb()

    const otpRecord = await otpCodeOperations.findFirst({
      where: {
        email,
        type: 'email_verify',
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

    // Mark email as verified in pendingRegistrations (if exists) or users
    if (otpRecord.userId) {
      // Check pendingRegistrations first
      const pendingDoc = await db.collection('pendingRegistrations').doc(otpRecord.userId).get()
      if (pendingDoc.exists) {
        await db.collection('pendingRegistrations').doc(otpRecord.userId).update({ emailVerified: true })
      } else {
        // Fallback: update in users collection
        await db.collection('users').doc(otpRecord.userId).update({ emailVerified: true })
      }
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
