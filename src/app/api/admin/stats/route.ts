import { NextResponse } from 'next/server'
import { getDb, initializeFirebase } from '@/lib/firebase'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

export async function GET() {
  try {
    const db = getDb()

    // ====== USER STATS ======
    const allUsersSnap = await db.collection('users').get()
    const allUsers = allUsersSnap.docs.map(d => d.data())
    const totalUsers = allUsers.length
    const activeUsers = allUsers.filter(u => u.status === 'active').length
    const suspendedUsers = allUsers.filter(u => u.status === 'suspended').length
    const kycApproved = allUsers.filter(u => u.kycStatus === 'approved').length
    const kycPending = allUsers.filter(u => u.kycStatus === 'pending').length
    const kycRejected = allUsers.filter(u => u.kycStatus === 'rejected').length
    const newUsersToday = allUsers.filter(u => {
      if (!u.createdAt) return false
      const created = new Date(u.createdAt)
      const today = new Date()
      return created.toDateString() === today.toDateString()
    }).length
    const newUsersThisWeek = allUsers.filter(u => {
      if (!u.createdAt) return false
      const created = new Date(u.createdAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return created >= weekAgo
    }).length
    const newUsersThisMonth = allUsers.filter(u => {
      if (!u.createdAt) return false
      const created = new Date(u.createdAt)
      const now = new Date()
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
    }).length

    // ====== DEPOSIT STATS ======
    const allDepositsSnap = await db.collection('deposits').get()
    const allDeposits = allDepositsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const depositsPending = allDeposits.filter(d => d.status === 'pending').length
    const depositsReviewing = allDeposits.filter(d => d.status === 'reviewing').length
    const depositsConfirmed = allDeposits.filter(d => d.status === 'confirmed').length
    const depositsRejected = allDeposits.filter(d => d.status === 'rejected').length

    const totalDepositsAmount = allDeposits
      .filter(d => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.netAmount || d.amount || 0), 0)

    const totalDepositFees = allDeposits
      .filter(d => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.fee || 0), 0)

    const depositsToday = allDeposits.filter(d => {
      if (!d.createdAt) return false
      return new Date(d.createdAt).toDateString() === new Date().toDateString()
    })
    const depositsTodayAmount = depositsToday
      .filter(d => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.netAmount || d.amount || 0), 0)
    const depositsTodayCount = depositsToday.length

    const depositsThisWeek = allDeposits.filter(d => {
      if (!d.createdAt) return false
      const created = new Date(d.createdAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return created >= weekAgo
    })
    const depositsThisWeekAmount = depositsThisWeek
      .filter(d => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.netAmount || d.amount || 0), 0)

    const depositsThisMonth = allDeposits.filter(d => {
      if (!d.createdAt) return false
      const created = new Date(d.createdAt)
      const now = new Date()
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
    })
    const depositsThisMonthAmount = depositsThisMonth
      .filter(d => d.status === 'confirmed')
      .reduce((sum, d) => sum + (d.netAmount || d.amount || 0), 0)

    // ====== WITHDRAWAL STATS ======
    const allWithdrawalsSnap = await db.collection('withdrawals').get()
    const allWithdrawals = allWithdrawalsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const withdrawalsPending = allWithdrawals.filter(w => w.status === 'pending').length
    const withdrawalsApproved = allWithdrawals.filter(w => w.status === 'approved').length
    const withdrawalsProcessing = allWithdrawals.filter(w => w.status === 'processing').length
    const withdrawalsRejected = allWithdrawals.filter(w => w.status === 'rejected').length

    const totalWithdrawalsAmount = allWithdrawals
      .filter(w => w.status === 'processing')
      .reduce((sum, w) => sum + (w.amount || 0), 0)

    const totalWithdrawalFees = allWithdrawals
      .filter(w => w.status === 'processing')
      .reduce((sum, w) => sum + (w.fee || 0), 0)

    const withdrawalsToday = allWithdrawals.filter(w => {
      if (!w.createdAt) return false
      return new Date(w.createdAt).toDateString() === new Date().toDateString()
    })
    const withdrawalsTodayAmount = withdrawalsToday
      .filter(w => w.status === 'processing')
      .reduce((sum, w) => sum + (w.amount || 0), 0)
    const withdrawalsTodayCount = withdrawalsToday.length

    const withdrawalsThisWeek = allWithdrawals.filter(w => {
      if (!w.createdAt) return false
      const created = new Date(w.createdAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return created >= weekAgo
    })
    const withdrawalsThisWeekAmount = withdrawalsThisWeek
      .filter(w => w.status === 'processing')
      .reduce((sum, w) => sum + (w.amount || 0), 0)

    const withdrawalsThisMonth = allWithdrawals.filter(w => {
      if (!w.createdAt) return false
      const created = new Date(w.createdAt)
      const now = new Date()
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
    })
    const withdrawalsThisMonthAmount = withdrawalsThisMonth
      .filter(w => w.status === 'processing')
      .reduce((sum, w) => sum + (w.amount || 0), 0)

    // ====== FEE INCOME STATS ======
    const totalFees = totalDepositFees + totalWithdrawalFees

    // Get admin balance
    let adminBalance = 0
    const adminSnap = await db.collection('users').where('email', '==', ADMIN_EMAIL).limit(1).get()
    if (!adminSnap.empty) {
      adminBalance = adminSnap.docs[0].data().balance || 0
    }

    // ====== KYC STATS ======
    const allKycSnap = await db.collection('kycRecords').get()
    const allKycRecords = allKycSnap.docs.map(d => d.data())
    const kycRecordsPending = allKycRecords.filter(k => k.status === 'pending').length

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
        userEmail: d.userId ? undefined : undefined, // Will be populated by client
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

    // Merge and sort by date
    const recentActivity = [...recentDeposits, ...recentWithdrawals]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      stats: {
        // Users
        totalUsers,
        activeUsers,
        suspendedUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        // KYC
        kycApproved,
        kycPending,
        kycRejected,
        kycRecordsPending,
        // Deposits
        depositsPending,
        depositsReviewing,
        depositsConfirmed,
        depositsRejected,
        totalDepositsAmount,
        totalDepositFees,
        depositsTodayCount,
        depositsTodayAmount,
        depositsThisWeekAmount,
        depositsThisMonthAmount,
        // Withdrawals
        withdrawalsPending,
        withdrawalsApproved,
        withdrawalsProcessing,
        withdrawalsRejected,
        totalWithdrawalsAmount,
        totalWithdrawalFees,
        withdrawalsTodayCount,
        withdrawalsTodayAmount,
        withdrawalsThisWeekAmount,
        withdrawalsThisMonthAmount,
        // Fees & Balance
        totalFees,
        adminBalance,
        // Pending actions (items needing admin attention)
        pendingActions: depositsPending + depositsReviewing + withdrawalsPending + withdrawalsApproved + kycRecordsPending,
        // Recent activity
        recentActivity,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
