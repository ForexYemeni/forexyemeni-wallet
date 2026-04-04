import { NextResponse } from 'next/server'
import { getDb, nowTimestamp } from '@/lib/firebase'

// GET - public settings (fees, social links, referral settings, bot settings)
export async function GET() {
  try {
    const db = getDb()

    // Fetch all settings documents in parallel
    const [feesDoc, socialLinksDoc, referralSettingsDoc, botSettingsDoc] = await Promise.all([
      db.collection('systemSettings').doc('fees').get(),
      db.collection('systemSettings').doc('socialLinks').get(),
      db.collection('systemSettings').doc('referralSettings').get(),
      db.collection('systemSettings').doc('botSettings').get(),
    ])

    // Fee settings (with defaults)
    let fees = { depositFee: 3, withdrawalFee: 3, updatedAt: nowTimestamp() }
    if (feesDoc.exists) {
      fees = feesDoc.data() as typeof fees
    } else {
      await db.collection('systemSettings').doc('fees').set(fees)
    }

    // Social links (with defaults)
    const socialLinks = socialLinksDoc.exists ? socialLinksDoc.data() : {
      whatsapp: '',
      phone: '',
      telegram: '',
      facebook: '',
      instagram: '',
      twitter: '',
      tiktok: '',
      updatedAt: nowTimestamp(),
    }

    // Referral settings (may not exist)
    const referralSettings = referralSettingsDoc.exists ? referralSettingsDoc.data() : null

    // Bot settings (may not exist)
    const botSettings = botSettingsDoc.exists ? botSettingsDoc.data() : null

    return NextResponse.json({
      success: true,
      settings: {
        ...fees,
        socialLinks,
        referralSettings,
        botSettings,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
