import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

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

    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const affiliateCode = crypto.randomBytes(4).toString('hex').toUpperCase()

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        fullName: fullName || null,
        affiliateCode,
      },
    })

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await db.otpCode.create({
      data: {
        userId: user.id,
        email,
        code: otp,
        type: 'email_verify',
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
      otpId: user.id,
      otp, // For testing only
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في التسجيل'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
