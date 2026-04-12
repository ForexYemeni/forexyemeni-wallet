import { NextRequest, NextResponse } from 'next/server'
import { userOperations, merchantOperations, p2pListingOperations, p2pTradeOperations, notificationOperations } from '@/lib/db-firebase'
import { authenticateRequest } from '@/lib/auth-server'

// GET: get user's trades
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const userId = auth.user.id // Use authenticated user ID

    const trades = await p2pTradeOperations.findByUser(userId)

    const enriched = await Promise.all(trades.map(async (t) => {
      const listing = await p2pListingOperations.findUnique(t.listingId)
      const buyer = await userOperations.findUnique({ id: t.buyerId })
      const seller = await userOperations.findUnique({ id: t.sellerId })
      return {
        ...t,
        listingType: listing?.type,
        listingNetwork: listing?.network,
        buyerName: buyer?.fullName || buyer?.email,
        sellerName: seller?.fullName || seller?.email,
      }
    }))

    return NextResponse.json({ success: true, trades: enriched })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في جلب الصفقات' }, { status: 500 })
  }
}

// POST: create new trade
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const userId = auth.user.id // Use authenticated user ID

    const { listingId, amount, buyerPaymentMethod, buyerPaymentRef } = await req.json()
    if (!listingId || !amount || !buyerPaymentMethod) {
      return NextResponse.json({ success: false, message: 'بيانات الصفقة مطلوبة' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })

    const listing = await p2pListingOperations.findUnique(listingId)
    if (!listing || listing.status !== 'active') {
      return NextResponse.json({ success: false, message: 'الإعلان غير متاح' }, { status: 400 })
    }

    if (amount < listing.minAmount || amount > listing.maxAmount || amount > listing.amount) {
      return NextResponse.json({ success: false, message: `المبلغ يجب أن يكون بين ${listing.minAmount} و ${Math.min(listing.amount, listing.maxAmount)}` }, { status: 400 })
    }

    const total = amount * listing.price
    const merchant = await merchantOperations.findUnique(listing.merchantId)
    if (!merchant) return NextResponse.json({ success: false, message: 'التاجر غير موجود' }, { status: 404 })

    let buyerId: string
    let sellerId: string

    if (listing.type === 'sell') {
      buyerId = userId
      sellerId = merchant.userId
    } else {
      sellerId = userId
      buyerId = merchant.userId
    }

    if (buyerId === sellerId) {
      return NextResponse.json({ success: false, message: 'لا يمكنك التداول مع نفسك' }, { status: 400 })
    }

    const trade = await p2pTradeOperations.create({
      listingId,
      buyerId,
      sellerId,
      amount,
      price: listing.price,
      total,
      status: 'pending',
      buyerPaymentMethod,
      buyerPaymentRef: buyerPaymentRef || '',
      escrowTxId: '',
    })

    await notificationOperations.create({
      userId: buyerId,
      title: 'صفقة P2P جديدة',
      message: `تم إنشاء صفقة جديدة بمبلغ ${amount} USDT`,
      type: 'p2p',
      read: false,
    })
    await notificationOperations.create({
      userId: sellerId,
      title: 'صفقة P2P جديدة',
      message: `تم إنشاء صفقة جديدة بمبلغ ${amount} USDT`,
      type: 'p2p',
      read: false,
    })

    return NextResponse.json({ success: true, trade })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في إنشاء الصفقة' }, { status: 500 })
  }
}
