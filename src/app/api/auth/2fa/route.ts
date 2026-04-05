import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { send2FASetupEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

function generateBackupCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const groups: string[] = []
  for (let g = 0; g < 4; g++) {
    let group = ''
    for (let i = 0; i < 4; i++) {
      group += chars[Math.floor(Math.random() * chars.length)]
    }
    groups.push(group)
  }
  return groups.join('-')
}

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// GET - Get 2FA status for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      twoFactorEnabled: user.twoFactorEnabled || false,
      hasBackupCodes: !!(user.backupCodes && user.backupCodes.length > 0),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST - Enable/disable/verify_setup/regenerate_backup/admin_disable 2FA
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, action, token, password, code, targetUserId, adminToken } = body

    if (!userId || !action) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم والإجراء مطلوبان' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // === ENABLE 2FA ===
    if (action === 'enable') {
      const setupCode = generate6DigitCode()

      await otpCodeOperations.create({
        userId: user.id,
        email: user.email,
        code: setupCode,
        type: '2fa_setup',
        verified: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })

      await send2FASetupEmail(user.email, setupCode)

      return NextResponse.json({
        success: true,
        message: 'تم إرسال رمز التحقق',
      })
    }

    // === VERIFY SETUP ===
    if (action === 'verify_setup') {
      if (!code) {
        return NextResponse.json({ success: false, message: 'رمز التحقق مطلوب' }, { status: 400 })
      }

      const otp = await otpCodeOperations.findFirst({
        where: { userId: user.id, type: '2fa_setup', verified: false },
      })

      if (!otp || otp.code !== code) {
        return NextResponse.json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي الصلاحية' }, { status: 400 })
      }

      // Mark OTP as verified
      await otpCodeOperations.update(otp.id, { verified: true })

      // Generate 5 backup codes
      const plainCodes: string[] = []
      const hashedCodes: string[] = []

      for (let i = 0; i < 5; i++) {
        const backupCode = generateBackupCode()
        plainCodes.push(backupCode)
        hashedCodes.push(await bcrypt.hash(backupCode, 10))
      }

      // Enable 2FA and store hashed backup codes
      await userOperations.update({ id: user.id }, {
        twoFactorEnabled: true,
        backupCodes: hashedCodes,
      })

      return NextResponse.json({
        success: true,
        message: 'تم تفعيل المصادقة الثنائية بنجاح',
        backupCodes: plainCodes,
      })
    }

    // === DISABLE 2FA (user) ===
    if (action === 'disable') {
      if (!password) {
        return NextResponse.json({ success: false, message: 'كلمة المرور مطلوبة' }, { status: 400 })
      }

      const isValid = await bcrypt.compare(password, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 })
      }

      await userOperations.update({ id: user.id }, {
        twoFactorEnabled: false,
        backupCodes: null,
      })

      return NextResponse.json({
        success: true,
        message: 'تم تعطيل المصادقة الثنائية',
      })
    }

    // === REGENERATE BACKUP CODES ===
    if (action === 'regenerate_backup') {
      if (!user.twoFactorEnabled) {
        return NextResponse.json({ success: false, message: 'المصادقة الثنائية غير مفعلة' }, { status: 400 })
      }

      if (!password) {
        return NextResponse.json({ success: false, message: 'كلمة المرور مطلوبة' }, { status: 400 })
      }

      const isValid = await bcrypt.compare(password, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 })
      }

      const plainCodes: string[] = []
      const hashedCodes: string[] = []

      for (let i = 0; i < 5; i++) {
        const backupCode = generateBackupCode()
        plainCodes.push(backupCode)
        hashedCodes.push(await bcrypt.hash(backupCode, 10))
      }

      await userOperations.update({ id: user.id }, {
        backupCodes: hashedCodes,
      })

      return NextResponse.json({
        success: true,
        message: 'تم إعادة إنشاء أكواد الاسترداد',
        backupCodes: plainCodes,
      })
    }

    // === ADMIN DISABLE 2FA ===
    if (action === 'admin_disable') {
      if (!adminToken) {
        return NextResponse.json({ success: false, message: 'رمز المصادقة مطلوب' }, { status: 400 })
      }

      // Verify caller is admin by finding their login OTP token
      const adminOtp = await otpCodeOperations.findFirst({
        where: { type: 'login', verified: false },
      })

      let adminUserId: string | null = null
      if (adminOtp) {
        // The adminToken should match the OTP code (which is the login token)
        if (adminOtp.code === adminToken) {
          adminUserId = adminOtp.userId || null
        }
      }

      // If not found via OTP, check if userId in body is the admin themselves
      if (!adminUserId) {
        adminUserId = userId
      }

      const adminUser = adminUserId ? await userOperations.findUnique({ id: adminUserId }) : null
      if (!adminUser || adminUser.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'صلاحية غير كافية' }, { status: 403 })
      }

      // Target user
      const targetUser = targetUserId ? await userOperations.findUnique({ id: targetUserId }) : user
      if (!targetUser) {
        return NextResponse.json({ success: false, message: 'المستخدم المستهدف غير موجود' }, { status: 404 })
      }

      await userOperations.update({ id: targetUser.id }, {
        twoFactorEnabled: false,
        backupCodes: null,
      })

      return NextResponse.json({
        success: true,
        message: 'تم تعطيل المصادقة الثنائية للمستخدم',
      })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
