import { NextResponse } from 'next/server'
import { getDb, nowTimestamp } from '@/lib/firebase'

// GET - Get current social links
export async function GET() {
  try {
    const db = getDb()
    const doc = await db.collection('systemSettings').doc('socialLinks').get()

    if (doc.exists) {
      return NextResponse.json({ success: true, socialLinks: doc.data() })
    }

    return NextResponse.json({
      success: true,
      socialLinks: {
        whatsapp: '',
        phone: '',
        telegram: '',
        facebook: '',
        instagram: '',
        twitter: '',
        tiktok: '',
        updatedAt: nowTimestamp(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST - Update social links (admin only)
export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const { userId, role, whatsapp, phone, telegram, facebook, instagram, twitter, tiktok } = body

    // Verify admin role
    if (!userId || role !== 'admin') {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Double check user is actually admin in DB
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const socialLinks = {
      whatsapp: whatsapp || '',
      phone: phone || '',
      telegram: telegram || '',
      facebook: facebook || '',
      instagram: instagram || '',
      twitter: twitter || '',
      tiktok: tiktok || '',
      updatedAt: nowTimestamp(),
    }

    await db.collection('systemSettings').doc('socialLinks').set(socialLinks, { merge: true })

    return NextResponse.json({ success: true, message: 'تم تحديث روابط التواصل الاجتماعي' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
