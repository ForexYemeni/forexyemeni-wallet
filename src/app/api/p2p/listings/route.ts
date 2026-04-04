import { NextRequest, NextResponse } from 'next/server'
import { userOperations, merchantOperations, merchantApplicationOperations, p2pListingOperations } from '@/lib/db-firebase'

// GET: get active listings with filters
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || undefined
    const network = req.nextUrl.searchParams.get('network') || undefined
    const paymentMethod = req.nextUrl.searchParams.get('paymentMethod') || undefined

    const listings = await p2pListingOperations.findActive({ type, network, paymentMethod })

    // Attach merchant info (check both merchant systems)
    const enriched = await Promise.all(listings.map(async (l) => {
      // Try old merchant system first
      let merchant = await merchantOperations.findUnique(l.merchantId)
      if (!merchant) {
        // Try application system
        merchant = await merchantApplicationOperations.findById(l.merchantId) as any
      }
      const merchantUserId = merchant?.userId
      const user = merchantUserId ? await userOperations.findUnique({ id: merchantUserId }) : null
      return {
        ...l,
        merchantName: merchant?.fullName || merchant?.userFullName || user?.fullName || 'تاجر',
        merchantTrades: l.totalTrades,
        merchantRate: l.successRate,
      }
    }))

    return NextResponse.json({ success: true, listings: enriched })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في جلب الإعلانات' }, { status: 500 })
  }
}

// POST: create new listing (merchant only)
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 })

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Check if user is an approved merchant (check multiple sources)
    let effectiveMerchantId = user.merchantId

    // If no merchantId on user, check if there's an approved application
    if (!effectiveMerchantId) {
      const applications = await merchantApplicationOperations.findByUser(userId)
      const approvedApp = applications.find(a => a.status === 'approved')
      if (approvedApp) {
        effectiveMerchantId = approvedApp.id
        // Also set it on the user document for future requests
        await userOperations.update({ id: userId }, { merchantId: approvedApp.id })
      }
    }

    // Also check the old merchant system
    if (!effectiveMerchantId) {
      const oldMerchant = await merchantOperations.findApprovedByUser(userId)
      if (oldMerchant) {
        effectiveMerchantId = oldMerchant.id
        await userOperations.update({ id: userId }, { merchantId: oldMerchant.id })
      }
    }

    if (!effectiveMerchantId) {
      return NextResponse.json({ success: false, message: 'يجب أن تكون تاجر موثق لإنشاء إعلان' }, { status: 403 })
    }

    const { type, amount, price, currency, minAmount, maxAmount, paymentMethods, network } = await req.json()
    if (!type || !amount || !price || !paymentMethods?.length || !network) {
      return NextResponse.json({ success: false, message: 'جميع الحقول المطلوبة' }, { status: 400 })
    }

    const listing = await p2pListingOperations.create({
      merchantId: effectiveMerchantId,
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
    return NextResponse.json({ success: false, message: 'خطأ في إنشاء الإعلان' }, { status: 500 })
  }
}
