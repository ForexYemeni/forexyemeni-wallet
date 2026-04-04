import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendVerificationEmail } from '@/lib/email'
import { getDb } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني مطلوب' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await userOperations.findUnique({ email })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'هذا البريد الإلكتروني غير مسجل' },
        { status: 404 }
      )
    }

    // Delete old OTPs for this email (email_verify type only)
    const db = getDb()
    try {
      const oldOtps = await db.collection('otpCodes')
        .where('email', '==', email)
        .where('type', '==', 'email_verify')
        .limit(20)
        .get()
      
      const batch = db.batch()
      for (const doc of oldOtps.docs) {
        batch.delete(doc.ref)
      }
      if (oldOtps.docs.length > 0) {
        await batch.commit()
      }
    } catch {
      // If batch delete fails, continue anyway
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await otpCodeOperations.create({
      userId: user.id,
      email,
      code: otp,
      type: 'email_verify',
      expiresAt,
    })

    // Send email
    const emailSent = await sendVerificationEmail(email, otp)

    if (!emailSent) {
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'تم إعادة إرسال رمز التحقق إلى بريدك الإلكتروني'
        : 'تم إنشاء رمز التحقق. يرجى التحقق من بريدك الإلكتروني.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
