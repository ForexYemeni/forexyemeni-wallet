import { NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// ====== SERVER-SIDE CACHE (30 seconds) ======
let cachedStats: { data: any; timestamp: number } | null = null
const CACHE_TTL = 30 * 1000 // 30 seconds

async function countByQuery(collection: string, field: string, value: string): Promise<number> {
  const db = getDb()
  const snap = await db.collection(collection).where(field, '==', value).count().get()
  return snap.data().count
}

async function countAll(collection: string): Promise<number> {
  const db = getDb()
  const snap = await db.collection(collection).count().get()
  return snap.data().count
}

async function sumFieldByStatus(collection: string, statusField: string, statusValue: string, sumField: string): Promise<number> {
  const db = getDb()
  const snap = await db.collection(collection).where(statusField, '==', statusValue).get()
  let total = 0
  for (const doc of snap.docs) {
    total += doc.data()[sumField] || 0
  }
  return total
}

async function getRecentDocs(collection: string, limit: number): Promise<any[]> {
  const db = getDb()
  const snap = await db.collection(collection).orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function GET() {
  try {
    // Return cached stats if still valid
    if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_TTL) {
      return NextResponse.json({ success: true, stats: cachedStats.data }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }
      })
    }

    const db = getDb()

    // ====== USER COUNTS (using count queries - 1 read each) ======
    const totalUsersSnap = await db.collection('users').where('role', '!=', 'admin').count().get()
    const totalUsers = totalUsersSnap.data().count

    const activeUsersSnap = await db.collection('users').where('role', '!=', 'admin').where('status', '==', 'active').count().get()
    const activeUsers = activeUsersSnap.data().count

    const suspendedUsersSnap = await db.collection('users').where('role', '!=', 'admin').where('status', '==', 'suspended').count().get()
    const suspendedUsers = suspendedUsersSnap.data().count

    const kycApprovedSnap = await db.collection('users').where('kycStatus', '==', 'approved').count().get()
    const kycApproved = kycApprovedSnap.data().count

    const kycPendingSnap = await db.collection('users').where('kycStatus', '==', 'pending').count().get()
    const kycPending = kycPendingSnap.data().count

    const kycRejectedSnap = await db.collection('users').where('kycStatus', '==', 'rejected').count().get()
    const kycRejected = kycRejectedSnap.data().count

    // New users today - use createdAt filter (1 read)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const newUsersTodaySnap = await db.collection('users')
      .where('role', '!=', 'admin')
      .where('createdAt', '>=', todayStart.toISOString())
      .count().get()
    const newUsersToday = newUsersTodaySnap.data().count

    // New users this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const newUsersThisWeekSnap = await db.collection('users')
      .where('role', '!=', 'admin')
      .where('createdAt', '>=', weekAgo.toISOString())
      .count().get()
    const newUsersThisWeek = newUsersThisWeekSnap.data().count

    // ====== DEPOSIT COUNTS (count queries - 1 read each) ======
    const depositsPendingSnap = await db.collection('deposits').where('status', '==', 'pending').count().get()
    const depositsPending = depositsPendingSnap.data().count

    const depositsReviewingSnap = await db.collection('deposits').where('status', '==', 'reviewing').count().get()
    const depositsReviewing = depositsReviewingSnap.data().count

    const depositsConfirmedSnap = await db.collection('deposits').where('status', '==', 'confirmed').count().get()
    const depositsConfirmed = depositsConfirmedSnap.data().count

    const depositsRejectedSnap = await db.collection('deposits').where('status', '==', 'rejected').count().get()
    const depositsRejected = depositsRejectedSnap.data().count

    // Total confirmed deposit amounts (limited to recent for efficiency)
    const confirmedDepositsSnap = await db.collection('deposits')
      .where('status', '==', 'confirmed')
      .select('netAmount', 'amount', 'fee')
      .get()
    let totalDepositsAmount = 0
    let totalDepositFees = 0
    for (const doc of confirmedDepositsSnap.docs) {
      const d = doc.data()
      totalDepositsAmount += d.netAmount || d.amount || 0
      totalDepositFees += d.fee || 0
    }

    // Today's deposits (limited read)
    const todayDepositsSnap = await db.collection('deposits')
      .where('createdAt', '>=', todayStart.toISOString())
      .get()
    let depositsTodayCount = 0
    let depositsTodayAmount = 0
    for (const doc of todayDepositsSnap.docs) {
      depositsTodayCount++
      const d = doc.data()
      if (d.status === 'confirmed') {
        depositsTodayAmount += d.netAmount || d.amount || 0
      }
    }

    // This week deposits
    const weekDepositsSnap = await db.collection('deposits')
      .where('createdAt', '>=', weekAgo.toISOString())
      .get()
    let depositsThisWeekAmount = 0
    for (const doc of weekDepositsSnap.docs) {
      const d = doc.data()
      if (d.status === 'confirmed') {
        depositsThisWeekAmount += d.netAmount || d.amount || 0
      }
    }

    // This month deposits
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthDepositsSnap = await db.collection('deposits')
      .where('createdAt', '>=', monthStart.toISOString())
      .get()
    let depositsThisMonthAmount = 0
    for (const doc of monthDepositsSnap.docs) {
      const d = doc.data()
      if (d.status === 'confirmed') {
        depositsThisMonthAmount += d.netAmount || d.amount || 0
      }
    }

    // ====== WITHDRAWAL COUNTS (count queries - 1 read each) ======
    const withdrawalsPendingSnap = await db.collection('withdrawals').where('status', '==', 'pending').count().get()
    const withdrawalsPending = withdrawalsPendingSnap.data().count

    const withdrawalsApprovedSnap = await db.collection('withdrawals').where('status', '==', 'approved').count().get()
    const withdrawalsApproved = withdrawalsApprovedSnap.data().count

    const withdrawalsProcessingSnap = await db.collection('withdrawals').where('status', '==', 'processing').count().get()
    const withdrawalsProcessing = withdrawalsProcessingSnap.data().count

    const withdrawalsRejectedSnap = await db.collection('withdrawals').where('status', '==', 'rejected').count().get()
    const withdrawalsRejected = withdrawalsRejectedSnap.data().count

    // Processing withdrawal amounts
    const processingWithdrawalsSnap = await db.collection('withdrawals')
      .where('status', '==', 'processing')
      .select('amount', 'fee')
      .get()
    let totalWithdrawalsAmount = 0
    let totalWithdrawalFees = 0
    for (const doc of processingWithdrawalsSnap.docs) {
      const w = doc.data()
      totalWithdrawalsAmount += w.amount || 0
      totalWithdrawalFees += w.fee || 0
    }

    // Today's withdrawals
    const todayWithdrawalsSnap = await db.collection('withdrawals')
      .where('createdAt', '>=', todayStart.toISOString())
      .get()
    let withdrawalsTodayCount = 0
    let withdrawalsTodayAmount = 0
    for (const doc of todayWithdrawalsSnap.docs) {
      withdrawalsTodayCount++
      const w = doc.data()
      if (w.status === 'processing') {
        withdrawalsTodayAmount += w.amount || 0
      }
    }

    // This week withdrawals
    const weekWithdrawalsSnap = await db.collection('withdrawals')
      .where('createdAt', '>=', weekAgo.toISOString())
      .get()
    let withdrawalsThisWeekAmount = 0
    for (const doc of weekWithdrawalsSnap.docs) {
      const w = doc.data()
      if (w.status === 'processing') {
        withdrawalsThisWeekAmount += w.amount || 0
      }
    }

    // This month withdrawals
    const monthWithdrawalsSnap = await db.collection('withdrawals')
      .where('createdAt', '>=', monthStart.toISOString())
      .get()
    let withdrawalsThisMonthAmount = 0
    for (const doc of monthWithdrawalsSnap.docs) {
      const w = doc.data()
      if (w.status === 'processing') {
        withdrawalsThisMonthAmount += w.amount || 0
      }
    }

    // ====== FEE INCOME ======
    const totalFees = totalDepositFees + totalWithdrawalFees

    // Get admin balance (1 read)
    let adminBalance = 0
    const adminSnap = await db.collection('users').where('role', '==', 'admin').limit(1).get()
    if (!adminSnap.empty) {
      adminBalance = adminSnap.docs[0].data().balance || 0
    }

    // ====== KYC PENDING RECORDS (count query) ======
    const kycRecordsPendingSnap = await db.collection('kycRecords').where('status', '==', 'pending').count().get()
    const kycRecordsPending = kycRecordsPendingSnap.data().count

    // ====== RECENT ACTIVITY (5 deposits + 5 withdrawals = 10 reads max) ======
    const recentDeposits = await getRecentDocs('deposits', 5)
    const recentWithdrawals = await getRecentDocs('withdrawals', 5)

    const recentActivity = [
      ...recentDeposits.map(d => ({
        type: 'deposit' as const,
        id: d.id, amount: d.amount, netAmount: d.netAmount, fee: d.fee,
        status: d.status, createdAt: d.createdAt, userId: d.userId,
      })),
      ...recentWithdrawals.map(w => ({
        type: 'withdrawal' as const,
        id: w.id, amount: w.amount, netAmount: w.netAmount, fee: w.fee,
        status: w.status, createdAt: w.createdAt, userId: w.userId,
      }))
    ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10)

    const statsData = {
      // Users
      totalUsers, activeUsers, suspendedUsers,
      newUsersToday, newUsersThisWeek, newUsersThisMonth,
      // KYC
      kycApproved, kycPending, kycRejected, kycRecordsPending,
      // Deposits
      depositsPending, depositsReviewing, depositsConfirmed, depositsRejected,
      totalDepositsAmount, totalDepositFees,
      depositsTodayCount, depositsTodayAmount,
      depositsThisWeekAmount, depositsThisMonthAmount,
      // Withdrawals
      withdrawalsPending, withdrawalsApproved, withdrawalsProcessing, withdrawalsRejected,
      totalWithdrawalsAmount, totalWithdrawalFees,
      withdrawalsTodayCount, withdrawalsTodayAmount,
      withdrawalsThisWeekAmount, withdrawalsThisMonthAmount,
      // Fees & Balance
      totalFees, adminBalance,
      // Pending actions
      pendingActions: depositsPending + depositsReviewing + withdrawalsPending + withdrawalsApproved + kycRecordsPending,
      // Recent activity
      recentActivity,
    }

    // Cache the result
    cachedStats = { data: statsData, timestamp: Date.now() }

    return NextResponse.json({ success: true, stats: statsData }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
