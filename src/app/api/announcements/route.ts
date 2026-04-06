import { NextResponse } from 'next/server'
import { getDb, fromFirestoreTimestamp } from '@/lib/firebase'

// GET - public endpoint for active announcements
export async function GET() {
  try {
    const db = getDb()

    const globalSettingsDoc = await db.collection('systemSettings').doc('global').get()

    if (!globalSettingsDoc.exists) {
      return NextResponse.json({ success: true, announcements: [] })
    }

    const data = globalSettingsDoc.data()
    const rawAnnouncements: Array<{
      id?: string
      title?: string
      message?: string
      type?: 'info' | 'warning' | 'urgent'
      active?: boolean
      expiresAt?: unknown
    }> = data?.announcements || []

    const now = new Date()

    const activeAnnouncements = rawAnnouncements.filter((a) => {
      if (!a.active) return false
      if (!a.title || !a.message) return false
      if (a.expiresAt) {
        const expDate = new Date(fromFirestoreTimestamp(a.expiresAt))
        if (expDate < now) return false
      }
      return true
    })

    return NextResponse.json({
      success: true,
      announcements: activeAnnouncements,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
