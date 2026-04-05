import { NextRequest, NextResponse } from 'next/server'
import { userOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp, generateId } from '@/lib/firebase'
import { logAudit } from '@/lib/audit-log'

// ===================== TYPES =====================
interface AdminPermissions {
  manageUsers?: boolean
  approveDeposits?: boolean
  approveWithdrawals?: boolean
  approveKYC?: boolean
  manageSettings?: boolean
}

interface AuditLogFilters {
  actionType?: string
  adminId?: string
  startDate?: string
  endDate?: string
  limit?: number
  targetType?: string
}

// ===================== DEFAULT SETTINGS =====================
const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  maintenanceMessage: '',
  registrationOpen: true,
  kycRequired: false,
  depositFeePercent: 0,
  withdrawalFeePercent: 0,
  minDepositAmount: 0,
  maxDepositAmount: 0,
  minWithdrawAmount: 0,
  maxWithdrawAmount: 0,
  dailyWithdrawLimit: 0,
  autoApproveDeposit: false,
  autoApproveWithdrawal: false,
  platformName: 'ForexYemeni',
  supportEmail: '',
  supportPhone: '',
  telegramLink: '',
  whatsappLink: '',
  announcements: [] as Array<{
    id: string
    title: string
    message: string
    type: 'info' | 'warning' | 'urgent'
    active: boolean
    createdAt: string
    expiresAt: string | null
  }>,
  bannedIPs: [] as string[],
  suspiciousAccounts: [] as Array<{
    userId: string
    email: string
    reason: string
    detectedAt: string
    resolved: boolean
  }>,
}

// ===================== SUPER ADMIN VERIFICATION =====================
async function verifySuperAdmin(adminId: string): Promise<{ authorized: boolean; user: Awaited<ReturnType<typeof userOperations.findUnique>>; message?: string }> {
  const user = await userOperations.findUnique({ id: adminId })
  if (!user) {
    return { authorized: false, user: null, message: 'المستخدم غير موجود' }
  }
  // Super admin = role 'admin' with no specific permissions enabled (main admin)
  // Parse permissions to check if any are actively set to true
  const parsedPerms = parsePermissions(user.permissions)
  const hasSpecificPermissions = parsedPerms && Object.values(parsedPerms).some(v => v === true)
  const isMainAdmin = user.role === 'admin' && !hasSpecificPermissions
  if (!isMainAdmin) {
    return { authorized: false, user, message: 'ليس لديك صلاحية المدير الرئيسي' }
  }
  return { authorized: true, user }
}

// ===================== HELPER: Parse permissions string =====================
function parsePermissions(permissions: string | null | undefined): AdminPermissions | null {
  if (!permissions) return null
  try {
    if (typeof permissions === 'string') return JSON.parse(permissions) as AdminPermissions
    return permissions as AdminPermissions
  } catch {
    return null
  }
}

function stringifyPermissions(permissions: AdminPermissions): string {
  return JSON.stringify(permissions)
}

// ===================== HELPER: Sum collection amounts =====================
async function sumFieldFromCollection(collection: string, statusField: string, statusValue: string, amountField: string): Promise<number> {
  const db = getDb()
  let total = 0
  let snapshot = await db.collection(collection).where(statusField, '==', statusValue).limit(500).get()
  while (snapshot.size > 0) {
    for (const doc of snapshot.docs) {
      total += doc.data()[amountField] || 0
    }
    if (snapshot.size < 500) break
    // Firestore doesn't support offset, so we use startAfter for pagination
    const lastDoc = snapshot.docs[snapshot.size - 1]
    snapshot = await db.collection(collection)
      .where(statusField, '==', statusValue)
      .startAfter(lastDoc)
      .limit(500)
      .get()
  }
  return total
}

// ===================== HELPER: Delete old documents from collection =====================
async function deleteOldDocuments(collection: string, dateField: string, olderThanMs: number): Promise<number> {
  const db = getDb()
  const cutoffDate = new Date(Date.now() - olderThanMs).toISOString()
  let deletedCount = 0

  // Fetch documents and filter by date in application layer since Firestore
  // doesn't support < queries easily without indexes
  let snapshot = await db.collection(collection).limit(500).get()
  let batch = db.batch()
  let opsInBatch = 0

  while (snapshot.size > 0) {
    let hasMore = false
    for (const doc of snapshot.docs) {
      const docDate = doc.data()[dateField]
      if (docDate && new Date(docDate as string).getTime() < new Date(cutoffDate).getTime()) {
        batch.delete(doc.ref)
        deletedCount++
        opsInBatch++
        if (opsInBatch >= 499) {
          await batch.commit()
          batch = db.batch()
          opsInBatch = 0
        }
      }
    }
    if (snapshot.size < 500) break
    const lastDoc = snapshot.docs[snapshot.size - 1]
    snapshot = await db.collection(collection).startAfter(lastDoc).limit(500).get()
    hasMore = snapshot.size > 0
  }

  if (opsInBatch > 0) {
    await batch.commit()
  }

  return deletedCount
}

