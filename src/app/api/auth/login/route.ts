import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

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
