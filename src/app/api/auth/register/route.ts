import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendVerificationEmail } from '@/lib/email'
import { getDb, generateAffiliateCode, generateAccountNumber, checkAndApplyCustomFirebase } from '@/lib/firebase'
import { checkApiRateLimit } from '@/lib/rate-limit'
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

    // Ensure custom Firebase is loaded before any DB operations
    await checkAndApplyCustomFirebase()

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

    // Step 1: Check if user exists
    let existingUser = null
    try {
      existingUser = await userOperations.findUnique({ email })
    } catch (err: any) {
      console.error('[REGISTER] Step 1 (findUnique) failed:', err.code || err.message)
      return NextResponse.json(
        { success: false, message: 'خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.', step: 'findUser', detail: err.code || err.message },
        { status: 503 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // Step 2: Generate account number
    let accountNumber: number
    try {
      accountNumber = await generateAccountNumber()
    } catch (err: any) {
      console.error('[REGISTER] Step 2 (accountNumber) failed:', err.code || err.message)
      return NextResponse.json(
        { success: false, message: 'خطأ في إنشاء رقم الحساب. يرجى المحاولة لاحقاً.', step: 'accountNumber', detail: err.code || err.message },
        { status: 503 }
      )
    }

    // Step 3: Create user
    let user
    try {
      user = await userOperations.create({
        email,
        passwordHash,
        fullName: fullName || null,
        phone: null,
        country: null,
        role: 'user',
        status: 'registered',
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
        accountNumber,
      })
    } catch (err: any) {
      console.error('[REGISTER] Step 3 (create) failed:', err.code || err.message)
      return NextResponse.json(
        { success: false, message: 'خطأ في إنشاء الحساب. يرجى المحاولة لاحقاً.', step: 'createUser', detail: err.code || err.message },
        { status: 503 }
      )
    }

    // Step 4: Create OTP (skip old OTP deletion to reduce Firebase calls)
    const otp = crypto.randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    try {
      await otpCodeOperations.create({
        userId: user.id,
        email,
        code: otp,
        type: 'email_verify',
        expiresAt,
      })
    } catch (err: any) {
      console.error('[REGISTER] Step 4 (otp) failed:', err.code || err.message)
      // Non-critical: continue without OTP
    }

    // Step 5: Send email (non-critical)
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
      otpId: user.id,
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
