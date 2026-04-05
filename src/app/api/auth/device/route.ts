import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { userOperations } from '@/lib/db-firebase'

// POST /api/auth/device - Check or register device
// Body: { userId, fingerprint, deviceName }
export async function POST(request: NextRequest) {
  try {
    const { userId, fingerprint, deviceName, action } = await request.json()

    if (!userId || !fingerprint) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    const db = getDb()
    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Main admin can bypass device check (role 'admin' with no specific permissions enabled)
    let hasSpecificPermissions = false
    if (user.permissions) {
      try {
        const parsedPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
        hasSpecificPermissions = parsedPerms && Object.values(parsedPerms).some((v: unknown) => v === true)
      } catch {
        hasSpecificPermissions = false
      }
    }
    if (user.role === 'admin' && !hasSpecificPermissions) {
      if (action === 'register' || action === 'check') {
        // For admin: always register device and remove all others
        if (action === 'register') {
          const devicesRef = db.collection('userDevices')
          // Delete all existing devices for admin
          const existing = await devicesRef.where('userId', '==', userId).get()
          const batch = db.batch()
          for (const doc of existing.docs) {
            batch.delete(doc.ref)
          }
          if (existing.docs.length > 0) await batch.commit()

          // Register new device
          await devicesRef.add({
            userId,
            fingerprint,
            deviceName: deviceName || 'جهاز إدارة',
            isActive: true,
            lastUsed: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          })
        }
        return NextResponse.json({ success: true, authorized: true, isAdmin: true })
      }
    }

    if (action === 'register') {
      // Register a new device (only if user has no devices yet - first registration)
      const devicesRef = db.collection('userDevices')
      const existing = await devicesRef.where('userId', '==', userId).get()

      if (existing.empty) {
        // First device - register it
        await devicesRef.add({
          userId,
          fingerprint,
          deviceName: deviceName || 'جهاز غير معروف',
          isActive: true,
          lastUsed: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        })
        return NextResponse.json({ success: true, authorized: true, isFirstDevice: true })
      }

      // Already has devices - this is a new device trying to register
      return NextResponse.json({
        success: false,
        authorized: false,
        message: 'تم اكتشاف جهاز جديد. يجب التواصل مع الإدارة للتصريح بالدخول من هذا الجهاز.',
        needsAdminApproval: true,
      })
    }

    if (action === 'check') {
      // Check if device fingerprint matches any registered device
      const devicesRef = db.collection('userDevices')
      const devices = await devicesRef.where('userId', '==', userId).where('isActive', '==', true).get()

      if (devices.empty) {
        // No devices registered yet - allow registration (first login after system update)
        return NextResponse.json({
          success: true,
          authorized: true,
          needsRegistration: true,
        })
      }

      const matchedDevice = devices.docs.find(doc => doc.data().fingerprint === fingerprint)

      if (matchedDevice) {
        // Update last used
        await matchedDevice.ref.update({ lastUsed: new Date().toISOString() })
        return NextResponse.json({ success: true, authorized: true })
      }

      // Device not recognized - lock
      return NextResponse.json({
        success: false,
        authorized: false,
        message: 'تم اكتشاف محاولة دخول من جهاز غير معروف. تم قفل الحساب لحمايتك. يرجى التواصل مع الإدارة.',
        locked: true,
        needsAdminApproval: true,
      })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// GET /api/auth/device?userId=xxx - Get user's devices (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const adminId = searchParams.get('adminId')

    if (!userId || !adminId) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    // Verify admin
    const admin = await userOperations.findUnique({ id: adminId })
    if (!admin || (admin.role !== 'admin')) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const db = getDb()
    const devicesRef = db.collection('userDevices')
    const devices = await devicesRef.where('userId', '==', userId).get()

    const devicesList = devices.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({ success: true, devices: devicesList })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
