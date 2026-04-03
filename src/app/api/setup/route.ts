import { NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    const ADMIN_EMAIL = 'mshay2024m@gmail.com'
    const ADMIN_PASSWORD = 'admin123admin123admin123'

    // 1. Check if admin exists
    const existing = await userOperations.findUnique({ email: ADMIN_EMAIL })

    if (existing) {
      // 2. Test if password matches
      const isValid = await bcrypt.compare(ADMIN_PASSWORD, existing.passwordHash)

      if (isValid) {
        return NextResponse.json({
          success: true,
          message: 'حساب المدير موجود وكلمة المرور صحيحة ✅',
          adminExists: true,
          passwordValid: true,
        })
      }

      // 3. Password doesn't match - fix it
      const newPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
      await userOperations.update({ id: existing.id }, {
        passwordHash: newPasswordHash,
        emailVerified: true,
        role: 'admin',
        status: 'active',
        mustChangePassword: true,
      })

      return NextResponse.json({
        success: true,
        message: 'تم إصلاح كلمة المرور بنجاح ✅ حاول تسجيل الدخول الآن',
        adminExists: true,
        passwordFixed: true,
      })
    }

    // 4. Admin doesn't exist - create it
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
    const admin = await userOperations.create({
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

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء حساب المدير بنجاح ✅ حاول تسجيل الدخول الآن',
      adminExists: false,
      adminCreated: true,
      adminId: admin.id,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف'
    return NextResponse.json({
      success: false,
      message: 'خطأ: ' + message,
    }, { status: 500 })
  }
}
