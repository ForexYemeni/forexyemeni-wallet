import { NextRequest, NextResponse } from 'next/server'
import { userOperations, p2pListingOperations, p2pTradeOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'

// GET: get trade details
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 })

    const { id } = await params
    const trade = await p2pTradeOperations.findUnique(id)
    if (!trade) return NextResponse.json({ success: false, message: 'الصفقة غير موجودة' }, { status: 404 })

    // Only allow buyer or seller to view
    if (trade.buyerId !== userId && trade.sellerId !== userId) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const listing = await p2pListingOperations.findUnique(trade.listingId)
    const buyer = await userOperations.findUnique({ id: trade.buyerId })
    const seller = await userOperations.findUnique({ id: trade.sellerId })

    return NextResponse.json({
      success: true,
      trade: {
        ...trade,
        listingType: listing?.type,
        listingNetwork: listing?.network,
        buyerName: buyer?.fullName || buyer?.email,
        sellerName: seller?.fullName || seller?.email,
      },
    })
  } catch (error: any) {
    console.error('[Trade Detail GET]', error)
    return NextResponse.json({ success: false, message: 'خطأ' }, { status: 500 })
  }
}

// POST: trade actions
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 })

    const { id } = await params
    const { action, disputeReason, buyerPaymentRef } = await req.json()

    const trade = await p2pTradeOperations.findUnique(id)
    if (!trade) return NextResponse.json({ success: false, message: 'الصفقة غير موجودة' }, { status: 404 })

    const isBuyer = trade.buyerId === userId
    const isSeller = trade.sellerId === userId

    // FUND ESCROW: seller funds escrow (deduct from seller balance)
    if (action === 'fund_escrow') {
      if (!isSeller) return NextResponse.json({ success: false, message: 'فقط البائع يمكنه تمويل الحساب الأماني' }, { status: 403 })
      if (trade.status !== 'pending') return NextResponse.json({ success: false, message: 'حالة الصفقة غير صالحة' }, { status: 400 })

      const seller = await userOperations.findUnique({ id: userId })
      if (!seller || seller.balance < trade.amount) {
        return NextResponse.json({ success: false, message: 'رصيد غير كافي' }, { status: 400 })
      }

      // Deduct from seller balance
      await userOperations.updateBalance(userId, seller.balance - trade.amount)
      await userOperations.updateFrozenBalance(userId, (seller.frozenBalance || 0) + trade.amount)

      // Create transaction record
      await transactionOperations.create({
        userId,
        type: 'p2p_escrow',
        amount: trade.amount,
        balanceBefore: seller.balance,
        balanceAfter: seller.balance - trade.amount,
        description: `تمويل حساب أماني - صفقة ${id.substring(0, 8)}`,
        referenceId: id,
      })

      await p2pTradeOperations.updateStatus(id, 'escrowed', { escrowTxId: `ESC-${Date.now()}` })

      await notificationOperations.create({
        userId: trade.buyerId,
        title: 'تم تمويل حساب الأماني',
        message: 'البائع قام بتمويل حساب الأماني. يمكنك الآن إتمام التحويل.',
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({ success: true, message: 'تم تمويل حساب الأماني' })
    }

    // CONFIRM PAYMENT: buyer confirms they sent payment
    if (action === 'confirm_payment') {
      if (!isBuyer) return NextResponse.json({ success: false, message: 'فقط المشتري يمكنه تأكيد الدفع' }, { status: 403 })
      if (trade.status !== 'escrowed') return NextResponse.json({ success: false, message: 'يجب تمويل حساب الأماني أولاً' }, { status: 400 })

      await p2pTradeOperations.updateStatus(id, 'paid', { buyerPaymentRef: buyerPaymentRef || trade.buyerPaymentRef })

      await notificationOperations.create({
        userId: trade.sellerId,
        title: 'المشتري أكد التحويل',
        message: 'المشتري أكد أنه قام بالتحويل. تحقق من استلام المبلغ ثم حرر العملات.',
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({ success: true, message: 'تم تأكيد الدفع' })
    }

    // RELEASE COINS: seller releases USDT to buyer
    if (action === 'release_coins') {
      if (!isSeller) return NextResponse.json({ success: false, message: 'فقط البائع يمكنه تحرير العملات' }, { status: 403 })
      if (trade.status !== 'paid') return NextResponse.json({ success: false, message: 'يجب أن يؤكد المشتري الدفع أولاً' }, { status: 400 })

      const seller = await userOperations.findUnique({ id: userId })
      if (!seller) return NextResponse.json({ success: false, message: 'البائع غير موجود' }, { status: 404 })

      // Release escrow: deduct from seller frozen, add to buyer balance
      const newSellerFrozen = Math.max(0, (seller.frozenBalance || 0) - trade.amount)
      await userOperations.updateFrozenBalance(userId, newSellerFrozen)

      const buyer = await userOperations.findUnique({ id: trade.buyerId })
      if (buyer) {
        await userOperations.incrementBalance(trade.buyerId, trade.amount)

        // Create transaction for buyer
        await transactionOperations.create({
          userId: trade.buyerId,
          type: 'p2p_receive',
          amount: trade.amount,
          balanceBefore: buyer.balance,
          balanceAfter: buyer.balance + trade.amount,
          description: `استلام USDT - صفقة ${id.substring(0, 8)}`,
          referenceId: id,
        })
      }

      await p2pTradeOperations.updateStatus(id, 'released')

      // Update listing stats
      await p2pListingOperations.incrementTrades(trade.listingId, true)

      await notificationOperations.create({
        userId: trade.buyerId,
        title: 'تم تحرير العملات',
        message: `تم تحرير ${trade.amount} USDT إلى حسابك`,
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({ success: true, message: 'تم تحرير العملات بنجاح' })
    }

    // OPEN DISPUTE
    if (action === 'open_dispute') {
      if (!isBuyer && !isSeller) return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
      if (!['escrowed', 'paid', 'pending'].includes(trade.status)) {
        return NextResponse.json({ success: false, message: 'لا يمكن فتح نزاع في هذه الحالة' }, { status: 400 })
      }

      await p2pTradeOperations.addDispute(id, disputeReason || 'لم يتم تحديد سبب')

      await notificationOperations.create({
        userId: trade.buyerId === userId ? trade.sellerId : trade.buyerId,
        title: 'تم فتح نزاع',
        message: 'تم فتح نزاع في صفقة P2P. سيتم مراجعته من قبل الإدارة.',
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({ success: true, message: 'تم فتح النزاع' })
    }

    // CANCEL TRADE
    if (action === 'cancel_trade') {
      if (!isBuyer && !isSeller) return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
      if (!['pending', 'escrowed'].includes(trade.status)) {
        return NextResponse.json({ success: false, message: 'لا يمكن الإلغاء في هذه الحالة' }, { status: 400 })
      }

      // If escrowed, return funds to seller
      if (trade.status === 'escrowed' && isSeller) {
        const seller = await userOperations.findUnique({ id: userId })
        if (seller) {
          const newFrozen = Math.max(0, (seller.frozenBalance || 0) - trade.amount)
          await userOperations.updateFrozenBalance(userId, newFrozen)
          await userOperations.incrementBalance(userId, trade.amount)
        }
      }

      await p2pTradeOperations.updateStatus(id, 'cancelled')

      await notificationOperations.create({
        userId: trade.buyerId === userId ? trade.sellerId : trade.buyerId,
        title: 'تم إلغاء الصفقة',
        message: 'تم إلغاء صفقة P2P',
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({ success: true, message: 'تم إلغاء الصفقة' })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير صالح' }, { status: 400 })
  } catch (error: any) {
    console.error('[Trade Detail POST]', error)
    return NextResponse.json({ success: false, message: 'خطأ في تنفيذ الإجراء' }, { status: 500 })
  }
}
