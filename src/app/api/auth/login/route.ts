import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const TEMP_ADMIN_PASSWORD = 'admin123admin123admin123'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { email } })
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
    // If the user is logging in with the temporary admin password,
    // they MUST change it immediately
    if (password === TEMP_ADMIN_PASSWORD && user.role === 'admin') {
      // Mark that this user must change their password
      await db.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true },
      })

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
    await db.otpCode.create({
      data: {
        userId: user.id,
        email: user.email,
        code: token,
        type: 'login',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
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
