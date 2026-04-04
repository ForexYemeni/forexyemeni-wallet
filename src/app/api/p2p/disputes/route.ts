import { NextRequest, NextResponse } from 'next/server'
import { userOperations, p2pTradeOperations, p2pListingOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'

// Helper: verify admin
async function verifyAdmin(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return null
  const user = await userOperations.findUnique({ id: userId })
  if (!user || user.role !== 'admin') return null
  return user
}

// GET: list open disputes
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) return NextResponse.json({ success: false, message: 'غير مصرح - مدير فقط' }, { status: 403 })

    const trades = await p2pTradeOperations.findAllDisputed()

    const enriched = await Promise.all(trades.map(async (t) => {
      const buyer = await userOperations.findUnique({ id: t.buyerId })
      const seller = await userOperations.findUnique({ id: t.sellerId })
      return {
        ...t,
        buyerName: buyer?.fullName || buyer?.email,
        sellerName: seller?.fullName || seller?.email,
      }
    }))

    return NextResponse.json({ success: true, disputes: enriched })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في جلب النزاعات' }, { status: 500 })
  }
}

// POST: resolve dispute (release to buyer or refund to seller)
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) return NextResponse.json({ success: false, message: 'غير مصرح - مدير فقط' }, { status: 403 })

    const { tradeId, resolution, note } = await req.json()
    if (!tradeId || !resolution) {
      return NextResponse.json({ success: false, message: 'بيانات مطلوبة' }, { status: 400 })
    }

    const trade = await p2pTradeOperations.findUnique(tradeId)
    if (!trade || trade.status !== 'disputed') {
      return NextResponse.json({ success: false, message: 'الصفقة غير موجودة أو ليست في حالة نزاع' }, { status: 404 })
    }

    await p2pTradeOperations.resolveDispute(tradeId, resolution, note || '')

    const resolvedBy = resolution // 'buyer' or 'seller'

    if (resolvedBy === 'buyer') {
      // Release funds to buyer
      const seller = await userOperations.findUnique({ id: trade.sellerId })
      if (seller && (seller.frozenBalance || 0) >= trade.amount) {
        const newFrozen = seller.frozenBalance - trade.amount
        await userOperations.updateFrozenBalance(trade.sellerId, newFrozen)
        const buyer = await userOperations.findUnique({ id: trade.buyerId })
        if (buyer) {
          await userOperations.incrementBalance(trade.buyerId, trade.amount)
          await transactionOperations.create({
            userId: trade.buyerId,
            type: 'p2p_receive',
            amount: trade.amount,
            balanceBefore: buyer.balance,
            balanceAfter: buyer.balance + trade.amount,
            description: `استلام USDT بعد حل نزاع - صفقة ${tradeId.substring(0, 8)}`,
            referenceId: tradeId,
          })
        }
      }
      await p2pTradeOperations.updateStatus(tradeId, 'released')
      await p2pListingOperations.incrementTrades(trade.listingId, true)
    } else {
      // Refund to seller
      const seller = await userOperations.findUnique({ id: trade.sellerId })
      if (seller && (seller.frozenBalance || 0) >= trade.amount) {
        const newFrozen = seller.frozenBalance - trade.amount
        await userOperations.updateFrozenBalance(trade.sellerId, newFrozen)
        await userOperations.incrementBalance(trade.sellerId, trade.amount)
      }
      await p2pTradeOperations.updateStatus(tradeId, 'cancelled')
      await p2pListingOperations.incrementTrades(trade.listingId, false)
    }

    // Notify both parties
    await notificationOperations.create({
      userId: trade.buyerId,
      title: 'تم حل النزاع',
      message: `تم حل النزاع: ${note || 'تم المراجعة'} - الإجراء: ${resolvedBy === 'buyer' ? 'صالح للمشتري' : 'مسترد للبائع'}`,
      type: 'p2p',
      read: false,
    })
    await notificationOperations.create({
      userId: trade.sellerId,
      title: 'تم حل النزاع',
      message: `تم حل النزاع: ${note || 'تم المراجعة'} - الإجراء: ${resolvedBy === 'buyer' ? 'صالح للمشتري' : 'مسترد للبائع'}`,
      type: 'p2p',
      read: false,
    })

    return NextResponse.json({ success: true, message: 'تم حل النزاع بنجاح' })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في حل النزاع' }, { status: 500 })
  }
}