// ===================== GET — Fetch all super admin settings + dashboard data =====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('adminId')

    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المدير مطلوب' }, { status: 400 })
    }

    // Verify super admin
    const { authorized, user, message } = await verifySuperAdmin(adminId)
    if (!authorized) {
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    const db = getDb()

    // 1. Fetch global settings
    let settings = { ...DEFAULT_SETTINGS }
    try {
      const settingsDoc = await db.collection('systemSettings').doc('global').get()
      if (settingsDoc.exists && settingsDoc.data()) {
        const data = settingsDoc.data()!
        settings = {
          ...DEFAULT_SETTINGS,
          maintenanceMode: data.maintenanceMode ?? DEFAULT_SETTINGS.maintenanceMode,
          maintenanceMessage: data.maintenanceMessage ?? DEFAULT_SETTINGS.maintenanceMessage,
          registrationOpen: data.registrationOpen ?? DEFAULT_SETTINGS.registrationOpen,
          kycRequired: data.kycRequired ?? DEFAULT_SETTINGS.kycRequired,
          depositFeePercent: data.depositFeePercent ?? DEFAULT_SETTINGS.depositFeePercent,
          withdrawalFeePercent: data.withdrawalFeePercent ?? DEFAULT_SETTINGS.withdrawalFeePercent,
          minDepositAmount: data.minDepositAmount ?? DEFAULT_SETTINGS.minDepositAmount,
          maxDepositAmount: data.maxDepositAmount ?? DEFAULT_SETTINGS.maxDepositAmount,
          minWithdrawAmount: data.minWithdrawAmount ?? DEFAULT_SETTINGS.minWithdrawAmount,
          maxWithdrawAmount: data.maxWithdrawAmount ?? DEFAULT_SETTINGS.maxWithdrawAmount,
          dailyWithdrawLimit: data.dailyWithdrawLimit ?? DEFAULT_SETTINGS.dailyWithdrawLimit,
          autoApproveDeposit: data.autoApproveDeposit ?? DEFAULT_SETTINGS.autoApproveDeposit,
          autoApproveWithdrawal: data.autoApproveWithdrawal ?? DEFAULT_SETTINGS.autoApproveWithdrawal,
          platformName: data.platformName ?? DEFAULT_SETTINGS.platformName,
          supportEmail: data.supportEmail ?? DEFAULT_SETTINGS.supportEmail,
          supportPhone: data.supportPhone ?? DEFAULT_SETTINGS.supportPhone,
          telegramLink: data.telegramLink ?? DEFAULT_SETTINGS.telegramLink,
          whatsappLink: data.whatsappLink ?? DEFAULT_SETTINGS.whatsappLink,
          announcements: data.announcements ?? DEFAULT_SETTINGS.announcements,
          bannedIPs: data.bannedIPs ?? DEFAULT_SETTINGS.bannedIPs,
          suspiciousAccounts: data.suspiciousAccounts ?? DEFAULT_SETTINGS.suspiciousAccounts,
        }
      }
    } catch (err) {
    }

    // 2. Fetch recent login attempts (last 50)
    let loginAttempts: Array<Record<string, unknown>> = []
    try {
      const loginSnapshot = await db.collection('loginAttempts').limit(50).get()
      loginAttempts = loginSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
        .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
    } catch (err) {
    }

    // 3. Active sessions count
    let activeSessionsCount = 0
    try {
      const sessionsSnapshot = await db.collection('userDevices').limit(500).get()
      activeSessionsCount = sessionsSnapshot.size
    } catch (err) {
    }

    // 4. Total data size estimate (count of all collections)
    const collectionCounts: Record<string, number> = {}
    const collectionsToCount = [
      'users', 'deposits', 'withdrawals', 'transactions', 'notifications',
      'kycRecords', 'otpCodes', 'paymentMethods', 'userPaymentMethods',
      'merchants', 'p2pListings', 'p2pTrades', 'chatMessages', 'chats',
      'auditLog', 'loginAttempts', 'userDevices', 'fcmTokens', 'referrals',
      'referralCommissions',
    ]
    for (const colName of collectionsToCount) {
      try {
        const snapshot = await db.collection(colName).limit(1).get()
        // Firestore doesn't give count easily without reading all docs.
        // Use a rough estimate from the empty snapshot (size=0 means <1, otherwise >0)
        // For a real count we'd need to read all docs, but for dashboard we estimate.
        // Let's use the actual size for small reads.
        const fullSnapshot = await db.collection(colName).limit(5000).get()
        collectionCounts[colName] = fullSnapshot.size
      } catch {
        collectionCounts[colName] = 0
      }
    }

    const totalRecords = Object.values(collectionCounts).reduce((sum, count) => sum + count, 0)

    // 5. Financial Summary (NEW)
    let financialSummary = {
      totalUserBalances: 0,
      completedDepositsTotal: 0,
      completedWithdrawalsTotal: 0,
      pendingDepositsTotal: 0,
      pendingWithdrawalsTotal: 0,
      totalP2PTrades: 0,
    }
    try {
      // Sum all user balances
      const usersSnapshot = await db.collection('users').limit(5000).get()
      let totalBalances = 0
      for (const doc of usersSnapshot.docs) {
        totalBalances += doc.data().balance || 0
      }
      financialSummary.totalUserBalances = totalBalances

      // Sum completed deposits
      financialSummary.completedDepositsTotal = await sumFieldFromCollection('deposits', 'status', 'completed', 'amount')

      // Sum completed withdrawals
      financialSummary.completedWithdrawalsTotal = await sumFieldFromCollection('withdrawals', 'status', 'completed', 'amount')

      // Sum pending deposits
      financialSummary.pendingDepositsTotal = await sumFieldFromCollection('deposits', 'status', 'pending', 'amount')

      // Sum pending withdrawals
      financialSummary.pendingWithdrawalsTotal = await sumFieldFromCollection('withdrawals', 'status', 'pending', 'amount')

      // Count P2P trades
      const p2pSnapshot = await db.collection('p2pTrades').limit(5000).get()
      financialSummary.totalP2PTrades = p2pSnapshot.size
    } catch (err) {
    }

    // 6. Admin Team (NEW)
    let adminTeam: Array<Record<string, unknown>> = []
    try {
      const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').limit(100).get()
      adminTeam = adminsSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          email: data.email || '',
          name: data.fullName || '',
          role: data.role || 'admin',
          permissions: parsePermissions(data.permissions),
          status: data.status || 'active',
          lastLogin: data.lastLogin || null,
          createdAt: data.createdAt || '',
        }
      })
    } catch (err) {
    }

    // 7. Recent Audit Logs (NEW - last 20)
    let recentAuditLogs: Array<Record<string, unknown>> = []
    try {
      const auditSnapshot = await db.collection('auditLog').limit(100).get()
      recentAuditLogs = auditSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
        .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
        .slice(0, 20)
    } catch (err) {
    }

    // 8. System Health (NEW)
    let systemHealth = {
      pendingDeposits: 0,
      pendingWithdrawals: 0,
      pendingKYC: 0,
      unresolvedDisputes: 0,
    }
    try {
      const [pendingDepSnapshot, pendingWithSnapshot, pendingKYCSnapshot, disputesSnapshot] = await Promise.all([
        db.collection('deposits').where('status', '==', 'pending').limit(1).get(),
        db.collection('withdrawals').where('status', '==', 'pending').limit(1).get(),
        db.collection('kycRecords').where('status', '==', 'pending').limit(1).get(),
        db.collection('p2pTrades').where('status', '==', 'disputed').limit(1).get(),
      ])

      // For accurate counts, we need to read all matching docs
      const [allPendingDep, allPendingWith, allPendingKYC, allDisputes] = await Promise.all([
        db.collection('deposits').where('status', '==', 'pending').limit(5000).get(),
        db.collection('withdrawals').where('status', '==', 'pending').limit(5000).get(),
        db.collection('kycRecords').where('status', '==', 'pending').limit(5000).get(),
        db.collection('p2pTrades').where('status', '==', 'disputed').limit(5000).get(),
      ])

      systemHealth.pendingDeposits = allPendingDep.size
      systemHealth.pendingWithdrawals = allPendingWith.size
      systemHealth.pendingKYC = allPendingKYC.size
      systemHealth.unresolvedDisputes = allDisputes.size
    } catch (err) {
    }

    return NextResponse.json({
      success: true,
      data: {
        settings,
        loginAttempts,
        activeSessionsCount,
        collectionCounts,
        totalRecords,
        financialSummary,
        adminTeam,
        recentAuditLogs,
        systemHealth,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب الإعدادات'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// ===================== POST — Handle various super admin actions =====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, adminId } = body

    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المدير مطلوب' }, { status: 400 })
    }
    if (!action) {
      return NextResponse.json({ success: false, message: 'نوع الإجراء مطلوب' }, { status: 400 })
    }

    // Verify super admin
    const { authorized, user, message } = await verifySuperAdmin(adminId)
    if (!authorized) {
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    const db = getDb()
    const settingsRef = db.collection('systemSettings').doc('global')

    // ===================== 1. UPDATE SETTINGS =====================
    if (action === 'update_settings') {
      const {
        maintenanceMode, maintenanceMessage, registrationOpen, kycRequired,
        depositFeePercent, withdrawalFeePercent, minDepositAmount, maxDepositAmount,
        minWithdrawAmount, maxWithdrawAmount, dailyWithdrawLimit,
        autoApproveDeposit, autoApproveWithdrawal, platformName,
        supportEmail, supportPhone, telegramLink, whatsappLink,
      } = body

      const updateData: Record<string, unknown> = { updatedAt: nowTimestamp() }
      if (typeof maintenanceMode === 'boolean') updateData.maintenanceMode = maintenanceMode
      if (typeof maintenanceMessage === 'string') updateData.maintenanceMessage = maintenanceMessage
      if (typeof registrationOpen === 'boolean') updateData.registrationOpen = registrationOpen
      if (typeof kycRequired === 'boolean') updateData.kycRequired = kycRequired
      if (typeof depositFeePercent === 'number') updateData.depositFeePercent = depositFeePercent
      if (typeof withdrawalFeePercent === 'number') updateData.withdrawalFeePercent = withdrawalFeePercent
      if (typeof minDepositAmount === 'number') updateData.minDepositAmount = minDepositAmount
      if (typeof maxDepositAmount === 'number') updateData.maxDepositAmount = maxDepositAmount
      if (typeof minWithdrawAmount === 'number') updateData.minWithdrawAmount = minWithdrawAmount
      if (typeof maxWithdrawAmount === 'number') updateData.maxWithdrawAmount = maxWithdrawAmount
      if (typeof dailyWithdrawLimit === 'number') updateData.dailyWithdrawLimit = dailyWithdrawLimit
      if (typeof autoApproveDeposit === 'boolean') updateData.autoApproveDeposit = autoApproveDeposit
      if (typeof autoApproveWithdrawal === 'boolean') updateData.autoApproveWithdrawal = autoApproveWithdrawal
      if (typeof platformName === 'string') updateData.platformName = platformName
      if (typeof supportEmail === 'string') updateData.supportEmail = supportEmail
      if (typeof supportPhone === 'string') updateData.supportPhone = supportPhone
      if (typeof telegramLink === 'string') updateData.telegramLink = telegramLink
      if (typeof whatsappLink === 'string') updateData.whatsappLink = whatsappLink

      await settingsRef.set(updateData, { merge: true })

      await logAudit(
        adminId,
        'settings_change',
        'system',
        'global',
        'إعدادات النظام',
        'تحديث إعدادات النظام العامة'
      ).catch(() => {})

      return NextResponse.json({ success: true, message: 'تم تحديث الإعدادات بنجاح' })
    }

    // ===================== 2. CREATE ANNOUNCEMENT =====================
    if (action === 'create_announcement') {
      const { title, message: announcementMessage, type, expiresAt } = body
      if (!title || !announcementMessage) {
        return NextResponse.json({ success: false, message: 'عنوان ونص الإعلان مطلوبان' }, { status: 400 })
      }

      const validTypes = ['info', 'warning', 'urgent']
      const announcementType = validTypes.includes(type) ? type : 'info'

      const newAnnouncement = {
        id: generateId(),
        title,
        message: announcementMessage,
        type: announcementType,
        active: true,
        createdAt: nowTimestamp(),
        expiresAt: expiresAt || null,
      }

      // Read current announcements array
      const settingsDoc = await settingsRef.get()
      const settingsData = settingsDoc.exists ? settingsDoc.data() : null
      const currentAnnouncements = settingsData
        ? (settingsData.announcements || [])
        : []

      await settingsRef.set({
        announcements: [...currentAnnouncements, newAnnouncement],
        updatedAt: nowTimestamp(),
      }, { merge: true })

      await logAudit(
        adminId,
        'settings_change',
        'announcement',
        newAnnouncement.id,
        title,
        `إضافة إعلان جديد: ${title}`
      ).catch(() => {})

      return NextResponse.json({
        success: true,
        message: 'تم إنشاء الإعلان بنجاح',
        data: newAnnouncement,
      })
    }

    // ===================== 3. DELETE ANNOUNCEMENT =====================
    if (action === 'delete_announcement') {
      const { announcementId } = body
      if (!announcementId) {
        return NextResponse.json({ success: false, message: 'معرف الإعلان مطلوب' }, { status: 400 })
      }

      const settingsDoc = await settingsRef.get()
      const settingsData = settingsDoc.exists ? settingsDoc.data() : null
      const currentAnnouncements: Array<typeof DEFAULT_SETTINGS.announcements[number]> =
        settingsData ? (settingsData.announcements || []) : []

      const filtered = currentAnnouncements.filter(a => a.id !== announcementId)
      if (filtered.length === currentAnnouncements.length) {
        return NextResponse.json({ success: false, message: 'الإعلان غير موجود' }, { status: 404 })
      }

      await settingsRef.set({
        announcements: filtered,
        updatedAt: nowTimestamp(),
      }, { merge: true })

      await logAudit(
        adminId,
        'settings_change',
        'announcement',
        announcementId,
        'إعلان',
        `حذف إعلان: ${announcementId}`
      ).catch(() => {})

      return NextResponse.json({ success: true, message: 'تم حذف الإعلان بنجاح' })
    }

    // ===================== 4. TOGGLE ANNOUNCEMENT =====================
    if (action === 'toggle_announcement') {
      const { announcementId } = body
      if (!announcementId) {
        return NextResponse.json({ success: false, message: 'معرف الإعلان مطلوب' }, { status: 400 })
      }

      const settingsDoc = await settingsRef.get()
      const settingsData = settingsDoc.exists ? settingsDoc.data() : null
      const currentAnnouncements: Array<typeof DEFAULT_SETTINGS.announcements[number]> =
        settingsData ? (settingsData.announcements || []) : []

      const announcement = currentAnnouncements.find(a => a.id === announcementId)
      if (!announcement) {
        return NextResponse.json({ success: false, message: 'الإعلان غير موجود' }, { status: 404 })
      }

      const updatedAnnouncements = currentAnnouncements.map(a =>
        a.id === announcementId ? { ...a, active: !a.active } : a
      )

      await settingsRef.set({
        announcements: updatedAnnouncements,
        updatedAt: nowTimestamp(),
      }, { merge: true })

      const newState = !announcement.active
      await logAudit(
        adminId,
        'settings_change',
        'announcement',
        announcementId,
        announcement.title,
        `${newState ? 'تفعيل' : 'تعطيل'} إعلان: ${announcement.title}`
      ).catch(() => {})

      return NextResponse.json({
        success: true,
        message: `تم ${newState ? 'تفعيل' : 'تعطيل'} الإعلان بنجاح`,
      })
    }

    // ===================== 5. BAN IP =====================
    if (action === 'ban_ip') {
      const { ip } = body
      if (!ip) {
        return NextResponse.json({ success: false, message: 'عنوان IP مطلوب' }, { status: 400 })
      }

      const settingsDoc = await settingsRef.get()
      const settingsData = settingsDoc.exists ? settingsDoc.data() : null
      const currentBannedIPs: string[] =
        settingsData ? (settingsData.bannedIPs || []) : []

      if (currentBannedIPs.includes(ip)) {
        return NextResponse.json({ success: false, message: 'عنوان IP محظور بالفعل' }, { status: 400 })
      }

      await settingsRef.set({
        bannedIPs: [...currentBannedIPs, ip],
        updatedAt: nowTimestamp(),
      }, { merge: true })

      await logAudit(
        adminId,
        'settings_change',
        'ip',
        ip,
        ip,
        `حظر عنوان IP: ${ip}`
      ).catch(() => {})

      return NextResponse.json({ success: true, message: 'تم حظر عنوان IP بنجاح' })
    }

    // ===================== 6. UNBAN IP =====================
    if (action === 'unban_ip') {
      const { ip } = body
      if (!ip) {
        return NextResponse.json({ success: false, message: 'عنوان IP مطلوب' }, { status: 400 })
      }

      const settingsDoc = await settingsRef.get()
      const settingsData = settingsDoc.exists ? settingsDoc.data() : null
      const currentBannedIPs: string[] =
        settingsData ? (settingsData.bannedIPs || []) : []

      const filtered = currentBannedIPs.filter(bannedIp => bannedIp !== ip)
      if (filtered.length === currentBannedIPs.length) {
        return NextResponse.json({ success: false, message: 'عنوان IP غير محظور' }, { status: 404 })
      }

      await settingsRef.set({
        bannedIPs: filtered,
        updatedAt: nowTimestamp(),
      }, { merge: true })

      await logAudit(
        adminId,
        'settings_change',
        'ip',
        ip,
        ip,
        `إلغاء حظر عنوان IP: ${ip}`
      ).catch(() => {})

      return NextResponse.json({ success: true, message: 'تم إلغاء حظر عنوان IP بنجاح' })
    }

    // ===================== 7. RESOLVE SUSPICIOUS ACCOUNT =====================
    if (action === 'resolve_suspicious') {
      const { userId: suspiciousUserId } = body
      if (!suspiciousUserId) {
        return NextResponse.json({ success: false, message: 'معرف المستخدم المشبوه مطلوب' }, { status: 400 })
      }

      const settingsDoc = await settingsRef.get()
      const settingsData = settingsDoc.exists ? settingsDoc.data() : null
      const currentSuspicious: Array<typeof DEFAULT_SETTINGS.suspiciousAccounts[number]> =
        settingsData ? (settingsData.suspiciousAccounts || []) : []

      const account = currentSuspicious.find(a => a.userId === suspiciousUserId)
      if (!account) {
        return NextResponse.json({ success: false, message: 'الحساب غير موجود في القائمة المشبوهة' }, { status: 404 })
      }

      const updatedSuspicious = currentSuspicious.map(a =>
        a.userId === suspiciousUserId ? { ...a, resolved: true } : a
      )

      await settingsRef.set({
        suspiciousAccounts: updatedSuspicious,
        updatedAt: nowTimestamp(),
      }, { merge: true })

      await logAudit(
        adminId,
        'settings_change',
        'suspicious_account',
        suspiciousUserId,
        account.email,
        `حل حالة مشبوهة: ${account.email} - ${account.reason}`
      ).catch(() => {})

      return NextResponse.json({ success: true, message: 'تم حل الحالة المشبوهة بنجاح' })
    }

    // ===================== 8. CLEAR LOGIN ATTEMPTS =====================
    if (action === 'clear_login_attempts') {
      let deletedCount = 0
      let snapshot = await db.collection('loginAttempts').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        deletedCount += snapshot.size
        snapshot = await db.collection('loginAttempts').limit(500).get()
      }

      await logAudit(
        adminId,
        'system_cleanup',
        'loginAttempts',
        'all',
        `محاولات الدخول (${deletedCount})`,
        `مسح جميع محاولات الدخول: ${deletedCount} سجل`
      ).catch(() => {})

      return NextResponse.json({
        success: true,
        message: `تم مسح محاولات الدخول بنجاح (${deletedCount} سجل)`,
        data: { deletedCount },
      })
    }

    // ===================== 9. SEND BROADCAST =====================
    if (action === 'send_broadcast') {
      const { title: broadcastTitle, message: broadcastMessage, type: broadcastType } = body
      if (!broadcastTitle || !broadcastMessage) {
        return NextResponse.json({ success: false, message: 'عنوان ونص الإشعار مطلوبان' }, { status: 400 })
      }

      // Fetch all active users
      const usersSnapshot = await db.collection('users')
        .where('status', '==', 'active')
        .limit(500)
        .get()

      if (usersSnapshot.empty) {
        return NextResponse.json({ success: true, message: 'لا يوجد مستخدمين نشطين', data: { sentCount: 0 } })
      }

      let sentCount = 0
      const validTypes = ['info', 'warning', 'urgent', 'success', 'error']
      const notifType = validTypes.includes(broadcastType) ? broadcastType : 'info'

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id
        try {
          await notificationOperations.create({
            userId,
            title: broadcastTitle,
            message: broadcastMessage,
            type: notifType,
            read: false,
          })
          sentCount++
        } catch (err) {
        }
      }

      await logAudit(
        adminId,
        'settings_change',
        'broadcast',
        'all',
        broadcastTitle,
        `إرسال إشعار جماعي: ${broadcastTitle} (${sentCount} مستخدم)`
      ).catch(() => {})

      return NextResponse.json({
        success: true,
        message: `تم إرسال الإشعار إلى ${sentCount} مستخدم`,
        data: { sentCount },
      })
    }

    // ===================== 10. TOGGLE MAINTENANCE MODE =====================
    if (action === 'toggle_maintenance') {
      const settingsDoc = await settingsRef.get()
      const settingsData = settingsDoc.exists ? settingsDoc.data() : null
      const currentMode = settingsData
        ? (settingsData.maintenanceMode ?? false)
        : false

      const newMode = !currentMode

      await settingsRef.set({
        maintenanceMode: newMode,
        updatedAt: nowTimestamp(),
      }, { merge: true })

      await logAudit(
        adminId,
        'settings_change',
        'system',
        'maintenance',
        newMode ? 'وضع الصيانة' : 'التشغيل العادي',
        `${newMode ? 'تفعيل' : 'إلغاء'} وضع الصيانة`
      ).catch(() => {})

      return NextResponse.json({
        success: true,
        message: newMode ? 'تم تفعيل وضع الصيانة' : 'تم إلغاء وضع الصيانة',
        data: { maintenanceMode: newMode },
      })
    }

    // ===================== 11. GET FINANCIAL SUMMARY =====================
    if (action === 'get_financial_summary') {
      try {
        // Sum all user balances
        const usersSnapshot = await db.collection('users').limit(5000).get()
        let totalUserBalances = 0
        for (const doc of usersSnapshot.docs) {
          totalUserBalances += doc.data().balance || 0
        }

        // Sum completed deposits
        const completedDepositsTotal = await sumFieldFromCollection('deposits', 'status', 'completed', 'amount')

        // Sum completed withdrawals
        const completedWithdrawalsTotal = await sumFieldFromCollection('withdrawals', 'status', 'completed', 'amount')

        // Sum pending withdrawals
        const pendingWithdrawalsTotal = await sumFieldFromCollection('withdrawals', 'status', 'pending', 'amount')

        // Sum pending deposits
        const pendingDepositsTotal = await sumFieldFromCollection('deposits', 'status', 'pending', 'amount')

        // Count total P2P trades
        const p2pSnapshot = await db.collection('p2pTrades').limit(5000).get()
        const totalP2PTrades = p2pSnapshot.size

        const financialData = {
          totalUserBalances,
          completedDepositsTotal,
          completedWithdrawalsTotal,
          pendingWithdrawalsTotal,
          pendingDepositsTotal,
          totalP2PTrades,
          totalUsers: usersSnapshot.size,
        }

        await logAudit(
          adminId,
          'settings_change',
          'financial_report',
          'system',
          'التقرير المالي',
          'عرض ملخص مالي شامل'
        ).catch(() => {})

        return NextResponse.json({
          success: true,
          message: 'تم جلب الملخص المالي بنجاح',
          data: financialData,
        })
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب الملخص المالي'
        return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
      }
    }

    // ===================== 12. MANAGE ADMIN =====================
    if (action === 'manage_admin') {
      const { subAction } = body

      if (!subAction) {
        return NextResponse.json({ success: false, message: 'الإجراء الفرعي مطلوب' }, { status: 400 })
      }

      // --- 12a. List Admins ---
      if (subAction === 'list_admins') {
        try {
          const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').limit(100).get()

          if (adminsSnapshot.empty) {
            return NextResponse.json({
              success: true,
              message: 'لا يوجد مدراء',
              data: [],
            })
          }

          const admins = adminsSnapshot.docs.map(doc => {
            const data = doc.data()
            return {
              id: doc.id,
              email: data.email || '',
              name: data.fullName || '',
              role: data.role || 'admin',
              permissions: parsePermissions(data.permissions),
              status: data.status || 'active',
              createdAt: data.createdAt || '',
              lastLogin: data.lastLogin || null,
            }
          })

          return NextResponse.json({
            success: true,
            message: 'تم جلب قائمة المدراء بنجاح',
            data: admins,
          })
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب قائمة المدراء'
          return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
        }
      }

      // --- 12b. Update Permissions ---
      if (subAction === 'update_permissions') {
        const { targetUserId, permissions } = body
        if (!targetUserId) {
          return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
        }
        if (!permissions || typeof permissions !== 'object') {
          return NextResponse.json({ success: false, message: 'صلاحيات غير صالحة' }, { status: 400 })
        }

        try {
          const targetUser = await userOperations.findUnique({ id: targetUserId })
          if (!targetUser) {
            return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
          }
          if (targetUser.role !== 'admin') {
            return NextResponse.json({ success: false, message: 'المستخدم ليس مديراً' }, { status: 400 })
          }

          const newPermissions: AdminPermissions = {
            manageUsers: Boolean(permissions.manageUsers),
            approveDeposits: Boolean(permissions.approveDeposits),
            approveWithdrawals: Boolean(permissions.approveWithdrawals),
            approveKYC: Boolean(permissions.approveKYC),
            manageSettings: Boolean(permissions.manageSettings),
          }

          await db.collection('users').doc(targetUserId).update({
            permissions: stringifyPermissions(newPermissions),
            updatedAt: nowTimestamp(),
          })

          await logAudit(
            adminId,
            'permissions_change',
            'user',
            targetUserId,
            targetUser.email,
            `تحديث صلاحيات المدير: ${targetUser.email} - ${JSON.stringify(newPermissions)}`
          ).catch(() => {})

          return NextResponse.json({
            success: true,
            message: 'تم تحديث الصلاحيات بنجاح',
            data: { permissions: newPermissions },
          })
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء تحديث الصلاحيات'
          return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
        }
      }

      // --- 12c. Demote Admin ---
      if (subAction === 'demote_admin') {
        const { targetUserId } = body
        if (!targetUserId) {
          return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
        }

        // Cannot demote self
        if (targetUserId === adminId) {
          return NextResponse.json({ success: false, message: 'لا يمكنك إزالة صلاحياتك الخاصة' }, { status: 400 })
        }

        try {
          const targetUser = await userOperations.findUnique({ id: targetUserId })
          if (!targetUser) {
            return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
          }
          if (targetUser.role !== 'admin') {
            return NextResponse.json({ success: false, message: 'المستخدم ليس مديراً' }, { status: 400 })
          }

          await db.collection('users').doc(targetUserId).update({
            role: 'user',
            permissions: null,
            updatedAt: nowTimestamp(),
          })

          await logAudit(
            adminId,
            'user_demote',
            'user',
            targetUserId,
            targetUser.email,
            `إزالة صلاحية الإدارة من: ${targetUser.email}`
          ).catch(() => {})

          return NextResponse.json({
            success: true,
            message: 'تم إزالة صلاحية الإدارة بنجاح',
          })
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء إزالة الصلاحية'
          return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
        }
      }

      // --- 12d. Promote to Admin ---
      if (subAction === 'promote_to_admin') {
        const { targetUserId, permissions: promotePermissions } = body
        if (!targetUserId) {
          return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
        }

        try {
          const targetUser = await userOperations.findUnique({ id: targetUserId })
          if (!targetUser) {
            return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
          }
          if (targetUser.role === 'admin') {
            return NextResponse.json({ success: false, message: 'المستخدم مدير بالفعل' }, { status: 400 })
          }

          const newPermissions: AdminPermissions = promotePermissions
            ? {
                manageUsers: Boolean(promotePermissions.manageUsers),
                approveDeposits: Boolean(promotePermissions.approveDeposits),
                approveWithdrawals: Boolean(promotePermissions.approveWithdrawals),
                approveKYC: Boolean(promotePermissions.approveKYC),
                manageSettings: Boolean(promotePermissions.manageSettings),
              }
            : {
                manageUsers: false,
                approveDeposits: true,
                approveWithdrawals: true,
                approveKYC: true,
                manageSettings: false,
              }

          await db.collection('users').doc(targetUserId).update({
            role: 'admin',
            permissions: stringifyPermissions(newPermissions),
            updatedAt: nowTimestamp(),
          })

          await logAudit(
            adminId,
            'user_promote',
            'user',
            targetUserId,
            targetUser.email,
            `ترقية مستخدم إلى مدير: ${targetUser.email}`
          ).catch(() => {})

          return NextResponse.json({
            success: true,
            message: 'تم ترقية المستخدم إلى مدير بنجاح',
            data: { permissions: newPermissions },
          })
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء الترقية'
          return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
        }
      }

      return NextResponse.json({ success: false, message: 'إجراء فرعي غير معروف' }, { status: 400 })
    }

    // ===================== 13. CLEANUP DATA =====================
    if (action === 'cleanup_data') {
      const { target } = body

      if (!target) {
        return NextResponse.json({ success: false, message: 'هدف التنظيف مطلوب' }, { status: 400 })
      }

      const validTargets = ['expired_otp', 'old_notifications', 'old_login_attempts', 'pending_pin_resets']
      if (!validTargets.includes(target)) {
        return NextResponse.json({
          success: false,
          message: `هدف التنظيف غير صالح. الأهداف المتاحة: ${validTargets.join(', ')}`,
        }, { status: 400 })
      }

      try {
        let deletedCount = 0

        if (target === 'expired_otp') {
          // Delete OTP codes older than 24 hours
          deletedCount = await deleteOldDocuments('otpCodes', 'createdAt', 24 * 60 * 60 * 1000)
        } else if (target === 'old_notifications') {
          // Delete read notifications older than 30 days
          const db2 = getDb()
          const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

          // First filter read notifications
          let snapshot = await db2.collection('notifications')
            .where('read', '==', true)
            .limit(500)
            .get()

          while (snapshot.size > 0) {
            const batch = db2.batch()
            let hasMore = false
            let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null
            for (const doc of snapshot.docs) {
              const createdAt = doc.data().createdAt
              if (createdAt && new Date(createdAt as string).getTime() < new Date(cutoffDate).getTime()) {
                batch.delete(doc.ref)
                deletedCount++
              }
              lastDoc = doc
            }
            await batch.commit()
            if (lastDoc && snapshot.size >= 500) {
              snapshot = await db2.collection('notifications')
                .where('read', '==', true)
                .startAfter(lastDoc)
                .limit(500)
                .get()
              hasMore = snapshot.size > 0
            } else {
              break
            }
            if (!hasMore) break
          }
        } else if (target === 'old_login_attempts') {
          // Delete login attempts older than 7 days
          deletedCount = await deleteOldDocuments('loginAttempts', 'createdAt', 7 * 24 * 60 * 60 * 1000)
        } else if (target === 'pending_pin_resets') {
          // Delete pendingPinReset entries older than 24 hours
          // These are stored as a field in user documents or as a separate collection
          // Let's check for a pendingPinResets collection first, then fall back to user documents
          try {
            const snapshot = await db.collection('pendingPinResets').limit(1).get()
            if (!snapshot.empty) {
              deletedCount = await deleteOldDocuments('pendingPinResets', 'createdAt', 24 * 60 * 60 * 1000)
            } else {
              // Look for users with pendingPinReset field older than 24 hours
              const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
              const usersSnapshot = await db.collection('users')
                .where('pendingPinReset', '!=', null)
                .limit(500)
                .get()

              const batch = db.batch()
              for (const doc of usersSnapshot.docs) {
                const pendingPinReset = doc.data().pendingPinReset
                if (pendingPinReset) {
                  // pendingPinReset could be a boolean or a timestamp string
                  if (typeof pendingPinReset === 'string') {
                    if (new Date(pendingPinReset).getTime() < new Date(cutoffDate).getTime()) {
                      batch.update(doc.ref, { pendingPinReset: null, updatedAt: nowTimestamp() })
                      deletedCount++
                    }
                  } else {
                    // If it's a boolean true, clear it (assume it's old enough)
                    batch.update(doc.ref, { pendingPinReset: null, updatedAt: nowTimestamp() })
                    deletedCount++
                  }
                }
              }
              if (deletedCount > 0) {
                await batch.commit()
              }
            }
          } catch {
            // Collection might not exist, that's ok
          }
        }

        await logAudit(
          adminId,
          'system_cleanup',
          'cleanup',
          target,
          target,
          `تنظيف البيانات: ${target} (${deletedCount} عنصر محذوف)`
        ).catch(() => {})

        return NextResponse.json({
          success: true,
          message: `تم تنظيف "${target}" بنجاح`,
          data: { target, deletedCount },
        })
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء تنظيف البيانات'
        return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
      }
    }

    // ===================== 14. GET AUDIT LOGS =====================
    if (action === 'get_audit_logs') {
      const { filters } = body as { filters?: AuditLogFilters }

      try {
        let query: FirebaseFirestore.Query = db.collection('auditLog')
        const limit = Math.min(Math.max(filters?.limit || 50, 1), 200)

        // Apply filters — Firestore composite index limitations mean we apply simple filters in the query
        // and do complex ones in JS
        if (filters?.actionType) {
          query = query.where('actionType', '==', filters.actionType)
        }
        if (filters?.adminId) {
          query = query.where('adminId', '==', filters.adminId)
        }
        if (filters?.targetType) {
          query = query.where('targetType', '==', filters.targetType)
        }

        query = query.limit(limit)

        const snapshot = await query.get()
        let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))

        // Apply date filters in JS (to avoid composite index issues)
        if (filters?.startDate) {
          const start = new Date(filters.startDate).getTime()
          logs = logs.filter(log => {
            const createdAt = log.createdAt as string
            return createdAt && new Date(createdAt).getTime() >= start
          })
        }
        if (filters?.endDate) {
          const end = new Date(filters.endDate).getTime()
          logs = logs.filter(log => {
            const createdAt = log.createdAt as string
            return createdAt && new Date(createdAt).getTime() <= end
          })
        }

        // Sort by createdAt descending
        logs.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())

        // Re-apply limit after JS filtering
        logs = logs.slice(0, limit)

        return NextResponse.json({
          success: true,
          message: 'تم جلب سجل التدقيق بنجاح',
          data: {
            logs,
            total: logs.length,
            appliedFilters: filters || {},
          },
        })
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب سجل التدقيق'
        return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
      }
    }

    // ===================== 15. QUICK USER OPERATION =====================
    if (action === 'quick_user_operation') {
      const { subAction } = body

      if (!subAction) {
        return NextResponse.json({ success: false, message: 'الإجراء الفرعي مطلوب' }, { status: 400 })
      }

      // --- 15a. Search User ---
      if (subAction === 'search_user') {
        const { query: searchQuery } = body
        if (!searchQuery || typeof searchQuery !== 'string') {
          return NextResponse.json({ success: false, message: 'كلمة البحث مطلوبة' }, { status: 400 })
        }

        try {
          const searchTerm = searchQuery.trim().toLowerCase()
          if (searchTerm.length < 2) {
            return NextResponse.json({ success: false, message: 'كلمة البحث قصيرة جداً (حرفين على الأقل)' }, { status: 400 })
          }

          // Fetch users and filter by partial match on email or name
          const usersSnapshot = await db.collection('users').limit(500).get()
          const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<Record<string, any>>

          const matchedUsers = allUsers.filter((u: Record<string, any>) => {
            const email = (u.email || '').toLowerCase()
            const fullName = (u.fullName || '').toLowerCase()
            const phone = (u.phone || '').toLowerCase()
            const userId = (u.id || '').toLowerCase()
            return email.includes(searchTerm) || fullName.includes(searchTerm) || phone.includes(searchTerm) || userId.includes(searchTerm)
          }).slice(0, 10).map((u: Record<string, any>) => ({
            id: u.id,
            email: u.email || '',
            name: u.fullName || '',
            role: u.role || 'user',
            status: u.status || 'active',
            balance: u.balance || 0,
            createdAt: u.createdAt || '',
            phone: u.phone || '',
          }))

          return NextResponse.json({
            success: true,
            message: `تم العثور على ${matchedUsers.length} مستخدم`,
            results: matchedUsers,
          })
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء البحث'
          return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
        }
      }

      // --- 15b. Get User Details ---
      if (subAction === 'get_user_details') {
        const { userId } = body
        if (!userId) {
          return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
        }

        try {
          const targetUser = await userOperations.findUnique({ id: userId })
          if (!targetUser) {
            return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
          }

          // Fetch additional user data in parallel
          const [depositsSnapshot, withdrawalsSnapshot, transactionsSnapshot] = await Promise.all([
            db.collection('deposits').where('userId', '==', userId).limit(50).get(),
            db.collection('withdrawals').where('userId', '==', userId).limit(50).get(),
            db.collection('transactions').where('userId', '==', userId).limit(50).get(),
          ])

          const userDetails = {
            ...targetUser,
            permissions: parsePermissions(targetUser.permissions),
            recentDeposits: depositsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
            recentWithdrawals: withdrawalsSnapshot.docs.map(w => ({ id: w.id, ...w.data() })),
            recentTransactions: transactionsSnapshot.docs.map(t => ({ id: t.id, ...t.data() })),
            depositCount: depositsSnapshot.size,
            withdrawalCount: withdrawalsSnapshot.size,
            transactionCount: transactionsSnapshot.size,
          }

          return NextResponse.json({
            success: true,
            message: 'تم جلب تفاصيل المستخدم بنجاح',
            data: userDetails,
          })
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب تفاصيل المستخدم'
          return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
        }
      }

      // --- 15c. Quick Credit ---
      if (subAction === 'quick_credit') {
        const { userId, amount, reason } = body
        if (!userId) {
          return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
        }
        if (!amount || typeof amount !== 'number' || amount <= 0) {
          return NextResponse.json({ success: false, message: 'المبلغ مطلوب ويجب أن يكون رقماً موجباً' }, { status: 400 })
        }

        try {
          const targetUser = await userOperations.findUnique({ id: userId })
          if (!targetUser) {
            return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
          }

          const balanceBefore = targetUser.balance || 0
          const balanceAfter = balanceBefore + amount

          await db.collection('users').doc(userId).update({
            balance: balanceAfter,
            updatedAt: nowTimestamp(),
          })

          // Create a transaction record
          await db.collection('transactions').add({
            id: generateId(),
            userId,
            type: 'admin_credit',
            amount,
            balanceBefore,
            balanceAfter,
            description: reason || `إيداع إداري بواسطة المدير الرئيسي`,
            createdAt: nowTimestamp(),
          })

          await logAudit(
            adminId,
            'balance_add',
            'user',
            userId,
            targetUser.email,
            `إضافة رصيد: ${amount} للمستخدم ${targetUser.email}. الرصيد السابق: ${balanceBefore}, الرصيد الجديد: ${balanceAfter}. السبب: ${reason || 'إيداع إداري'}`
          ).catch(() => {})

          // Send notification to user
          await notificationOperations.create({
            userId,
            title: 'إيداع في حسابك',
            message: `تم إيداع مبلغ ${amount} في حسابك ${reason ? `- ${reason}` : ''}`,
            type: 'success',
            read: false,
          }).catch(() => {})

          return NextResponse.json({
            success: true,
            message: `تم إضافة ${amount} إلى حساب المستخدم بنجاح`,
            data: { balanceBefore, balanceAfter, amount },
          })
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء إضافة الرصيد'
          return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
        }
      }

      // --- 15d. Quick Debit ---
      if (subAction === 'quick_debit') {
        const { userId, amount, reason } = body
        if (!userId) {
          return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
        }
        if (!amount || typeof amount !== 'number' || amount <= 0) {
          return NextResponse.json({ success: false, message: 'المبلغ مطلوب ويجب أن يكون رقماً موجباً' }, { status: 400 })
        }

        try {
          const targetUser = await userOperations.findUnique({ id: userId })
          if (!targetUser) {
            return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
          }

          const balanceBefore = targetUser.balance || 0

          // Check sufficient balance
          if (balanceBefore < amount) {
            return NextResponse.json({
              success: false,
              message: `رصيد المستخدم غير كافي. الرصيد الحالي: ${balanceBefore}, المبلغ المطلوب: ${amount}`,
            }, { status: 400 })
          }

          const balanceAfter = balanceBefore - amount

          await db.collection('users').doc(userId).update({
            balance: balanceAfter,
            updatedAt: nowTimestamp(),
          })

          // Create a transaction record
          await db.collection('transactions').add({
            id: generateId(),
            userId,
            type: 'admin_debit',
            amount,
            balanceBefore,
            balanceAfter,
            description: reason || `خصم إداري بواسطة المدير الرئيسي`,
            createdAt: nowTimestamp(),
          })

          await logAudit(
            adminId,
            'balance_withdraw',
            'user',
            userId,
            targetUser.email,
            `خصم رصيد: ${amount} من المستخدم ${targetUser.email}. الرصيد السابق: ${balanceBefore}, الرصيد الجديد: ${balanceAfter}. السبب: ${reason || 'خصم إداري'}`
          ).catch(() => {})

          // Send notification to user
          await notificationOperations.create({
            userId,
            title: 'خصم من حسابك',
            message: `تم خصم مبلغ ${amount} من حسابك ${reason ? `- ${reason}` : ''}`,
            type: 'warning',
            read: false,
          }).catch(() => {})

          return NextResponse.json({
            success: true,
            message: `تم خصم ${amount} من حساب المستخدم بنجاح`,
            data: { balanceBefore, balanceAfter, amount },
          })
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء خصم الرصيد'
          return NextResponse.json({ success: false, message: errorMsg }, { status: 500 })
        }
      }

      return NextResponse.json({ success: false, message: 'إجراء فرعي غير معروف' }, { status: 400 })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء تنفيذ الإجراء'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
