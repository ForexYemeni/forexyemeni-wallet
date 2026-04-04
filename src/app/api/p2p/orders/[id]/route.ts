import { NextRequest, NextResponse } from 'next/server'
import {
  userOperations,
  p2pOrderOperations,
  p2pDisputeOperations,
  transactionOperations,
  notificationOperations,
} from '@/lib/db-firebase'

// GET: get order details by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await p2pOrderOperations.findById(id)

    if (!order) {
      return NextResponse.json({ success: false, message: 'الطلب غير موجود' }, { status: 404 })
    }

    // Attach extra user info
    const merchantUser = await userOperations.findUnique({ id: order.merchantId })
    let buyerUser = null
    if (order.buyerId) {
      buyerUser = await userOperations.findUnique({ id: order.buyerId })
    }

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        merchantFullName: merchantUser?.fullName || merchantUser?.email || order.merchantName,
        buyerFullName: buyerUser?.fullName || buyerUser?.email || order.buyerName,
      },
    })
  } catch (error: any) {
    console.error('[P2P Order Detail GET]', error)
    return NextResponse.json({ success: false, message: 'خطأ في جلب تفاصيل الطلب' }, { status: 500 })
  }
}

// POST: order actions (take_order, confirm_payment, release_funds, cancel_order, dispute)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { action, userId, disputeReason } = await req.json()

    if (!action || !userId) {
      return NextResponse.json({ success: false, message: 'الإجراء ومعرف المستخدم مطلوبان' }, { status: 400 })
    }

    const order = await p2pOrderOperations.findById(id)
    if (!order) {
      return NextResponse.json({ success: false, message: 'الطلب غير موجود' }, { status: 404 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // ==================== TAKE ORDER ====================
    if (action === 'take_order') {
      // Verify order is open and not expired
      if (order.status !== 'open') {
        return NextResponse.json({ success: false, message: 'هذا الطلب غير متاح حالياً' }, { status: 400 })
      }

      const now = new Date()
      if (new Date(order.expiresAt) < now) {
        await p2pOrderOperations.updateStatus(id, 'cancelled')
        return NextResponse.json({ success: false, message: 'انتهت صلاحية هذا الطلب' }, { status: 400 })
      }

      // Verify user is not the merchant
      if (order.merchantId === userId) {
        return NextResponse.json({ success: false, message: 'لا يمكنك أخذ طلبك الخاص' }, { status: 400 })
      }

      // For 'sell' orders: buyer pays the merchant, so we need to escrow from buyer
      if (order.type === 'sell') {
        // Buyer needs to have enough balance for escrow
        if (user.balance < order.escrowAmount) {
          return NextResponse.json(
            { success: false, message: `رصيد غير كافٍ. تحتاج ${order.escrowAmount} USDT في حسابك` },
            { status: 400 }
          )
        }

        // Deduct from buyer balance and add to frozen balance
        const newBalance = user.balance - order.escrowAmount
        const newFrozen = (user.frozenBalance || 0) + order.escrowAmount
        await userOperations.updateBalance(userId, newBalance)
        await userOperations.updateFrozenBalance(userId, newFrozen)

        // Record transaction
        await transactionOperations.create({
          userId,
          type: 'p2p_escrow',
          amount: order.escrowAmount,
          balanceBefore: user.balance,
          balanceAfter: newBalance,
          description: `حجز مبلغ في الحساب الأماني - طلب P2P ${id.substring(0, 8)}`,
          referenceId: id,
        })
      }

      // Update order status to in_progress
      const updatedOrder = await p2pOrderOperations.updateStatus(id, 'in_progress', {
        buyerId: userId,
        buyerName: user.fullName || user.email,
        buyerEmail: user.email,
      })

      // Notify merchant
      await notificationOperations.create({
        userId: order.merchantId,
        title: 'تم أخذ طلبك',
        message: `قام ${user.fullName || user.email} بأخذ طلب ${order.type === 'sell' ? 'البيع' : 'الشراء'} الخاص بك بمبلغ ${order.amount} USDT`,
        type: 'p2p',
        read: false,
      })

      // Notify buyer
      await notificationOperations.create({
        userId,
        title: 'تم أخذ الطلب بنجاح',
        message: `تم أخذ طلب ${order.type === 'sell' ? 'البيع' : 'الشراء'} بمبلغ ${order.amount} USDT. ${
          order.type === 'sell'
            ? 'يرجى إتمام التحويل البنكي وإثبات الدفع.'
            : 'يرجى تحويل العملات الرقمية.'
        }`,
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({
        success: true,
        message: 'تم أخذ الطلب بنجاح',
        order: updatedOrder,
      })
    }

    // ==================== CONFIRM PAYMENT ====================
    if (action === 'confirm_payment') {
      if (order.status !== 'in_progress') {
        return NextResponse.json({ success: false, message: 'حالة الطلب غير صالحة لتأكيد الدفع' }, { status: 400 })
      }

      // Verify user is the buyer
      if (order.buyerId !== userId) {
        return NextResponse.json({ success: false, message: 'فقط المشتري يمكنه تأكيد الدفع' }, { status: 403 })
      }

      const updatedOrder = await p2pOrderOperations.updateStatus(id, 'in_progress', {
        buyerPaidAt: new Date().toISOString(),
        buyerConfirmedAt: new Date().toISOString(),
      })

      // Notify merchant
      await notificationOperations.create({
        userId: order.merchantId,
        title: 'المشتري أكد الدفع',
        message: `قام المشتري ${user.fullName || user.email} بتأكيد إتمام التحويل. يرجى التحقق من استلام المبلغ ثم تحرير العملات.`,
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({
        success: true,
        message: 'تم تأكيد الدفع بنجاح. بانتظار التاجر للتحقق.',
        order: updatedOrder,
      })
    }

    // ==================== RELEASE FUNDS ====================
    if (action === 'release_funds') {
      if (order.status !== 'in_progress') {
        return NextResponse.json({ success: false, message: 'حالة الطلب غير صالحة لتحرير الأموال' }, { status: 400 })
      }

      // Verify user is the merchant/seller
      if (order.merchantId !== userId) {
        return NextResponse.json({ success: false, message: 'فقط التاجر يمكنه تحرير الأموال' }, { status: 403 })
      }

      // For 'sell' orders: credit escrowAmount to buyer's balance
      if (order.type === 'sell' && order.buyerId) {
        const buyerUser = await userOperations.findUnique({ id: order.buyerId })
        if (buyerUser) {
          // Release from buyer's frozen balance back to buyer's balance
          const newBuyerFrozen = Math.max(0, (buyerUser.frozenBalance || 0) - order.escrowAmount)
          await userOperations.updateFrozenBalance(order.buyerId, newBuyerFrozen)
          await userOperations.incrementBalance(order.buyerId, order.escrowAmount)

          // Record transaction for buyer
          await transactionOperations.create({
            userId: order.buyerId,
            type: 'p2p_receive',
            amount: order.escrowAmount,
            balanceBefore: buyerUser.balance,
            balanceAfter: buyerUser.balance + order.escrowAmount,
            description: `استلام USDT بعد تحرير الأموال - طلب P2P ${id.substring(0, 8)}`,
            referenceId: id,
          })
        }
      }

      const updatedOrder = await p2pOrderOperations.updateStatus(id, 'completed', {
        sellerReleasedAt: new Date().toISOString(),
      })

      // Notify buyer
      if (order.buyerId) {
        await notificationOperations.create({
          userId: order.buyerId,
          title: 'تم تحرير العملات',
          message: `تم تحرير ${order.escrowAmount} USDT إلى حسابك بنجاح`,
          type: 'p2p',
          read: false,
        })
      }

      return NextResponse.json({
        success: true,
        message: 'تم تحرير الأموال بنجاح',
        order: updatedOrder,
      })
    }

    // ==================== CANCEL ORDER ====================
    if (action === 'cancel_order') {
      if (order.status !== 'open' && order.status !== 'in_progress') {
        return NextResponse.json({ success: false, message: 'لا يمكن الإلغاء في هذه الحالة' }, { status: 400 })
      }

      // Only allow merchant to cancel open orders, or buyer/merchant to cancel in_progress
      const isMerchant = order.merchantId === userId
      const isBuyer = order.buyerId === userId

      if (order.status === 'open' && !isMerchant) {
        return NextResponse.json({ success: false, message: 'فقط التاجر يمكنه إلغاء الطلب المفتوح' }, { status: 403 })
      }

      if (order.status === 'in_progress' && !isMerchant && !isBuyer) {
        return NextResponse.json({ success: false, message: 'غير مصرح بإلغاء هذا الطلب' }, { status: 403 })
      }

      // If in_progress and has buyer, refund buyer's frozen balance
      if (order.status === 'in_progress' && order.buyerId && order.type === 'sell') {
        const buyerUser = await userOperations.findUnique({ id: order.buyerId })
        if (buyerUser && (buyerUser.frozenBalance || 0) >= order.escrowAmount) {
          const newBuyerFrozen = (buyerUser.frozenBalance || 0) - order.escrowAmount
          await userOperations.updateFrozenBalance(order.buyerId, newBuyerFrozen)
          await userOperations.incrementBalance(order.buyerId, order.escrowAmount)

          await transactionOperations.create({
            userId: order.buyerId,
            type: 'p2p_refund',
            amount: order.escrowAmount,
            balanceBefore: buyerUser.balance,
            balanceAfter: buyerUser.balance + order.escrowAmount,
            description: `استرداد من الحساب الأماني بعد إلغاء الطلب - ${id.substring(0, 8)}`,
            referenceId: id,
          })
        }
      }

      const updatedOrder = await p2pOrderOperations.updateStatus(id, 'cancelled')

      // Notify the other party
      const otherPartyId = isMerchant ? order.buyerId : order.merchantId
      if (otherPartyId) {
        await notificationOperations.create({
          userId: otherPartyId,
          title: 'تم إلغاء الطلب',
          message: `تم إلغاء طلب P2P بقيمة ${order.amount} USDT من قبل ${isMerchant ? 'التاجر' : 'المشتري'}`,
          type: 'p2p',
          read: false,
        })
      }

      return NextResponse.json({
        success: true,
        message: 'تم إلغاء الطلب بنجاح',
        order: updatedOrder,
      })
    }

    // ==================== DISPUTE ====================
    if (action === 'dispute') {
      if (order.status !== 'in_progress') {
        return NextResponse.json({ success: false, message: 'لا يمكن فتح نزاع إلا أثناء تنفيذ الطلب' }, { status: 400 })
      }

      const isMerchant = order.merchantId === userId
      const isBuyer = order.buyerId === userId

      if (!isMerchant && !isBuyer) {
        return NextResponse.json({ success: false, message: 'غير مصرح بفتح نزاع في هذا الطلب' }, { status: 403 })
      }

      if (!disputeReason) {
        return NextResponse.json({ success: false, message: 'سبب النزاع مطلوب' }, { status: 400 })
      }

      // Create dispute record
      const dispute = await p2pDisputeOperations.create({
        orderId: id,
        reporterId: userId,
        reporterName: user.fullName || user.email,
        reporterType: isMerchant ? 'merchant' : 'buyer',
        reason: disputeReason,
      })

      // Update order status to disputed
      const updatedOrder = await p2pOrderOperations.updateStatus(id, 'disputed')

      // Notify both parties
      const otherPartyId = isMerchant ? order.buyerId : order.merchantId
      if (otherPartyId) {
        await notificationOperations.create({
          userId: otherPartyId,
          title: 'تم فتح نزاع',
          message: `تم فتح نزاع في طلب P2P بقيمة ${order.amount} USDT. سيتم مراجعته من قبل الإدارة.`,
          type: 'p2p',
          read: false,
        })
      }

      await notificationOperations.create({
        userId,
        title: 'تم فتح النزاع بنجاح',
        message: 'تم فتح نزاع في طلبك. سيقوم فريق الإدارة بمراجعته والرد عليك قريباً.',
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({
        success: true,
        message: 'تم فتح النزاع بنجاح. سيتم مراجعته من قبل الإدارة.',
        dispute,
        order: updatedOrder,
      })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: any) {
    console.error('[P2P Order Detail POST]', error)
    return NextResponse.json({ success: false, message: 'خطأ في تنفيذ الإجراء' }, { status: 500 })
  }
}
