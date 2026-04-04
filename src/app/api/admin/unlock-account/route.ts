import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { userOperations } from '@/lib/db-firebase'

/**
 * One-time endpoint to unlock admin account if it gets locked by device fingerprint.
 * Must be called with ?secret=fxwallet2024&email=<admin_email>
 *
 * This resets:
 *  - user.status → 'active'
 *  - user.mustChangePassword → false
 *  - deletes pendingDeviceAuth doc
 *  - deletes all userDevices docs
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')
    const email = searchParams.get('email')

    if (secret !== 'fxwallet2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const db = getDb()

    // Find user by email
    const user = await userOperations.findUnique({ email })
    if (!user) {
      return NextResponse.json({ error: 'User not found', email }, { status: 404 })
    }

    const userId = user.id
    const previousStatus = user.status
    const previousMustChange = user.mustChangePassword

    // Step 1: Update user status and mustChangePassword
    await userOperations.update({ id: userId }, {
      status: 'active',
      mustChangePassword: false,
    })

    // Step 2: Delete pendingDeviceAuth
    let pendingDeleted = false
    try {
      const pendingDoc = await db.collection('pendingDeviceAuth').doc(userId).get()
      if (pendingDoc.exists) {
        await db.collection('pendingDeviceAuth').doc(userId).delete()
        pendingDeleted = true
      }
    } catch {
      // ignore if collection doesn't exist
    }

    // Step 3: Delete all userDevices
    let devicesDeleted = 0
    try {
      const devicesSnapshot = await db
        .collection('userDevices')
        .where('userId', '==', userId)
        .get()
      if (!devicesSnapshot.empty) {
        const batch = db.batch()
        for (const doc of devicesSnapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        devicesDeleted = devicesSnapshot.size
      }
    } catch {
      // ignore if collection doesn't exist
    }

    return NextResponse.json({
      success: true,
      message: 'Account unlocked successfully',
      email: user.email,
      userId,
      changes: {
        status: { from: previousStatus, to: 'active' },
        mustChangePassword: { from: previousMustChange, to: false },
        pendingDeviceAuth: pendingDeleted ? 'deleted' : 'none',
        userDevices: devicesDeleted > 0 ? `deleted ${devicesDeleted}` : 'none',
      },
    })
  } catch (error: unknown) {
    return NextResponse.json({
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
