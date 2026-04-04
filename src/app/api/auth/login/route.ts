import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations, merchantApplicationOperations, merchantOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDb } from '@/lib/firebase'

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
    const { email, password, pin, deviceFingerprint, deviceName } = await request.json()

    if (!email || (!password && !pin)) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني وكلمة المرور أو رمز PIN مطلوبان' },
        { status: 400 }
      )
    }

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

    // Enrich merchantId from merchant application / old merchant system if missing
    if (!user.merchantId && user.role !== 'admin') {
      const applications = await merchantApplicationOperations.findByUser(user.id)
      const approvedApp = applications.find(a => a.status === 'approved')
      if (approvedApp) {
        await userOperations.update({ id: user.id }, { merchantId: approvedApp.id })
        user.merchantId = approvedApp.id
      } else {
        const oldMerchant = await merchantOperations.findApprovedByUser(user.id)
        if (oldMerchant) {
          await userOperations.update({ id: user.id }, { merchantId: oldMerchant.id })
          user.merchantId = oldMerchant.id
        }
      }
    }

    // === TEMP PIN LOGIN (admin-sent recovery PIN) ===
    if (pin && !password) {
      // Check if user has a valid temp PIN
      if (!user.tempPinHash) {
        return NextResponse.json(
          { success: false, message: 'لا يوجد رمز PIN مؤقت. تواصل مع الإدارة.' },
          { status: 401 }
        )
      }

      // Check if temp PIN has expired
      if (user.tempPinExpiresAt && new Date(user.tempPinExpiresAt) < new Date()) {
        // Clear expired temp PIN
        await userOperations.update({ id: user.id }, { tempPinHash: null as any, tempPinExpiresAt: null as any })
        return NextResponse.json(
          { success: false, message: 'انتهت صلاحية رمز PIN المؤقت. تواصل مع الإدارة للحصول على رمز جديد.' },
          { status: 401 }
        )
      }

      const isPinValid = await bcrypt.compare(pin, user.tempPinHash)
      if (!isPinValid) {
        return NextResponse.json(
          { success: false, message: 'رمز PIN غير صحيح' },
          { status: 401 }
        )
      }

      // Clear temp PIN after successful use
      await userOperations.update({ id: user.id }, { tempPinHash: null as any, tempPinExpiresAt: null as any, mustChangePassword: true })

      // Bypass password check, proceed with login but force password change
      const parsePermissions = (perm: any) => {
        if (!perm) return null
        try {
          if (typeof perm === 'string') return JSON.parse(perm)
          if (typeof perm === 'object') return perm
          return null
        } catch { return null }
      }

      const getUserResponse = (u: any, mustChange: boolean = false) => ({
        id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, role: u.role, status: u.status,
        emailVerified: u.emailVerified, phoneVerified: u.phoneVerified, kycStatus: u.kycStatus,
        balance: u.balance, frozenBalance: u.frozenBalance, mustChangePassword: mustChange,
        createdAt: u.createdAt, merchantId: u.merchantId || null, affiliateCode: u.affiliateCode || null,
        hasPin: !!u.pinHash, permissions: parsePermissions(u.permissions), pendingConfirmation: u.pendingConfirmation || null,
      })

      const token = crypto.randomUUID()
      const { otpCodeOperations } = await import('@/lib/db-firebase')
      await otpCodeOperations.create({
        userId: user.id, email: user.email, code: token, type: 'login', verified: false,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })

      return NextResponse.json({
        success: true, token,
        mustChangePassword: true,
        message: 'تم تسجيل الدخول برمز PIN. يجب تغيير كلمة المرور فوراً.',
        user: getUserResponse(user, true),
      })
    }

    // === NORMAL PASSWORD LOGIN ===
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    // Skip emailVerified check for temp PIN login (already handled above)
    // But enforce it for normal password login
    if (!pin && !user.emailVerified) {
      return NextResponse.json(
        { success: false, message: 'يرجى تفعيل البريد الإلكتروني أولاً', needsVerification: true },
        { status: 403 }
      )
    }

    if (user.status === 'locked_device') {
      return NextResponse.json(
        { success: false, message: 'حسابك مقفل بسبب محاولة دخول من جهاز غير معروف. يرجى التواصل مع الإدارة.', lockedDevice: true },
        { status: 403 }
      )
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, message: 'حسابك معطل. يرجى التواصل مع الدعم' },
        { status: 403 }
      )
    }

    const parsePermissions = (perm: any) => {
      if (!perm) return null
      try {
        if (typeof perm === 'string') return JSON.parse(perm)
        if (typeof perm === 'object') return perm
        return null
      } catch { return null }
    }

    const getUserResponse = (u: any, mustChange: boolean = false) => ({
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
      mustChangePassword: mustChange,
      createdAt: u.createdAt,
      merchantId: u.merchantId || null,
      affiliateCode: u.affiliateCode || null,
      hasPin: !!u.pinHash,
      permissions: parsePermissions(u.permissions),
      pendingConfirmation: u.pendingConfirmation || null,
    })

    // === TEMP PASSWORD CHECK ===
    if (password === TEMP_ADMIN_PASSWORD && user.role === 'admin') {
      await userOperations.update({ id: user.id }, { mustChangePassword: true })

      const token = crypto.randomUUID()

      return NextResponse.json({
        success: true,
        token,
        mustChangePassword: true,
        message: 'يجب تغيير كلمة المرور المؤقتة قبل المتابعة',
        user: getUserResponse(user, true),
      })
    }

    // If user must change password, block login until changed
    if (user.mustChangePassword) {
      return NextResponse.json(
        { success: false, message: 'يجب تغيير كلمة المرور أولاً. كلمة المرور المؤقتة لم تعد صالحة.', mustChangePassword: true },
        { status: 403 }
      )
    }

    // === DEVICE FINGERPRINT CHECK ===
    // Admin with no permissions object = full admin, can bypass device check
    const isFullAdmin = user.role === 'admin' && !parsePermissions(user.permissions)

    if (deviceFingerprint && !isFullAdmin) {
      const db = getDb()
      const devicesRef = db.collection('userDevices')
      const userDevices = await devicesRef.where('userId', '==', user.id).where('isActive', '==', true).get()

      if (!userDevices.empty) {
        // User has registered devices - check if this device matches
        const matchedDevice = userDevices.docs.find(doc => doc.data().fingerprint === deviceFingerprint)

        if (!matchedDevice) {
          // Store pending device auth request
          await db.collection('pendingDeviceAuth').doc(user.id).set({
            userId: user.id,
            fingerprint: deviceFingerprint,
            deviceName: deviceName || 'جهاز غير معروف',
            requestedAt: new Date().toISOString(),
          })

          // Lock the account
          await userOperations.update({ id: user.id }, { status: 'locked_device' })

          return NextResponse.json(
            {
              success: false,
              message: 'تم اكتشاف محاولة دخول من جهاز غير معروف. تم قفل الحساب لحمايتك. يرجى التواصل مع الإدارة للتصريح بالدخول.',
              lockedDevice: true,
            },
            { status: 403 }
          )
        }

        // Device matched - update last used
        await matchedDevice.ref.update({ lastUsed: new Date().toISOString() })
      } else {
        // No devices registered yet - this is the first device, register it
        await devicesRef.add({
          userId: user.id,
          fingerprint: deviceFingerprint,
          deviceName: deviceName || 'جهاز غير معروف',
          isActive: true,
          lastUsed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        })
      }
    } else if (!deviceFingerprint && !isFullAdmin) {
      // No fingerprint provided (old client) - allow for now but first time
      // In production, this should be enforced
    }

    // For full admin: register device and remove all others
    if (isFullAdmin && deviceFingerprint) {
      const db = getDb()
      const devicesRef = db.collection('userDevices')
      const existing = await devicesRef.where('userId', '==', user.id).get()
      const batch = db.batch()
      for (const doc of existing.docs) {
        batch.delete(doc.ref)
      }
      if (existing.docs.length > 0) await batch.commit()

      await devicesRef.add({
        userId: user.id,
        fingerprint: deviceFingerprint,
        deviceName: deviceName || 'جهاز إدارة',
        isActive: true,
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
    }

    const token = crypto.randomUUID()
    await otpCodeOperations.create({
      userId: user.id,
      email: user.email,
      code: token,
      type: 'login',
      verified: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    return NextResponse.json({
      success: true,
      token,
      user: getUserResponse(user),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في تسجيل الدخول'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
