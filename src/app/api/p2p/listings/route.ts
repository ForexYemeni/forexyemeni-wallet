import { NextRequest, NextResponse } from 'next/server'
import { userOperations, merchantOperations, p2pListingOperations } from '@/lib/db-firebase'

// GET: get active listings with filters
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || undefined
    const network = req.nextUrl.searchParams.get('network') || undefined
    const paymentMethod = req.nextUrl.searchParams.get('paymentMethod') || undefined

    const listings = await p2pListingOperations.findActive({ type, network, paymentMethod })

    // Attach merchant info
    const enriched = await Promise.all(listings.map(async (l) => {
      const merchant = await merchantOperations.findUnique(l.merchantId)
      const user = merchant ? await userOperations.findUnique({ id: merchant.userId }) : null
      return {
        ...l,
        merchantName: merchant?.fullName || user?.fullName || 'تاجر',
        merchantTrades: l.totalTrades,
        merchantRate: l.successRate,
      }
    }))

    return NextResponse.json({ success: true, listings: enriched })
  } catch (error: any) {
    console.error('[Listings GET]', error)
    return NextResponse.json({ success: false, message: 'خطأ في جلب الإعلانات' }, { status: 500 })
  }
}

// POST: create new listing (merchant only)
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 })

    const user = await userOperations.findUnique({ id: userId })
    if (!user?.merchantId) {
      return NextResponse.json({ success: false, message: 'يجب أن تكون تاجر موثق لإنشاء إعلان' }, { status: 403 })
    }

    const { type, amount, price, currency, minAmount, maxAmount, paymentMethods, network } = await req.json()
    if (!type || !amount || !price || !paymentMethods?.length || !network) {
      return NextResponse.json({ success: false, message: 'جميع الحقول المطلوبة' }, { status: 400 })
    }

    const listing = await p2pListingOperations.create({
      merchantId: user.merchantId,
      type,
      amount,
      price,
      currency: currency || 'YER',
      minAmount: minAmount || 1,
      maxAmount: maxAmount || amount,
      paymentMethods,
      network,
      status: 'active',
    })

    return NextResponse.json({ success: true, listing })
  } catch (error: any) {
    console.error('[Listings POST]', error)
    return NextResponse.json({ success: false, message: 'خطأ في إنشاء الإعلان' }, { status: 500 })
  }
}
