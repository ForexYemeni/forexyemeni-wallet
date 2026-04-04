import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendVerificationEmail } from '@/lib/email'
import { getDb, generateAffiliateCode } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'صيغة البريد الإلكتروني غير صحيحة' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' },
        { status: 400 }
      )
    }

    const existingUser = await userOperations.findUnique({ email })
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await userOperations.create({
      email,
      passwordHash,
      fullName: fullName || null,
      phone: null,
      country: null,
      role: 'user',
      status: 'active',
      emailVerified: false,
      phoneVerified: false,
      kycStatus: 'none',
      kycIdPhoto: null,
      kycSelfie: null,
      kycNotes: null,
      balance: 0,
      frozenBalance: 0,
      mustChangePassword: false,
      referredBy: null,
      merchantId: null,
      affiliateCode: generateAffiliateCode(),
    })

    // Delete any old OTPs for this email to avoid confusion
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
      // Continue even if delete fails
    }

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
        ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' 
        : 'تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني.',
      otpId: user.id,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في التسجيل'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
