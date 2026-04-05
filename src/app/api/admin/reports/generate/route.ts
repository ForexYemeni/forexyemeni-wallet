import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// POST: Generate a summary report for a given period
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminId, period } = body as { adminId?: string; period?: string }

    // Validate inputs
    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المسؤول مطلوب' }, { status: 400 })
    }
    if (!period || !['daily', 'weekly'].includes(period)) {
      return NextResponse.json({ success: false, message: 'الفترة غير صالحة. استخدم daily أو weekly' }, { status: 400 })
    }

    const db = getDb()

    // Verify admin
    const adminDoc = await db.collection('users').doc(adminId).get()
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Calculate date range based on period
    const now = new Date()
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)

    if (period === 'daily') {
      // Today: from midnight today to now
      // from is already set to midnight today
    } else if (period === 'weekly') {
      // Last 7 days
      from.setDate(from.getDate() - 6)
    }

    const fromDateISO = from.toISOString()
    const toDateISO = now.toISOString()

    // Fetch all data in parallel
    const [usersSnap, depositsSnap, withdrawalsSnap, tradesSnap] = await Promise.all([
      db.collection('users').limit(2000).get(),
      db.collection('deposits').limit(2000).get(),
      db.collection('withdrawals').limit(2000).get(),
      db.collection('p2pTrades').limit(2000).get(),
    ])

    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
    const allDeposits = depositsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
    const allWithdrawals = withdrawalsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
    const allTrades = tradesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]

    // ===== USERS STATS =====
    // Total non-admin users
    const totalUsers = allUsers.filter(u => u.role !== 'admin').length

    // New users in period
    const newUsersInPeriod = allUsers.filter((u: any) => {
      if (!u.createdAt || u.role === 'admin') return false
      return new Date(u.createdAt) >= from && new Date(u.createdAt) <= now
    }).length

    // Active users (users who logged in during period — using updatedAt as proxy)
    const activeUsersInPeriod = allUsers.filter((u: any) => {
      if (!u.updatedAt || u.role === 'admin') return false
      return new Date(u.updatedAt) >= from && new Date(u.updatedAt) <= now
    }).length

    // ===== DEPOSITS STATS =====
    // Deposits in period (all statuses for count, confirmed for amount)
    const depositsInPeriod = allDeposits.filter((d: any) => {
      if (!d.createdAt) return false
      return new Date(d.createdAt) >= from && new Date(d.createdAt) <= now
    })
    const depositCountInPeriod = depositsInPeriod.length
    const depositAmountInPeriod = depositsInPeriod
      .filter((d: any) => d.status === 'confirmed')
      .reduce((sum: number, d: any) => sum + (d.netAmount || d.amount || 0), 0)

    // ===== WITHDRAWALS STATS =====
    // Withdrawals in period
    const withdrawalsInPeriod = allWithdrawals.filter((w: any) => {
      if (!w.createdAt) return false
      return new Date(w.createdAt) >= from && new Date(w.createdAt) <= now
    })
    const withdrawalCountInPeriod = withdrawalsInPeriod.length
    const withdrawalAmountInPeriod = withdrawalsInPeriod
      .filter((w: any) => w.status === 'processing')
      .reduce((sum: number, w: any) => sum + (w.amount || 0), 0)

    // ===== P2P TRADES STATS =====
    // Trades in period (exclude cancelled/expired)
    const p2pTradesInPeriod = allTrades.filter((t: any) => {
      if (!t.createdAt) return false
      if (t.status === 'cancelled' || t.status === 'expired') return false
      return new Date(t.createdAt) >= from && new Date(t.createdAt) <= now
    })
    const p2pTradeCountInPeriod = p2pTradesInPeriod.length

    // ===== BUILD REPORT =====
    const report = {
      period,
      periodLabel: period === 'daily' ? 'تقرير يومي' : 'تقرير أسبوعي',
      generatedAt: now.toISOString(),
      fromDate: fromDateISO,
      toDate: toDateISO,
      stats: {
        totalUsers,
        newUsersInPeriod,
        activeUsersInPeriod,
        depositAmountInPeriod: Math.round(depositAmountInPeriod * 100) / 100,
        depositCountInPeriod,
        withdrawalAmountInPeriod: Math.round(withdrawalAmountInPeriod * 100) / 100,
        withdrawalCountInPeriod,
        p2pTradeCountInPeriod,
      },
    }

    return NextResponse.json({
      success: true,
      report,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في إنشاء التقرير'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
