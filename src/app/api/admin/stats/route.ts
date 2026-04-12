import { NextRequest, NextResponse } from 'next/server'
import { ensureDb } from '@/lib/firebase'
import { requireAdmin, verifyUserId } from '@/lib/auth-server'

// In-memory cache for admin stats (TTL: 30 seconds)
// Admin stats is the MOST expensive API call — reads entire collections
// With 30s cache, multiple admin refreshes per minute share the same result
let statsCache: { data: any; ts: number } | null = null
const STATS_CACHE_TTL = 30000

export async function GET(request: NextRequest) {
  // AUTH CHECK — must be first
  const auth = await requireAdmin(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    // Return cached stats if fresh (< 30s old)
    if (statsCache && Date.now() - statsCache.ts < STATS_CACHE_TTL) {
      return NextResponse.json({
        success: true,
        stats: statsCache.data,
      }, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } })
    }

    const db = await ensureDb()

    // ====== USER STATS ======
    // OPTIMIZED: Use targeted queries instead of fetching ALL users
    const today = new Date()
    const todayStr = today.toDateString()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    // Single query for all non-admin users (avoids composite index requirement)
    const totalUsersSnap = await db.collection('users').where('role', '!=', 'admin').get()
    
    const allUsers = totalUsersSnap.docs.map(d => d.data())
    const totalUsers = allUsers.length
    const activeUsers = allUsers.filter(u => u.status === 'active').length
    const suspendedUsers = allUsers.filter(u => u.status === 'suspended').length
    
    // KYC counts from users (filtered from already-fetched data)
    const kycApproved = allUsers.filter(u => u.kycStatus === 'approved').length
    const kycPending = allUsers.filter(u => u.kycStatus === 'pending').length
    const kycRejected = allUsers.filter(u => u.kycStatus === 'rejected').length
    
    // Date-based filters (only on the already-fetched data)
    const newUsersToday = allUsers.filter(u => u.createdAt && new Date(u.createdAt).toDateString() === todayStr).length
    const newUsersThisWeek = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= weekAgo).length
    const newUsersThisMonth = allUsers.filter(u => {
      if (!u.createdAt) return false
      const d = new Date(u.createdAt)
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    }).length

    // ====== DEPOSIT STATS ======
    // OPTIMIZED: Use status-filtered queries + only fetch needed fields concept
    const [pendingDepositsSnap, reviewingDepositsSnap, allDepositsSnap] = await Promise.all([
      db.collection('deposits').where('status', '==', 'pending').get(),
      db.collection('deposits').where('status', '==', 'reviewing').get(),
      db.collection('deposits').get(),
    ])

    const depositsPending = pendingDepositsSnap.size
    const depositsReviewing = reviewingDepositsSnap.size
    
    const allDeposits = allDepositsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const depositsConfirmed = allDeposits.filter(d => d.status === 'confirmed').length
    const depositsRejected = allDeposits.filter(d => d.status === 'rejected').length

    const totalDepositsAmount = allDeposits
      .filter(d => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.netAmount || d.amount || 0), 0)

    const totalDepositFees = allDeposits
      .filter(d => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.fee || 0), 0)

    const depositsToday = allDeposits.filter(d => d.createdAt && new Date(d.createdAt).toDateString() === todayStr)
    const depositsTodayAmount = depositsToday.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + (d.netAmount || d.amount || 0), 0)
    const depositsTodayCount = depositsToday.length

    const depositsThisWeek = allDeposits.filter(d => d.createdAt && new Date(d.createdAt) >= weekAgo)
    const depositsThisWeekAmount = depositsThisWeek.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + (d.netAmount || d.amount || 0), 0)

    const depositsThisMonth = allDeposits.filter(d => d.createdAt && new Date(d.createdAt) >= thisMonthStart)
    const depositsThisMonthAmount = depositsThisMonth.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + (d.netAmount || d.amount || 0), 0)

    // ====== WITHDRAWAL STATS ======
    const [pendingWithdrawalsSnap, approvedWithdrawalsSnap, processingWithdrawalsSnap, allWithdrawalsSnap] = await Promise.all([
      db.collection('withdrawals').where('status', '==', 'pending').get(),
      db.collection('withdrawals').where('status', '==', 'approved').get(),
      db.collection('withdrawals').where('status', '==', 'processing').get(),
      db.collection('withdrawals').get(),
    ])

    const withdrawalsPending = pendingWithdrawalsSnap.size
    const withdrawalsApproved = approvedWithdrawalsSnap.size
    const withdrawalsProcessing = processingWithdrawalsSnap.size
    
    const allWithdrawals = allWithdrawalsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const withdrawalsRejected = allWithdrawals.filter(w => w.status === 'rejected').length

    const totalWithdrawalsAmount = allWithdrawals
      .filter(w => w.status === 'processing')
      .reduce((sum, w) => sum + (w.amount || 0), 0)

    const totalWithdrawalFees = allWithdrawals
      .filter(w => w.status === 'processing')
      .reduce((sum, w) => sum + (w.fee || 0), 0)

    const withdrawalsToday = allWithdrawals.filter(w => w.createdAt && new Date(w.createdAt).toDateString() === todayStr)
    const withdrawalsTodayAmount = withdrawalsToday.filter(w => w.status === 'processing').reduce((sum, w) => sum + (w.amount || 0), 0)
    const withdrawalsTodayCount = withdrawalsToday.length

    const withdrawalsThisWeek = allWithdrawals.filter(w => w.createdAt && new Date(w.createdAt) >= weekAgo)
    const withdrawalsThisWeekAmount = withdrawalsThisWeek.filter(w => w.status === 'processing').reduce((sum, w) => sum + (w.amount || 0), 0)

    const withdrawalsThisMonth = allWithdrawals.filter(w => w.createdAt && new Date(w.createdAt) >= thisMonthStart)
    const withdrawalsThisMonthAmount = withdrawalsThisMonth.filter(w => w.status === 'processing').reduce((sum, w) => sum + (w.amount || 0), 0)

    // ====== FEE INCOME STATS ======
    const totalFees = totalDepositFees + totalWithdrawalFees

    // Get admin balance
    let adminBalance = 0
    const adminSnap = await db.collection('users').where('role', '==', 'admin').limit(1).get()
    if (!adminSnap.empty) {
      adminBalance = adminSnap.docs[0].data().balance || 0
    }

    // ====== KYC STATS ======
    const pendingKycSnap = await db.collection('kycRecords').where('status', '==', 'pending').get()
    const kycRecordsPending = pendingKycSnap.size

    // ====== RECENT TRANSACTIONS (last 10) ======
    const recentDeposits = allDeposits
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5)
      .map(d => ({
        type: 'deposit' as const,
        id: d.id,
        amount: d.amount,
        netAmount: d.netAmount,
        fee: d.fee,
        status: d.status,
        createdAt: d.createdAt,
        userId: d.userId,
      }))

    const recentWithdrawals = allWithdrawals
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5)
      .map(w => ({
        type: 'withdrawal' as const,
        id: w.id,
        amount: w.amount,
        netAmount: w.netAmount,
        fee: w.fee,
        status: w.status,
        createdAt: w.createdAt,
        userId: w.userId,
      }))

    const recentActivity = [...recentDeposits, ...recentWithdrawals]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10)

    const statsData = {
      totalUsers, activeUsers, suspendedUsers,
      newUsersToday, newUsersThisWeek, newUsersThisMonth,
      kycApproved, kycPending, kycRejected, kycRecordsPending,
      depositsPending, depositsReviewing, depositsConfirmed, depositsRejected,
      totalDepositsAmount, totalDepositFees,
      depositsTodayCount, depositsTodayAmount,
      depositsThisWeekAmount, depositsThisMonthAmount,
      withdrawalsPending, withdrawalsApproved, withdrawalsProcessing, withdrawalsRejected,
      totalWithdrawalsAmount, totalWithdrawalFees,
      withdrawalsTodayCount, withdrawalsTodayAmount,
      withdrawalsThisWeekAmount, withdrawalsThisMonthAmount,
      totalFees, adminBalance,
      pendingActions: depositsPending + depositsReviewing + withdrawalsPending + withdrawalsApproved + kycRecordsPending,
      recentActivity,
    }

    // Cache the result
    statsCache = { data: statsData, ts: Date.now() }

    return NextResponse.json({
      success: true,
      stats: statsData,
    }, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// Helper to bust the cache when data changes (called by admin action routes)
export function bustStatsCache() {
  statsCache = null
}
