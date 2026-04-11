import { NextResponse } from 'next/server'
import { getDb, nowTimestamp } from '@/lib/firebase'

// Force dynamic rendering - never cache exchange rates
export const dynamic = 'force-dynamic'

// GET - public settings (fees, social links, referral settings, bot settings)
export async function GET() {
  try {
    const db = getDb()

    // Fetch all settings documents in parallel
    const [feesDoc, socialLinksDoc, referralSettingsDoc, botSettingsDoc, commissionDoc, exchangeRatesDoc] = await Promise.all([
      db.collection('systemSettings').doc('fees').get(),
      db.collection('systemSettings').doc('socialLinks').get(),
      db.collection('systemSettings').doc('referralSettings').get(),
      db.collection('systemSettings').doc('botSettings').get(),
      db.collection('systemSettings').doc('commission').get(),
      db.collection('systemSettings').doc('exchangeRates').get(),
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

    // Commission settings (with defaults)
    let commission = { p2pFeePercent: 0.5, adminCommissionPercent: 1, updatedAt: nowTimestamp() }
    if (commissionDoc.exists) {
      commission = commissionDoc.data() as typeof commission
    } else {
      await db.collection('systemSettings').doc('commission').set(commission)
    }

    // Exchange rates (with defaults)
    let exchangeRates = { usdToYer: 535, usdToSar: 3.75, sarToYer: 142.67, updatedAt: nowTimestamp() }
    if (exchangeRatesDoc.exists) {
      exchangeRates = exchangeRatesDoc.data() as typeof exchangeRates
    } else {
      await db.collection('systemSettings').doc('exchangeRates').set(exchangeRates)
    }

    return NextResponse.json({
      success: true,
      settings: {
        ...fees,
        socialLinks,
        referralSettings,
        botSettings,
        commission,
        exchangeRates,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
