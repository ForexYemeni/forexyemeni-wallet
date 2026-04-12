import { NextRequest, NextResponse } from 'next/server'
import { userOperations, merchantOperations, merchantApplicationOperations, p2pListingOperations } from '@/lib/db-firebase'
import { authenticateRequest } from '@/lib/auth-server'

// GET: get active listings with filters (public - no auth needed)
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || undefined
    const network = req.nextUrl.searchParams.get('network') || undefined
    const paymentMethod = req.nextUrl.searchParams.get('paymentMethod') || undefined
    const merchantId = req.nextUrl.searchParams.get('merchantId') || undefined

    // If merchantId is provided, return ALL listings for that merchant
    if (merchantId) {
      const listings = await p2pListingOperations.findByMerchant(merchantId)
      let filtered = listings
      if (type) filtered = filtered.filter(l => l.type === type)
      if (network) filtered = filtered.filter(l => l.network === network)
      if (paymentMethod) filtered = filtered.filter(l => l.paymentMethods.includes(paymentMethod))
      const enriched = await Promise.all(filtered.map(async (l) => {
        let merchant: any = await merchantOperations.findUnique(l.merchantId)
        if (!merchant) {
          merchant = await merchantApplicationOperations.findById(l.merchantId)
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
    }

    const listings = await p2pListingOperations.findActive({ type, network, paymentMethod })

    const enriched = await Promise.all(listings.map(async (l) => {
      let merchant: any = await merchantOperations.findUnique(l.merchantId)
      if (!merchant) {
        merchant = await merchantApplicationOperations.findById(l.merchantId)
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
  const auth = await authenticateRequest(req)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    // Use authenticated user ID instead of client-provided header
    const userId = auth.user.id

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Check if user is an approved merchant (check multiple sources)
    let effectiveMerchantId = user.merchantId

    if (!effectiveMerchantId) {
      const applications = await merchantApplicationOperations.findByUser(userId)
      const approvedApp = applications.find(a => a.status === 'approved')
      if (approvedApp) {
        effectiveMerchantId = approvedApp.id
        await userOperations.update({ id: userId }, { merchantId: approvedApp.id })
      }
    }

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
