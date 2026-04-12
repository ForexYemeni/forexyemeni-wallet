import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendPasswordResetEmail } from '@/lib/email'
import { getDb } from '@/lib/firebase'
import crypto from 'crypto'

// Rate limit: max 3 forgot-password attempts per IP per 15 minutes
const forgotAttempts = new Map<string, { count: number; resetAt: number }>()
const FORGOT_MAX = 3
const FORGOT_WINDOW = 15 * 60 * 1000

function checkForgotRateLimit(ip: string): boolean {
  const now = Date.now()
  let entry = forgotAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    forgotAttempts.set(ip, { count: 1, resetAt: now + FORGOT_WINDOW })
    return true
  }
  if (entry.count >= FORGOT_MAX) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkForgotRateLimit(clientIp)) {
      return NextResponse.json(
        { success: false, message: 'عدد المحاولات كثير. انتظر 15 دقيقة ثم حاول مرة أخرى.' },
        { status: 429 }
      )
    }

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

    // Admin accounts use PIN-based recovery, not standard OTP password reset
    if (user.role === 'admin') {
      // Delete old admin_reset OTPs for this email
      const db = getDb()
      try {
        const oldOtps = await db.collection('otpCodes')
          .where('email', '==', email)
          .where('type', '==', 'admin_password_reset')
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

      const otp = crypto.randomInt(100000, 1000000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await otpCodeOperations.create({
        userId: user.id,
        email,
        code: otp,
        type: 'admin_password_reset',
        expiresAt,
      })

      // Send email
      const emailSent = await sendPasswordResetEmail(email, otp)

      if (!emailSent) {
      }

      return NextResponse.json({
        success: true,
        isAdmin: true,
        hasPIN: !!user.pinHash,
        hasPhone: !!user.phone,
        message: emailSent
          ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
          : 'تم إنشاء رمز التحقق. يرجى التحقق من بريدك الإلكتروني.',
        userId: user.id,
      })
    }

    // Normal user flow - standard password reset
    // Delete old password_reset OTPs for this email
    const db = getDb()
    try {
      const oldOtps = await db.collection('otpCodes')
        .where('email', '==', email)
        .where('type', '==', 'password_reset')
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

    const otp = crypto.randomInt(100000, 1000000).toString()
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

    if (!emailSent) {
    }

    return NextResponse.json({
      success: true,
      isAdmin: false,
      message: emailSent
        ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
        : 'تم إنشاء رمز التحقق. يرجى التحقق من بريدك الإلكتروني.',
      otpId: user.id,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
