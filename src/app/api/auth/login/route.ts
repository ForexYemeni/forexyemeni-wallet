import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'
const TEMP_ADMIN_PASSWORD = 'admin123admin123admin123'

// Auto-create admin if not exists
async function ensureAdminExists() {
  const existing = await userOperations.findUnique({ email: ADMIN_EMAIL })
  if (!existing) {
    const passwordHash = await bcrypt.hash(TEMP_ADMIN_PASSWORD, 12)
    await userOperations.create({
      email: ADMIN_EMAIL,
      passwordHash,
      fullName: 'مدير النظام',
      phone: null,
      country: null,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      phoneVerified: false,
      kycStatus: 'none',
      kycIdPhoto: null,
      kycSelfie: null,
      kycNotes: null,
      balance: 0,
      frozenBalance: 0,
      mustChangePassword: true,
      referredBy: null,
      merchantId: null,
    })
    console.log('Admin user auto-created.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    // Auto-create admin on first login attempt
    if (email === ADMIN_EMAIL) {
      await ensureAdminExists()
    }

    const user = await userOperations.findUnique({ email })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { success: false, message: 'يرجى تفعيل البريد الإلكتروني أولاً', needsVerification: true },
        { status: 403 }
      )
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, message: 'حسابك معطل. يرجى التواصل مع الدعم' },
        { status: 403 }
      )
    }

    // === TEMP PASSWORD CHECK ===
    if (password === TEMP_ADMIN_PASSWORD && user.role === 'admin') {
      await userOperations.update({ id: user.id }, { mustChangePassword: true })

      const token = crypto.randomUUID()

      return NextResponse.json({
        success: true,
        token,
        mustChangePassword: true,
        message: 'يجب تغيير كلمة المرور المؤقتة قبل المتابعة',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          kycStatus: user.kycStatus,
          balance: user.balance,
          frozenBalance: user.frozenBalance,
          mustChangePassword: true,
          createdAt: user.createdAt,
        },
      })
    }

    // If user must change password, block login until changed
    if (user.mustChangePassword) {
      return NextResponse.json(
        { success: false, message: 'يجب تغيير كلمة المرور أولاً. كلمة المرور المؤقتة لم تعد صالحة.', mustChangePassword: true },
        { status: 403 }
      )
    }

    const token = crypto.randomUUID()
    await otpCodeOperations.create({
      userId: user.id,
      email: user.email,
      code: token,
      type: 'login',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        kycStatus: user.kycStatus,
        balance: user.balance,
        frozenBalance: user.frozenBalance,
        mustChangePassword: false,
        createdAt: user.createdAt,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في تسجيل الدخول'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
