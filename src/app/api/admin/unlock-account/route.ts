import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { userOperations } from '@/lib/db-firebase'

/**
 * Endpoint to unlock accounts locked by device fingerprint.
 * Supports GET and POST with ?secret=fxwallet2024
 * If no email specified, unlocks ALL locked accounts.
 */
export async function POST(req: NextRequest) {
  return handleUnlock(req)
}

export async function GET(req: NextRequest) {
  return handleUnlock(req)
}

async function handleUnlock(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')

    if (secret !== 'fxwallet2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()
    const email = searchParams.get('email')
    let unlockedCount = 0
    const details: any[] = []

    if (email) {
      // Unlock specific user
      const user = await userOperations.findUnique({ email })
      if (!user) {
        return NextResponse.json({ error: 'User not found', email }, { status: 404 })
      }

      if (user.status === 'locked_device') {
        await userOperations.update({ id: user.id }, { status: 'active', mustChangePassword: false })
        unlockedCount = 1
      }

      // Always clean up devices and pending auth
      try {
        await db.collection('pendingDeviceAuth').doc(user.id).delete()
      } catch { /* ignore */ }
      try {
        const devs = await db.collection('userDevices').where('userId', '==', user.id).get()
        if (!devs.empty) {
          const batch = db.batch()
          for (const doc of devs.docs) batch.delete(doc.ref)
          await batch.commit()
        }
      } catch { /* ignore */ }

      details.push({ email: user.email, id: user.id, wasLocked: user.status === 'locked_device' })
    } else {
      // Unlock ALL locked accounts
      const snapshot = await db.collection('users').where('status', '==', 'locked_device').get()
      const batch = db.batch()

      for (const doc of snapshot.docs) {
        batch.update(doc.ref, { status: 'active', mustChangePassword: false, updatedAt: new Date().toISOString() })
        details.push({ email: doc.data().email, id: doc.id })
        unlockedCount++
      }

      if (!snapshot.empty) {
        await batch.commit()
      }
    }

    return NextResponse.json({
      success: true,
      unlockedCount,
      totalLockedFound: details.length,
      accounts: details,
      message: unlockedCount > 0
        ? `تم فك حظر ${unlockedCount} حساب بنجاح`
        : 'لا توجد حسابات مقفلة',
    })
  } catch (error: unknown) {
    return NextResponse.json({
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
