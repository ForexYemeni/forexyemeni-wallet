import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// Default PIN from environment variable
const DEFAULT_PIN = process.env.RECOVERY_DEFAULT_PIN || ''

/**
 * Recovery PIN API — NO authentication, self-contained.
 * Stores PIN hash in the DEFAULT database (firebase-key.ts).
 * Falls back to hardcoded default PIN if DB is unreachable.
 * 
 * GET: Get PIN verification status (checks if a custom PIN is set)
 * POST actions:
 *   - verify: Check if entered PIN matches stored/default PIN
 *   - change: Set a new PIN (requires current PIN verification)
 */

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
  })
}

async function getDefaultDb() {
  const { _fbk } = await import('@/lib/firebase-key')
  const serviceAccount = JSON.parse(Buffer.from(_fbk, 'base64').toString())
  const { initializeApp, cert, getApps, deleteApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')

  const appName = `recovery-pin-${Date.now()}`
  const tempApp = initializeApp({
    credential: cert(serviceAccount),
  }, appName)
  const db = getFirestore(tempApp)
  const cleanup = async () => { try { await deleteApp(tempApp) } catch {} }
  return { db, cleanup }
}

export async function GET() {
  try {
    const { db, cleanup } = await getDefaultDb()
    try {
      const doc = await withTimeout(
        db.collection('systemSettings').doc('recoveryPin').get(),
        5000
      )
      const hasCustom = doc.exists && !!doc.data()?.pinHash
      await cleanup()
      return NextResponse.json({
        success: true,
        hasCustomPin: hasCustom,
      })
    } catch {
      await cleanup()
      // DB unreachable — use default
      return NextResponse.json({
        success: true,
        hasCustomPin: false,
        dbReachable: false,
      })
    }
  } catch {
    return NextResponse.json({
      success: true,
      hasCustomPin: false,
      dbReachable: false,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, pin, newPin } = body

    if (!action) {
      return NextResponse.json({ success: false, message: 'Action required' }, { status: 400 })
    }

    // === VERIFY: Check if PIN matches ===
    if (action === 'verify') {
      if (!pin || pin.length < 4) {
        return NextResponse.json({ success: false, message: 'رمز PIN مطلوب' }, { status: 400 })
      }

      let storedHash: string | null = null

      try {
        const { db, cleanup } = await getDefaultDb()
        try {
          const doc = await withTimeout(
            db.collection('systemSettings').doc('recoveryPin').get(),
            5000
          )
          if (doc.exists && doc.data()?.pinHash) {
            storedHash = doc.data()!.pinHash
          }
        } catch {
          // DB unreachable — use default
        }
        await cleanup()
      } catch {
        // Firebase init failed — use default
      }

      // If no custom PIN stored, check against default
      if (!storedHash) {
        if (pin === DEFAULT_PIN) {
          return NextResponse.json({ success: true, isDefault: true })
        } else {
          return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' })
        }
      }

      // Compare against stored hash
      const isMatch = await bcrypt.compare(pin, storedHash)
      if (isMatch) {
        return NextResponse.json({ success: true, isDefault: false })
      } else {
        // Also check default PIN as fallback
        if (pin === DEFAULT_PIN) {
          return NextResponse.json({ success: true, isDefault: true })
        }
        return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' })
      }
    }

    // === CHANGE: Set a new PIN (requires current PIN verification) ===
    if (action === 'change') {
      if (!pin || pin.length < 4) {
        return NextResponse.json({ success: false, message: 'رمز PIN الحالي مطلوب' }, { status: 400 })
      }
      if (!newPin || newPin.length < 4) {
        return NextResponse.json({ success: false, message: 'رمز PIN الجديد مطلوب (4 أرقام على الأقل)' }, { status: 400 })
      }
      if (!/^\d+$/.test(newPin)) {
        return NextResponse.json({ success: false, message: 'رمز PIN يجب أن يكون أرقاماً فقط' }, { status: 400 })
      }

      // Step 1: Verify current PIN first
      let storedHash: string | null = null

      try {
        const { db, cleanup } = await getDefaultDb()
        try {
          const doc = await withTimeout(
            db.collection('systemSettings').doc('recoveryPin').get(),
            5000
          )
          if (doc.exists && doc.data()?.pinHash) {
            storedHash = doc.data()!.pinHash
          }
        } catch {
          // DB unreachable for read — allow change with default PIN
        }

        // Verify current PIN
        let currentPinValid = false
        if (storedHash) {
          currentPinValid = await bcrypt.compare(pin, storedHash)
        }
        if (!currentPinValid && pin === DEFAULT_PIN) {
          currentPinValid = true
        }

        if (!currentPinValid) {
          await cleanup()
          return NextResponse.json({ success: false, message: 'رمز PIN الحالي غير صحيح' })
        }

        // Step 2: Hash and save new PIN
        const newHash = await bcrypt.hash(newPin, 10)
        await db.collection('systemSettings').doc('recoveryPin').set({
          pinHash: newHash,
          updatedAt: new Date().toISOString(),
        }, { merge: true })

        await cleanup()
        return NextResponse.json({
          success: true,
          message: 'تم تغيير رمز PIN بنجاح وحفظه بشكل دائم',
        })
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          message: 'فشل حفظ PIN: ' + (err?.message || 'خطأ في قاعدة البيانات'),
        })
      }
    }

    return NextResponse.json({ success: false, message: 'Action not recognized' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
