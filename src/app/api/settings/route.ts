import { NextResponse } from 'next/server'
import { getDb, nowTimestamp } from '@/lib/firebase'

// GET - public settings (fees)
export async function GET() {
  try {
    const db = getDb()
    const doc = await db.collection('systemSettings').doc('fees').get()

    if (doc.exists) {
      return NextResponse.json({ success: true, settings: doc.data() })
    }

    // Create default if not exists
    const defaults = {
      depositFee: 3,
      withdrawalFee: 3,
      updatedAt: nowTimestamp(),
    }
    await db.collection('systemSettings').doc('fees').set(defaults)
    return NextResponse.json({ success: true, settings: defaults })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
