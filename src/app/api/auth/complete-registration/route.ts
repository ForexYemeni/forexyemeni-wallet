import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'البيانات مطلوبة' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' },
        { status: 400 }
      )
    }

    const user = await userOperations.findUnique({ email })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // Update name, password, and mark email as verified
    const passwordHash = await bcrypt.hash(password, 12)
    const updatedUser = await userOperations.update({ id: user.id }, {
      fullName: fullName || null,
      passwordHash,
      emailVerified: true,
      status: 'active',
    })

    // Generate token and auto-login
    const token = crypto.randomUUID()

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        role: updatedUser.role,
        status: updatedUser.status,
        emailVerified: true,
        phoneVerified: updatedUser.phoneVerified,
        kycStatus: updatedUser.kycStatus,
        balance: updatedUser.balance,
        frozenBalance: updatedUser.frozenBalance,
        mustChangePassword: false,
        createdAt: updatedUser.createdAt,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
