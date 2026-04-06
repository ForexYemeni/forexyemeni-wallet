import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET - public endpoint for support contact info
export async function GET() {
  try {
    const db = getDb()

    const doc = await db.collection('systemSettings').doc('maintenance').get()

    if (!doc.exists) {
      return NextResponse.json({ success: true, support: {} })
    }

    const data = doc.data()

    return NextResponse.json({
      success: true,
      support: {
        email: data?.supportEmail || '',
        phone: data?.supportPhone || '',
        telegram: data?.telegramLink || '',
        whatsapp: data?.whatsappLink || '',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
