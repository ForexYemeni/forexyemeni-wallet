import { NextRequest, NextResponse } from 'next/server'
import { otpCodeOperations } from '@/lib/db-firebase'
import { sendVerificationEmail } from '@/lib/email'
import { getDb, generateAffiliateCode, generateAccountNumber, checkAndApplyCustomFirebase } from '@/lib/firebase'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Rate limit: max 5 registrations per IP per minute
const registerAttempts = new Map<string, { count: number; resetAt: number }>()
const REGISTER_MAX = 5
const REGISTER_WINDOW = 60 * 1000

function checkRegisterRateLimit(ip: string): boolean {
  const now = Date.now()
  let entry = registerAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    registerAttempts.set(ip, { count: 1, resetAt: now + REGISTER_WINDOW })
    return true
  }
  if (entry.count >= REGISTER_MAX) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRegisterRateLimit(clientIp)) {
      return NextResponse.json(
        { success: false, message: 'عدد محاولات التسجيل كثير. انتظر دقيقة ثم حاول مرة أخرى.' },
        { status: 429 }
      )
    }

    await checkAndApplyCustomFirebase()
    const db = getDb()

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

    // Step 1: Check if email already registered (in users OR pendingRegistrations)
    const existingUser = await db.collection('users').where('email', '==', email).limit(1).get()
    if (!existingUser.empty) {
      return NextResponse.json(
        { success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل' },
        { status: 400 }
      )
    }

    const existingPending = await db.collection('pendingRegistrations').where('email', '==', email).limit(1).get()
    if (!existingPending.empty) {
      // Delete old pending registration and allow re-register
      await db.collection('pendingRegistrations').doc(existingPending.docs[0].id).delete()
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // Step 2: Store in pendingRegistrations (NOT in users collection)
    const pendingId = db.collection('pendingRegistrations').doc().id
    await db.collection('pendingRegistrations').doc(pendingId).set({
      email,
      passwordHash,
      fullName: fullName || null,
      createdAt: new Date().toISOString(),
      emailVerified: false,
    })

    // Step 3: Create OTP
    const otp = crypto.randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    try {
      await otpCodeOperations.create({
        userId: pendingId,
        email,
        code: otp,
        type: 'email_verify',
        expiresAt,
      })
    } catch (err: any) {
      console.error('[REGISTER] Step 3 (otp) failed:', err.code || err.message)
    }

    // Step 4: Send email (non-critical)
    let emailSent = false
    try {
      emailSent = await sendVerificationEmail(email, otp)
    } catch {
      // Continue even if email fails
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
        : 'تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني.',
      otpId: pendingId,
    })
  } catch (error: unknown) {
    console.error('[REGISTER] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'حدث خطأ في التسجيل'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
