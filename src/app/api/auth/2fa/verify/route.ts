import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { send2FACodeEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function buildUserResponse(u: any) {
  const parsePermissions = (perm: any) => {
    if (!perm) return null
    try {
      if (typeof perm === 'string') return JSON.parse(perm)
      if (typeof perm === 'object') return perm
      return null
    } catch { return null }
  }

  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    kycStatus: u.kycStatus,
    balance: u.balance,
    frozenBalance: u.frozenBalance,
    mustChangePassword: false,
    createdAt: u.createdAt,
    merchantId: u.merchantId || null,
    affiliateCode: u.affiliateCode || null,
    hasPin: !!u.pinHash,
    permissions: parsePermissions(u.permissions),
    pendingConfirmation: u.pendingConfirmation || null,
    twoFactorEnabled: u.twoFactorEnabled || false,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, code, token, action } = body

    if (!userId || !token) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم والرمز مطلوبان' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // === SEND / RESEND 2FA CODE ===
    if (action === 'send') {
      const twoFactorCode = generate6DigitCode()

      await otpCodeOperations.create({
        userId: user.id,
        email: user.email,
        code: twoFactorCode,
        type: '2fa',
        verified: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })

      await send2FACodeEmail(user.email, twoFactorCode)

      return NextResponse.json({
        success: true,
        message: 'تم إعادة إرسال رمز المصادقة الثنائية',
      })
    }

    // === VERIFY 2FA CODE ===
    if (!code) {
      return NextResponse.json({ success: false, message: 'رمز التحقق مطلوب' }, { status: 400 })
    }

    let backupCodeUsed = false
    let usedBackupIndex = -1

    // First check if it's a backup code
    if (user.backupCodes && user.backupCodes.length > 0) {
      for (let i = 0; i < user.backupCodes.length; i++) {
        const isMatch = await bcrypt.compare(code, user.backupCodes[i])
        if (isMatch) {
          backupCodeUsed = true
          usedBackupIndex = i
          break
        }
      }
    }

    if (backupCodeUsed) {
      // Remove used backup code
      const updatedBackupCodes = user.backupCodes!.filter((_, i) => i !== usedBackupIndex)
      await userOperations.update({ id: user.id }, {
        backupCodes: updatedBackupCodes.length > 0 ? updatedBackupCodes : null,
      })

      // Find the pending login session
      const pendingSession = await otpCodeOperations.findFirst({
        where: { userId: user.id, type: 'login_2fa_pending', verified: false },
      })

      if (!pendingSession) {
        return NextResponse.json({ success: false, message: 'جلسة تسجيل الدخول منتهية الصلاحية' }, { status: 400 })
      }

      // Mark pending session as verified
      await otpCodeOperations.update(pendingSession.id, { verified: true })

      // Create the real login token
      const loginToken = pendingSession.code

      return NextResponse.json({
        success: true,
        token: loginToken,
        user: buildUserResponse(user),
      })
    }

    // Not a backup code - check OTP
    const otp = await otpCodeOperations.findFirst({
      where: { userId: user.id, type: '2fa', verified: false },
    })

    if (!otp || otp.code !== code) {
      return NextResponse.json({ success: false, message: 'رمز التحقق غير صحيح' }, { status: 400 })
    }

    // Mark OTP as verified
    await otpCodeOperations.update(otp.id, { verified: true })

    // Find the pending login session
    const pendingSession = await otpCodeOperations.findFirst({
      where: { userId: user.id, type: 'login_2fa_pending', verified: false },
    })

    if (!pendingSession) {
      return NextResponse.json({ success: false, message: 'جلسة تسجيل الدخول منتهية الصلاحية' }, { status: 400 })
    }

    // Mark pending session as verified
    await otpCodeOperations.update(pendingSession.id, { verified: true })

    // The pending session code is the login token
    const loginToken = pendingSession.code

    return NextResponse.json({
      success: true,
      token: loginToken,
      user: buildUserResponse(user),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
