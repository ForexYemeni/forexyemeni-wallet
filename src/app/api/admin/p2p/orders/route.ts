import { NextRequest, NextResponse } from 'next/server'
import {
  userOperations,
  p2pOrderOperations,
  p2pDisputeOperations,
  transactionOperations,
  notificationOperations,
} from '@/lib/db-firebase'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

// Helper: verify admin
async function verifyAdmin(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return null
  const user = await userOperations.findUnique({ id: userId })
  if (!user || (user.role !== 'admin' && user.email !== ADMIN_EMAIL)) return null
  return user
}

// GET: list P2P orders with optional status filter
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح - مدير فقط' }, { status: 403 })
    }

    const status = req.nextUrl.searchParams.get('status') || undefined

    let orders
    if (status) {
      orders = await p2pOrderOperations.findMany({ status })
    } else {
      orders = await p2pOrderOperations.findMany()
    }

    // Attach user info
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const merchantUser = await userOperations.findUnique({ id: order.merchantId })
        let buyerUser = null
        if (order.buyerId) {
          buyerUser = await userOperations.findUnique({ id: order.buyerId })
        }

        // Get disputes for this order
        const disputes = await p2pDisputeOperations.findByOrder(order.id)

        return {
          ...order,
          merchantFullName: merchantUser?.fullName || merchantUser?.email || order.merchantName,
          buyerFullName: buyerUser?.fullName || buyerUser?.email || order.buyerName,
          disputes,
        }
      })
    )

    return NextResponse.json({
      success: true,
      orders: enriched,
      total: enriched.length,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في جلب قائمة الطلبات' }, { status: 500 })
  }
}

// POST: resolve dispute
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح - مدير فقط' }, { status: 403 })
    }

    const { action, adminId, orderId, resolution, action_type } = await req.json()

    if (!action || !adminId || !orderId || !action_type) {
      return NextResponse.json(
        { success: false, message: 'الإجراء ومعرف المدير ومعرف الطلب ونوع الإجراء مطلوبون' },
        { status: 400 }
      )
    }

    if (action !== 'resolve_dispute') {
      return NextResponse.json({ success: false, message: 'إجراء غير صالح' }, { status: 400 })
    }

    if (action_type !== 'release' && action_type !== 'refund') {
      return NextResponse.json({ success: false, message: 'نوع الإجراء يجب أن يكون تحرير أو استرداد' }, { status: 400 })
    }

    // Find order
    const order = await p2pOrderOperations.findById(orderId)
    if (!order) {
      return NextResponse.json({ success: false, message: 'الطلب غير موجود' }, { status: 404 })
    }

    if (order.status !== 'disputed') {
      return NextResponse.json({ success: false, message: 'الطلب ليس في حالة نزاع' }, { status: 400 })
    }

    // Find open dispute for this order
    const disputes = await p2pDisputeOperations.findByOrder(orderId)
    const openDispute = disputes.find((d) => d.status === 'open')
    if (!openDispute) {
      return NextResponse.json({ success: false, message: 'لا يوجد نزاع مفتوح لهذا الطلب' }, { status: 400 })
    }

    // ===== ACTION: RELEASE (credit buyer, complete order) =====
    if (action_type === 'release') {
      // For 'sell' orders: credit escrowAmount to buyer's balance
      if (order.type === 'sell' && order.buyerId) {
        const buyerUser = await userOperations.findUnique({ id: order.buyerId })
        if (buyerUser && (buyerUser.frozenBalance || 0) >= order.escrowAmount) {
          // Release from buyer's frozen balance back to buyer's balance
          const newBuyerFrozen = (buyerUser.frozenBalance || 0) - order.escrowAmount
          await userOperations.updateFrozenBalance(order.buyerId, newBuyerFrozen)
          await userOperations.incrementBalance(order.buyerId, order.escrowAmount)

          await transactionOperations.create({
            userId: order.buyerId,
            type: 'p2p_receive',
            amount: order.escrowAmount,
            balanceBefore: buyerUser.balance,
            balanceAfter: buyerUser.balance + order.escrowAmount,
            description: `استلام USDT بعد حل نزاع - طلب P2P ${orderId.substring(0, 8)}`,
            referenceId: orderId,
          })
        }
      }

      // Mark order as completed
      await p2pOrderOperations.updateStatus(orderId, 'completed', {
        sellerReleasedAt: new Date().toISOString(),
      })

      // Update dispute status
      await p2pDisputeOperations.update(openDispute.id, {
        status: 'resolved',
        resolution: resolution || 'تم تحرير الأموال للمشتري',
        resolvedBy: adminId,
        resolvedAt: new Date().toISOString(),
      })

      // Notify both parties
      if (order.buyerId) {
        await notificationOperations.create({
          userId: order.buyerId,
          title: 'تم حل النزاع - لصالحك',
          message: `تم حل النزاع في طلب P2P بقيمة ${order.amount} USDT. تم تحرير الأموال إلى حسابك.`,
          type: 'p2p',
          read: false,
        })
      }

      await notificationOperations.create({
        userId: order.merchantId,
        title: 'تم حل النزاع',
        message: `تم حل النزاع في طلب P2P بقيمة ${order.amount} USDT. تم تحرير الأموال للمشتري.`,
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({ success: true, message: 'تم حل النزاع وتحرير الأموال للمشتري بنجاح' })
    }

    // ===== ACTION: REFUND (refund buyer's frozen balance, cancel order) =====
    if (action_type === 'refund') {
      // For 'sell' orders: refund buyer's frozen balance
      if (order.type === 'sell' && order.buyerId) {
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
            description: `استرداد من الحساب الأماني بعد حل نزاع - طلب P2P ${orderId.substring(0, 8)}`,
            referenceId: orderId,
          })
        }
      }

      // Mark order as cancelled
      await p2pOrderOperations.updateStatus(orderId, 'cancelled')

      // Update dispute status
      await p2pDisputeOperations.update(openDispute.id, {
        status: 'resolved',
        resolution: resolution || 'تم استرداد الأموال للمشتري',
        resolvedBy: adminId,
        resolvedAt: new Date().toISOString(),
      })

      // Notify both parties
      if (order.buyerId) {
        await notificationOperations.create({
          userId: order.buyerId,
          title: 'تم حل النزاع - استرداد',
          message: `تم حل النزاع في طلب P2P بقيمة ${order.amount} USDT. تم استرداد المبلغ إلى حسابك.`,
          type: 'p2p',
          read: false,
        })
      }

      await notificationOperations.create({
        userId: order.merchantId,
        title: 'تم حل النزاع',
        message: `تم حل النزاع في طلب P2P بقيمة ${order.amount} USDT. تم إلغاء الطلب واسترداد الأموال للمشتري.`,
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({ success: true, message: 'تم حل النزاع واسترداد الأموال للمشتري بنجاح' })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في حل النزاع' }, { status: 500 })
  }
}
