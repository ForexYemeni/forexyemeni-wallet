import { NextRequest, NextResponse } from 'next/server'
import { userOperations, notificationOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp, generateId } from '@/lib/firebase'
import { logAudit } from '@/lib/audit-log'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

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
  // Super admin = role 'admin' with no permissions (main admin) OR email matches ADMIN_EMAIL
  const isMainAdmin = user.role === 'admin' && !user.permissions
  const isByEmail = user.email === ADMIN_EMAIL
  if (!isMainAdmin && !isByEmail) {
    return { authorized: false, user, message: 'ليس لديك صلاحية المدير الرئيسي' }
  }
  return { authorized: true, user }
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
      console.error('[SuperAdmin GET] Error reading settings:', err)
    }

    // 2. Fetch recent login attempts (last 50)
    let loginAttempts: Array<Record<string, unknown>> = []
    try {
      const loginSnapshot = await db.collection('loginAttempts').limit(50).get()
      loginAttempts = loginSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
        .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
    } catch (err) {
      console.error('[SuperAdmin GET] Error reading login attempts:', err)
    }

    // 3. Active sessions count
    let activeSessionsCount = 0
    try {
      const sessionsSnapshot = await db.collection('userDevices').limit(500).get()
      activeSessionsCount = sessionsSnapshot.size
    } catch (err) {
      console.error('[SuperAdmin GET] Error reading sessions:', err)
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

    return NextResponse.json({
      success: true,
      data: {
        settings,
        loginAttempts,
        activeSessionsCount,
        collectionCounts,
        totalRecords,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب الإعدادات'
    console.error('[SuperAdmin GET]', error)
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
          console.error(`[Broadcast] Error sending to user ${userId}:`, err)
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

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء تنفيذ الإجراء'
    console.error('[SuperAdmin POST]', error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
