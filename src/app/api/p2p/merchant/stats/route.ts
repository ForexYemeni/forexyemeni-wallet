import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// Trade record from Firestore
interface TradeRecord {
  id: string
  status: string
  amount: number
  total: number
  buyerId: string
  sellerId: string
  createdAt: string
  completedAt?: string | null
  [key: string]: unknown
}

// Listing record from Firestore
interface ListingRecord {
  id: string
  status: string
  type: string
  amount: number
  price: number
  network: string
  totalTrades: number
  successRate: number
  [key: string]: unknown
}

// GET /api/p2p/merchant/stats?merchantId=xxx
// Returns comprehensive financial stats for a merchant
export async function GET(req: NextRequest) {
  try {
    const merchantId = req.nextUrl.searchParams.get('merchantId')
    if (!merchantId) {
      return NextResponse.json(
        { success: false, message: 'معرّف التاجر مطلوب' },
        { status: 400 }
      )
    }

    const db = getDb()

    // 1. Get merchant record to find userId
    const merchantDoc = await db.collection('merchants').doc(merchantId).get()
    if (!merchantDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'التاجر غير موجود' },
        { status: 404 }
      )
    }
    const merchantData = merchantDoc.data()
    const userId = merchantData?.userId

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'بيانات التاجر غير مكتملة' },
        { status: 400 }
      )
    }

    // 2. Fetch all trades where merchant is buyer or seller
    const [buyerSnapshot, sellerSnapshot] = await Promise.all([
      db.collection('p2pTrades')
        .where('buyerId', '==', userId)
        .limit(500)
        .get(),
      db.collection('p2pTrades')
        .where('sellerId', '==', userId)
        .limit(500)
        .get(),
    ])

    // Deduplicate trades (a trade can appear as both buyer and seller if merchant is both)
    const tradeMap = new Map<string, Record<string, unknown>>()
    for (const doc of [...buyerSnapshot.docs, ...sellerSnapshot.docs]) {
      tradeMap.set(doc.id, doc.data() as Record<string, unknown>)
    }
    const allTrades: TradeRecord[] = Array.from(tradeMap.entries()).map(([id, data]) => ({
      id,
      status: (data.status as string) || '',
      amount: (data.amount as number) || 0,
      total: (data.total as number) || 0,
      buyerId: (data.buyerId as string) || '',
      sellerId: (data.sellerId as string) || '',
      createdAt: (data.createdAt as string) || '',
      completedAt: (data.completedAt as string) || null,
    }))

    // 3. Fetch all listings for this merchant
    const listingsSnapshot = await db.collection('p2pListings')
      .where('merchantId', '==', merchantId)
      .limit(100)
      .get()
    const allListings: ListingRecord[] = listingsSnapshot.docs.map(doc => {
      const data = doc.data() as Record<string, unknown>
      return {
        id: doc.id,
        status: (data.status as string) || '',
        type: (data.type as string) || '',
        amount: (data.amount as number) || 0,
        price: (data.price as number) || 0,
        network: (data.network as string) || '',
        totalTrades: (data.totalTrades as number) || 0,
        successRate: (data.successRate as number) || 100,
      }
    })

    // 4. Calculate stats
    const completedTrades = allTrades.filter(
      (t) => t.status === 'released'
    )
    const pendingTrades = allTrades.filter((t) =>
      ['pending', 'escrowed', 'paid'].includes(t.status)
    )
    const cancelledTrades = allTrades.filter((t) =>
      ['cancelled', 'expired'].includes(t.status)
    )

    const totalTradeVolume = completedTrades.reduce(
      (sum, t) => sum + t.amount,
      0
    )

    // Calculate earnings: assume a 1% commission on completed trades
    // (This can be adjusted based on actual fee structure)
    const totalEarnings = completedTrades.reduce(
      (sum, t) => sum + t.amount * 0.01,
      0
    )

    const totalCompleted = completedTrades.length
    const totalAll = allTrades.length
    const successRate =
      totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0

    const activeListingsCount = allListings.filter(
      (l) => l.status === 'active'
    ).length

    const pendingOrdersCount = pendingTrades.length
    const completedOrdersCount = completedTrades.length

    // 5. Recent trades (last 10, sorted by date desc)
    const recentTrades = allTrades
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        amount: t.amount,
        total: t.total,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        type: t.buyerId === userId ? 'buy' as const : 'sell' as const,
      }))

    // 6. Active listings summary
    const activeListings = allListings
      .filter((l) => l.status === 'active')
      .map((l) => ({
        id: l.id,
        type: l.type,
        amount: l.amount,
        price: l.price,
        network: l.network,
        totalTrades: l.totalTrades,
        successRate: l.successRate,
      }))

    return NextResponse.json({
      success: true,
      stats: {
        totalCompletedTrades: totalCompleted,
        totalTrades: totalAll,
        totalTradeVolume,
        totalEarnings,
        successRate,
        activeListingsCount,
        pendingOrdersCount,
        completedOrdersCount,
        recentTrades,
        activeListings,
        cancelledCount: cancelledTrades.length,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: 'خطأ في جلب إحصائيات التاجر' },
      { status: 500 }
    )
  }
}
