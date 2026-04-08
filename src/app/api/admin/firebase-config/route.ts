import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import { getDb, reinitializeFirebase, resetFirebaseToDefault, getCurrentProjectId, nowTimestamp, generateId, generateAffiliateCode } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

// Helper: verify admin role (relaxed - checks id and role)
async function verifyAdmin(userId: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  if (!userId) {
    return { ok: false, error: 'معرف المستخدم مطلوب', status: 400 }
  }
  try {
    let user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return { ok: false, error: 'المستخدم غير موجود', status: 404 }
    }
    if (user.role !== 'admin') {
      return { ok: false, error: 'ليس لديك صلاحية لهذا الإجراء', status: 403 }
    }
    return { ok: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في الاتصال بقاعدة البيانات'
    return { ok: false, error: message, status: 500 }
  }
}

// GET - get current Firebase connection status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const check = await verifyAdmin(userId || '')
    if (!check.ok) {
      return NextResponse.json({ success: false, message: check.error }, { status: check.status })
    }

    const db = getDb()
    const projectId = getCurrentProjectId()
    let connected = false
    let isCustom = false
    let customProjectId: string | null = null
    let updatedAt: string | null = null

    try {
      await db.collection('systemSettings').doc('customFirebase').get()
      connected = true
    } catch {
      connected = false
    }

    try {
      const customDoc = await db.collection('systemSettings').doc('customFirebase').get()
      if (customDoc.exists) {
        const data = customDoc.data()
        isCustom = true
        customProjectId = data?.projectId || null
        updatedAt = data?.updatedAt || null
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      projectId,
      connected,
      isCustom,
      customProjectId,
      updatedAt,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST - test / setup / save / revert Firebase config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, serviceAccountKey, adminPassword } = body

    const check = await verifyAdmin(userId)
    if (!check.ok) {
      return NextResponse.json({ success: false, message: check.error }, { status: check.status })
    }

    // Get current admin info BEFORE switching databases
    const currentAdmin = await userOperations.findUnique({ id: userId })

    // === TEST ACTION ===
    if (action === 'test') {
      if (!serviceAccountKey) {
        return NextResponse.json({ success: false, message: 'مفتاح Service Account مطلوب' }, { status: 400 })
      }

      let serviceAccount: Record<string, unknown>
      try {
        serviceAccount = JSON.parse(serviceAccountKey)
      } catch {
        return NextResponse.json({ success: false, message: 'صيغة JSON غير صالحة' }, { status: 400 })
      }

      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        return NextResponse.json({
          success: false,
          message: 'المفتاح مفقود بعض الحقول المطلوبة (project_id, private_key, client_email)'
        }, { status: 400 })
      }

      let testProjectId: string | null = null
      try {
        const { initializeApp: initApp, cert: firebaseCert, deleteApp: delApp } = await import('firebase-admin/app')
        const { getFirestore: getFs } = await import('firebase-admin/firestore')

        const testApp = initApp({
          credential: firebaseCert(serviceAccount as any),
          databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        }, `test-connection-${Date.now()}`)

        testProjectId = serviceAccount.project_id as string
        const testDb = getFs(testApp)

        // Test read
        await testDb.collection('systemSettings').doc('testConnection').get()

        // Check if admin user already exists in the new database
        let adminExists = false
        try {
          const adminSnapshot = await testDb.collection('users')
            .where('email', '==', currentAdmin?.email)
            .limit(1)
            .get()
          adminExists = !adminSnapshot.empty
        } catch {
          adminExists = false
        }

        // Check if there are any users at all
        let totalUsers = 0
        try {
          const usersSnapshot = await testDb.collection('users').limit(1).get()
          totalUsers = usersSnapshot.size
        } catch {
          totalUsers = 0
        }

        await delApp(testApp)

        return NextResponse.json({
          success: true,
          projectId: testProjectId,
          message: 'تم الاتصال بنجاح',
          adminExists,
          totalUsers,
        })
      } catch (testError: unknown) {
        const errMsg = testError instanceof Error ? testError.message : 'فشل الاتصال'
        return NextResponse.json({
          success: false,
          message: `فشل الاتصال: ${errMsg}`,
          projectId: testProjectId,
        }, { status: 400 })
      }
    }

    // === SETUP ACTION - Create admin + init settings in new database ===
    if (action === 'setup') {
      if (!serviceAccountKey) {
        return NextResponse.json({ success: false, message: 'مفتاح Service Account مطلوب' }, { status: 400 })
      }

      let serviceAccount: Record<string, unknown>
      try {
        serviceAccount = JSON.parse(serviceAccountKey)
      } catch {
        return NextResponse.json({ success: false, message: 'صيغة JSON غير صالحة' }, { status: 400 })
      }

      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        return NextResponse.json({
          success: false,
          message: 'المفتاح مفقود بعض الحقول المطلوبة'
        }, { status: 400 })
      }

      const projectId = serviceAccount.project_id as string
      const setupPassword = adminPassword || 'Admin@123'

      try {
        // Connect to the new database
        const { initializeApp: initApp, cert: firebaseCert, deleteApp: delApp } = await import('firebase-admin/app')
        const { getFirestore: getFs } = await import('firebase-admin/firestore')

        const setupApp = initApp({
          credential: firebaseCert(serviceAccount as any),
          databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        }, `setup-${Date.now()}`)

        const newDb = getFs(setupApp)

        // 1. Check if admin already exists
        const adminSnapshot = await newDb.collection('users')
          .where('email', '==', currentAdmin?.email)
          .limit(1)
          .get()

        if (!adminSnapshot.empty) {
          // Admin exists, update password to ensure access
          const existingAdmin = adminSnapshot.docs[0]
          const newHash = await bcrypt.hash(setupPassword, 12)
          await newDb.collection('users').doc(existingAdmin.id).update({
            passwordHash: newHash,
            role: 'admin',
            status: 'active',
            emailVerified: true,
            updatedAt: nowTimestamp(),
          })
          await delApp(setupApp)
          return NextResponse.json({
            success: true,
            projectId,
            adminUpdated: true,
            message: `حساب المسؤول موجود مسبقاً - تم تحديث كلمة المرور في المشروع: ${projectId}`,
          })
        }

        // 2. Create new admin user
        const adminId = generateId()
        const affiliateCode = generateAffiliateCode()
        const passwordHash = await bcrypt.hash(setupPassword, 12)

        const adminUser = {
          id: adminId,
          email: currentAdmin?.email || 'admin@forexyemeni.com',
          passwordHash,
          fullName: currentAdmin?.fullName || 'مدير النظام',
          phone: currentAdmin?.phone || null,
          country: currentAdmin?.country || null,
          role: 'admin',
          status: 'active',
          emailVerified: true,
          phoneVerified: currentAdmin?.phoneVerified || false,
          kycStatus: 'none',
          kycIdPhoto: null,
          kycSelfie: null,
          kycNotes: null,
          balance: 0,
          frozenBalance: 0,
          mustChangePassword: false,
          affiliateCode,
          referredBy: null,
          merchantId: null,
          permissions: null,
          twoFactorEnabled: false,
          backupCodes: null,
          createdAt: nowTimestamp(),
          updatedAt: nowTimestamp(),
        }

        await newDb.collection('users').doc(adminId).set(adminUser)

        // 3. Initialize counters
        await newDb.collection('counters').doc('accountNumber').set({ value: 100001 })

        // 4. Initialize system settings
        await newDb.collection('systemSettings').doc('fees').set({
          depositFee: 3,
          withdrawalFee: 3,
          updatedAt: nowTimestamp(),
        })

        await newDb.collection('systemSettings').doc('referralSettings').set({
          isEnabled: false,
          commissionType: 'percentage',
          commissionLevels: [3, 1, 0.5],
          minDepositForCommission: 10,
          maxLevels: 3,
        })

        await newDb.collection('systemSettings').doc('global').set({
          maintenanceMode: false,
          maintenanceMessage: '',
          registrationOpen: true,
          kycRequired: false,
          depositFeePercent: 3,
          withdrawalFeePercent: 3,
          minDepositAmount: 10,
          maxDepositAmount: 10000,
          minWithdrawAmount: 10,
          maxWithdrawAmount: 5000,
          dailyWithdrawLimit: 0,
          autoApproveDeposit: false,
          autoApproveWithdrawal: false,
          platformName: 'ForexYemeni',
          supportEmail: '',
          supportPhone: '',
          telegramLink: '',
          whatsappLink: '',
          announcements: [],
          updatedAt: nowTimestamp(),
        })

        await newDb.collection('systemSettings').doc('botSettings').set({
          isEnabled: true,
          greeting: 'مرحباً! كيف يمكنني مساعدتك اليوم؟ اطرح سؤالك وسأحاول الإجابة.',
          updatedAt: nowTimestamp(),
        })

        await newDb.collection('systemSettings').doc('socialLinks').set({
          whatsapp: '',
          phone: '',
          telegram: '',
          facebook: '',
          instagram: '',
          twitter: '',
          tiktok: '',
          updatedAt: nowTimestamp(),
        })

        // 5. Clean up test app
        await delApp(setupApp)

        return NextResponse.json({
          success: true,
          projectId,
          adminEmail: adminUser.email,
          adminPassword: setupPassword,
          adminCreated: true,
          message: `تم إنشاء قاعدة البيانات بنجاح في المشروع: ${projectId}\nالبريد: ${adminUser.email}\nكلمة المرور: ${setupPassword}`,
        })
      } catch (setupError: unknown) {
        const errMsg = setupError instanceof Error ? setupError.message : 'خطأ'
        return NextResponse.json({
          success: false,
          message: `فشل إعداد القاعدة: ${errMsg}`,
        }, { status: 500 })
      }
    }

    // === SAVE ACTION ===
    if (action === 'save') {
      if (!serviceAccountKey) {
        return NextResponse.json({ success: false, message: 'مفتاح Service Account مطلوب' }, { status: 400 })
      }

      let serviceAccount: Record<string, unknown>
      try {
        serviceAccount = JSON.parse(serviceAccountKey)
      } catch {
        return NextResponse.json({ success: false, message: 'صيغة JSON غير صالحة' }, { status: 400 })
      }

      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        return NextResponse.json({
          success: false,
          message: 'المفتاح مفقود بعض الحقول المطلوبة'
        }, { status: 400 })
      }

      const projectId = serviceAccount.project_id as string
      const encodedKey = Buffer.from(serviceAccountKey).toString('base64')

      // Save custom config using the CURRENT db
      const db = getDb()
      await db.collection('systemSettings').doc('customFirebase').set({
        encodedKey,
        projectId,
        updatedAt: nowTimestamp(),
      }, { merge: true })

      // Reinitialize Firebase with the new key
      try {
        reinitializeFirebase(serviceAccountKey)

        const newDb = getDb()
        await newDb.collection('systemSettings').doc('customFirebase').get()

        return NextResponse.json({
          success: true,
          projectId,
          message: `تم حفظ المفتاح وتفعيله بنجاح - المشروع: ${projectId}`,
        })
      } catch (initError: unknown) {
        const errMsg = initError instanceof Error ? initError.message : 'خطأ'
        try { resetFirebaseToDefault() } catch { /* best effort */ }
        return NextResponse.json({
          success: false,
          message: `تم حفظ المفتاح لكن فشل التفعيل: ${errMsg}. تم الرجوع للمفتاح الافتراضي.`,
        }, { status: 500 })
      }
    }

    // === REVERT ACTION ===
    if (action === 'revert') {
      try {
        const db = getDb()
        await db.collection('systemSettings').doc('customFirebase').delete()

        resetFirebaseToDefault()

        const defaultDb = getDb()
        await defaultDb.collection('systemSettings').doc('customFirebase').get()

        const defaultProjectId = getCurrentProjectId()

        return NextResponse.json({
          success: true,
          projectId: defaultProjectId,
          message: 'تم الرجوع للمفتاح الافتراضي بنجاح',
        })
      } catch (revertError: unknown) {
        const errMsg = revertError instanceof Error ? revertError.message : 'خطأ'
        return NextResponse.json({
          success: false,
          message: `فشل الرجوع للمفتاح الافتراضي: ${errMsg}`,
        }, { status: 500 })
      }
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
