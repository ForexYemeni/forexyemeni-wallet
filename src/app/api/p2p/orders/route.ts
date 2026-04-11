import { NextRequest, NextResponse } from 'next/server'
import {
  userOperations,
  merchantApplicationOperations,
  p2pOrderOperations,
  notificationOperations,
} from '@/lib/db-firebase'

// GET: list open (non-expired) P2P orders with optional filters
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || undefined
    const network = req.nextUrl.searchParams.get('network') || undefined

    const orders = await p2pOrderOperations.findOpen({ type, network })

    // Attach merchant user info
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const merchantUser = await userOperations.findUnique({ id: order.merchantId })
        return {
          ...order,
          merchantFullName: merchantUser?.fullName || merchantUser?.email || order.merchantName,
          merchantAvatar: merchantUser?.fullName?.charAt(0) || 'ت',
        }
      })
    )

    return NextResponse.json({ success: true, orders: enriched })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في جلب قائمة الطلبات' }, { status: 500 })
  }
}

// POST: create_order or my_orders
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, userId } = body

    if (!action || !userId) {
      return NextResponse.json({ success: false, message: 'الإجراء ومعرف المستخدم مطلوبان' }, { status: 400 })
    }

    // ==================== CREATE ORDER ====================
    if (action === 'create_order') {
      const { type, network, amount, price, minAmount, maxAmount, paymentMethods, paymentDetails } = body

      // Validate required fields
      if (!type || !network || !amount || !price || !minAmount || !maxAmount || !paymentMethods?.length || !paymentDetails) {
        return NextResponse.json(
          { success: false, message: 'جميع الحقول مطلوبة: نوع الطلب، الشبكة، الكمية، السعر، الحد الأدنى، الحد الأقصى، طرق الدفع، تفاصيل الدفع' },
          { status: 400 }
        )
      }

      if (type !== 'sell' && type !== 'buy') {
        return NextResponse.json({ success: false, message: 'نوع الطلب يجب أن يكون بيع أو شراء' }, { status: 400 })
      }

      if (network !== 'TRC20' && network !== 'ERC20') {
        return NextResponse.json({ success: false, message: 'الشبكة يجب أن تكون TRC20 أو ERC20' }, { status: 400 })
      }

      // Find user
      const user = await userOperations.findUnique({ id: userId })
      if (!user) {
        return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
      }

      // Verify user is an approved merchant
      const approvedApp = (await merchantApplicationOperations.findByUser(userId)).find(
        (a) => a.status === 'approved'
      )
      if (!approvedApp) {
        return NextResponse.json(
          { success: false, message: 'يجب أن تكون تاجر موثق لإنشاء طلب. قدم طلب التوثيق أولاً.' },
          { status: 403 }
        )
      }

      // Get commission settings from database
      const db = (await import('@/lib/firebase')).getDb()
      let commissionSettings: { p2pFeePercent?: number; adminCommissionPercent?: number } = {}
      try {
        const commDoc = await db.collection('systemSettings').doc('commission').get()
        if (commDoc.exists) {
          commissionSettings = commDoc.data() as typeof commissionSettings
        }
      } catch {}
      
      const p2pFeePercent = commissionSettings.p2pFeePercent ?? 0.5
      const adminCommissionPercent = commissionSettings.adminCommissionPercent ?? 1
      
      // Calculate fees
      const p2pFee = parseFloat((amount * (p2pFeePercent / 100)).toFixed(2))
      const adminCommission = parseFloat((amount * (adminCommissionPercent / 100)).toFixed(2))
      const escrowAmount = type === 'sell' ? amount : 0
      const totalAmount = amount - p2pFee

      // Set expiration: 30 minutes from now
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

      // Create order
      const order = await p2pOrderOperations.create({
        merchantId: userId,
        merchantName: user.fullName || user.email,
        merchantEmail: user.email,
        type,
        asset: 'USDT',
        network,
        amount,
        price,
        minAmount,
        maxAmount,
        paymentMethods,
        paymentDetails,
        status: 'open',
        escrowAmount,
        p2pFee,
        totalAmount,
        expiresAt,
        p2pFeePercent,
        adminCommissionPercent,
        adminCommission: 0, // Will be set when trade completes
      })

      await notificationOperations.create({
        userId,
        title: 'تم إنشاء طلب P2P',
        message: `تم إنشاء طلب ${type === 'sell' ? 'بيع' : 'شراء'} ${amount} USDT بنجاح عبر ${network}`,
        type: 'p2p',
        read: false,
      })

      return NextResponse.json({
        success: true,
        message: 'تم إنشاء الطلب بنجاح',
        order: {
          ...order,
          p2pFeePercent,
          adminCommissionPercent,
        },
      })
    }

    // ==================== MY ORDERS ====================
    if (action === 'my_orders') {
      const merchantOrders = await p2pOrderOperations.findMerchantOrders(userId)
      const buyerOrders = await p2pOrderOperations.findBuyerOrders(userId)

      // Merge and deduplicate
      const orderMap = new Map<string, any>()
      for (const o of [...merchantOrders, ...buyerOrders]) {
        if (!orderMap.has(o.id)) {
          orderMap.set(o.id, o)
        }
      }

      const allOrders = Array.from(orderMap.values())
      allOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return NextResponse.json({
        success: true,
        orders: allOrders,
        total: allOrders.length,
      })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'خطأ في معالجة الطلب' }, { status: 500 })
  }
}
