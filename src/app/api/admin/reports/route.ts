import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// Helper to format a date as YYYY-MM-DD
function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Helper to generate all dates in a range
function getDateRange(from: Date, to: Date): string[] {
  const dates: string[] = []
  const current = new Date(from)
  current.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(23, 59, 59, 999)

  while (current <= end) {
    dates.push(formatDateKey(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

// GET: Return financial report data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('adminId')
    const period = searchParams.get('period') || 'daily'
    const fromDateParam = searchParams.get('fromDate')
    const toDateParam = searchParams.get('toDate')

    // Verify admin
    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المسؤول مطلوب' }, { status: 400 })
    }

    const db = getDb()
    const adminDoc = await db.collection('users').doc(adminId).get()
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Determine date range
    const now = new Date()
    let from: Date
    let to: Date = new Date(now)

    if (fromDateParam && toDateParam) {
      from = new Date(fromDateParam)
      to = new Date(toDateParam)
    } else {
      // Default: last 7 days
      from = new Date(now)
      from.setDate(from.getDate() - 6)
    }

    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)

    const fromDateISO = from.toISOString()
    const toDateISO = to.toISOString()

    // Fetch all deposits and withdrawals (filter by date in JS to avoid composite index issues)
    const [depositsSnap, withdrawalsSnap, usersSnap] = await Promise.all([
      db.collection('deposits').limit(1000).get(),
      db.collection('withdrawals').limit(1000).get(),
      db.collection('users').limit(1000).get(),
    ])

    const allDeposits = depositsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const allWithdrawals = withdrawalsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Build user map for lookup
    const userMap = new Map<string, { fullName: string | null; email: string }>()
    for (const u of allUsers) {
      userMap.set(u.id, { fullName: u.fullName || null, email: u.email })
    }

    // Filter deposits by date range (only confirmed for totals)
    const filteredDeposits = allDeposits.filter((d: any) =>
      d.createdAt && new Date(d.createdAt) >= from && new Date(d.createdAt) <= to && d.status === 'confirmed'
    )

    // Filter withdrawals by date range (only processing for totals, like the stats route)
    const filteredWithdrawals = allWithdrawals.filter((w: any) =>
      w.createdAt && new Date(w.createdAt) >= from && new Date(w.createdAt) <= to && w.status === 'processing'
    )

    // Also get all deposits/withdrawals in range for daily stats (all statuses)
    const allDepositsInRange = allDeposits.filter((d: any) =>
      d.createdAt && new Date(d.createdAt) >= from && new Date(d.createdAt) <= to
    )
    const allWithdrawalsInRange = allWithdrawals.filter((w: any) =>
      w.createdAt && new Date(w.createdAt) >= from && new Date(w.createdAt) <= to
    )

    // Summary calculations
    const totalDeposits = filteredDeposits.reduce((sum, d: any) => sum + (d.netAmount || d.amount || 0), 0)
    const totalWithdrawals = filteredWithdrawals.reduce((sum, w: any) => sum + (w.amount || 0), 0)
    const totalFees = filteredDeposits.reduce((sum, d: any) => sum + (d.fee || 0), 0) +
      filteredWithdrawals.reduce((sum, w: any) => sum + (w.fee || 0), 0)
    const netFlow = totalDeposits - totalWithdrawals
    const depositCount = filteredDeposits.length
    const withdrawalCount = filteredWithdrawals.length

    const summary = {
      totalDeposits: Math.round(totalDeposits * 100) / 100,
      totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      netFlow: Math.round(netFlow * 100) / 100,
      depositCount,
      withdrawalCount,
    }

    // Group deposits by date
    const depositsByDate = new Map<string, { total: number; count: number; fees: number }>()
    for (const d of filteredDeposits) {
      const dateKey = formatDateKey(new Date(d.createdAt!))
      const existing = depositsByDate.get(dateKey) || { total: 0, count: 0, fees: 0 }
      existing.total += (d.netAmount || d.amount || 0)
      existing.count += 1
      existing.fees += (d.fee || 0)
      depositsByDate.set(dateKey, existing)
    }

    const deposits = getDateRange(from, to).map(date => {
      const data = depositsByDate.get(date) || { total: 0, count: 0, fees: 0 }
      return {
        date,
        total: Math.round(data.total * 100) / 100,
        count: data.count,
        fees: Math.round(data.fees * 100) / 100,
      }
    })

    // Group withdrawals by date
    const withdrawalsByDate = new Map<string, { total: number; count: number; fees: number }>()
    for (const w of filteredWithdrawals) {
      const dateKey = formatDateKey(new Date(w.createdAt!))
      const existing = withdrawalsByDate.get(dateKey) || { total: 0, count: 0, fees: 0 }
      existing.total += (w.amount || 0)
      existing.count += 1
      existing.fees += (w.fee || 0)
      withdrawalsByDate.set(dateKey, existing)
    }

    const withdrawals = getDateRange(from, to).map(date => {
      const data = withdrawalsByDate.get(date) || { total: 0, count: 0, fees: 0 }
      return {
        date,
        total: Math.round(data.total * 100) / 100,
        count: data.count,
        fees: Math.round(data.fees * 100) / 100,
      }
    })

    // Top 10 users by activity (total deposits + withdrawals)
    const userActivity = new Map<string, { userId: string; fullName: string | null; email: string; totalDeposits: number; totalWithdrawals: number }>()
    for (const d of filteredDeposits) {
      const uid = d.userId
      if (!uid) continue
      const existing = userActivity.get(uid) || { userId: uid, fullName: null, email: '', totalDeposits: 0, totalWithdrawals: 0 }
      existing.totalDeposits += (d.netAmount || d.amount || 0)
      const userInfo = userMap.get(uid)
      if (userInfo) {
        existing.fullName = userInfo.fullName
        existing.email = userInfo.email
      }
      userActivity.set(uid, existing)
    }
    for (const w of filteredWithdrawals) {
      const uid = w.userId
      if (!uid) continue
      const existing = userActivity.get(uid) || { userId: uid, fullName: null, email: '', totalDeposits: 0, totalWithdrawals: 0 }
      existing.totalWithdrawals += (w.amount || 0)
      const userInfo = userMap.get(uid)
      if (userInfo) {
        existing.fullName = userInfo.fullName
        existing.email = userInfo.email
      }
      userActivity.set(uid, existing)
    }

    const topUsers = Array.from(userActivity.values())
      .sort((a, b) => (b.totalDeposits + b.totalWithdrawals) - (a.totalDeposits + a.totalWithdrawals))
      .slice(0, 10)
      .map(u => ({
        userId: u.userId,
        fullName: u.fullName,
        email: u.email,
        totalDeposits: Math.round(u.totalDeposits * 100) / 100,
        totalWithdrawals: Math.round(u.totalWithdrawals * 100) / 100,
      }))

    // Daily stats: deposits, withdrawals, fees, netFlow, users for each day
    const dailyStats = getDateRange(from, to).map(date => {
      const dayStart = new Date(date + 'T00:00:00.000Z')
      const dayEnd = new Date(date + 'T23:59:59.999Z')

      const dayDeposits = filteredDeposits.filter(d => {
        const cd = new Date(d.createdAt!)
        return cd >= dayStart && cd <= dayEnd
      })
      const dayWithdrawals = filteredWithdrawals.filter(w => {
        const cd = new Date(w.createdAt!)
        return cd >= dayStart && cd <= dayEnd
      })

      const dayDepTotal = dayDeposits.reduce((s, d: any) => s + (d.netAmount || d.amount || 0), 0)
      const dayWithTotal = dayWithdrawals.reduce((s, w: any) => s + (w.amount || 0), 0)
      const dayDepFees = dayDeposits.reduce((s, d: any) => s + (d.fee || 0), 0)
      const dayWithFees = dayWithdrawals.reduce((s, w: any) => s + (w.fee || 0), 0)

      // Count new users on this day
      const dayUsers = allUsers.filter((u: any) =>
        u.createdAt && new Date(u.createdAt) >= dayStart && new Date(u.createdAt) <= dayEnd
      ).length

      return {
        date,
        deposits: Math.round(dayDepTotal * 100) / 100,
        withdrawals: Math.round(dayWithTotal * 100) / 100,
        fees: Math.round((dayDepFees + dayWithFees) * 100) / 100,
        netFlow: Math.round((dayDepTotal - dayWithTotal) * 100) / 100,
        users: dayUsers,
      }
    })

    return NextResponse.json({
      success: true,
      report: {
        period,
        fromDate: fromDateISO,
        toDate: toDateISO,
        summary,
        deposits,
        withdrawals,
        topUsers,
        dailyStats,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
