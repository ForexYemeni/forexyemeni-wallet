import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { userOperations } from '@/lib/db-firebase'

// POST /api/admin/devices - Manage user devices
// Body: { adminId, targetUserId, action, fingerprint?, deviceName? }
// actions: 'authorize' (add new device + remove old), 'remove_all', 'list'
export async function POST(request: NextRequest) {
  try {
    const { adminId, targetUserId, action, fingerprint, deviceName } = await request.json()

    if (!adminId || !targetUserId || !action) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    // Verify admin
    const admin = await userOperations.findUnique({ id: adminId })
    if (!admin || (admin.role !== 'admin')) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const db = getDb()
    const devicesRef = db.collection('userDevices')

    if (action === 'authorize') {
      // Remove all existing devices and add the new one
      if (!fingerprint) {
        return NextResponse.json({ success: false, message: 'بصمة الجهاز مطلوبة' }, { status: 400 })
      }

      const existing = await devicesRef.where('userId', '==', targetUserId).get()
      const batch = db.batch()
      for (const doc of existing.docs) {
        batch.delete(doc.ref)
      }
      if (existing.docs.length > 0) await batch.commit()

      // Add new device
      await devicesRef.add({
        userId: targetUserId,
        fingerprint,
        deviceName: deviceName || 'جهاز مصرح به',
        isActive: true,
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorizedBy: adminId,
      })

      // Unlock user if they were locked
      const user = await userOperations.findUnique({ id: targetUserId })
      if (user && user.status === 'locked_device') {
        await userOperations.update({ id: targetUserId }, { status: 'active' })
      }

      return NextResponse.json({
        success: true,
        message: 'تم تصريح الجهاز بنجاح وإزالة جميع الأجهزة السابقة',
      })
    }

    if (action === 'remove_all') {
      // Remove all devices for user (force re-registration)
      const existing = await devicesRef.where('userId', '==', targetUserId).get()
      const batch = db.batch()
      for (const doc of existing.docs) {
        batch.delete(doc.ref)
      }
      if (existing.docs.length > 0) await batch.commit()

      return NextResponse.json({
        success: true,
        message: 'تم إزالة جميع الأجهزة بنجاح',
      })
    }

    if (action === 'list') {
      const devices = await devicesRef.where('userId', '==', targetUserId).get()
      const devicesList = devices.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      return NextResponse.json({ success: true, devices: devicesList })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
