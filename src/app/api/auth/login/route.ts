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
    const { email, password, deviceFingerprint, deviceName } = await request.json()

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
