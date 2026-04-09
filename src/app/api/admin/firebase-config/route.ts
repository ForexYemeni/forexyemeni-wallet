import { NextRequest, NextResponse } from 'next/server'
import { getDb, reinitializeFirebase, resetFirebaseToDefault, getCurrentProjectId, nowTimestamp, generateId, generateAffiliateCode } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

// GET - get current Firebase connection status (NO admin verification needed)
export async function GET() {
  try {
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
// Admin info comes from the client-side user object (already authenticated via session)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, serviceAccountKey, adminPassword, adminEmail, adminName, adminPhone, adminCountry } = body

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
        }, `test-connection-${Date.now()}`)

        testProjectId = serviceAccount.project_id as string
        const testDb = getFs(testApp)

        // Test read
        await testDb.collection('systemSettings').doc('testConnection').get()

        // Check if admin user already exists in the new database
        let adminExists = false
        try {
          const adminSnapshot = await testDb.collection('users')
            .where('email', '==', adminEmail)
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
        const errStr = errMsg.toLowerCase()

        // Detect common issues with new Firebase projects
        if (errStr.includes('not found') || errStr.includes('not configured') || errStr.includes('firestore')) {
          return NextResponse.json({
            success: false,
            message: 'قاعدة Firestore غير موجودة! يجب إنشاؤها أولاً من Firebase Console → Firestore Database → Create database',
            projectId: testProjectId,
          }, { status: 400 })
        }
        if (errStr.includes('permission') || errStr.includes('access') || errStr.includes('denied')) {
          return NextResponse.json({
            success: false,
            message: 'صلاحيات غير كافية! تأكد من أن مفتاح Service Account يحتوي على صلاحيات Firestore (roles/firestore.admin)',
            projectId: testProjectId,
          }, { status: 400 })
        }
        if (errStr.includes('network') || errStr.includes('timeout') || errStr.includes('unavailable')) {
          return NextResponse.json({
            success: false,
            message: 'تعذر الوصول لقاعدة البيانات. تأكد من أن Firestore Database مُفعّلة في المشروع وأن الإنترنت يعمل.',
            projectId: testProjectId,
          }, { status: 400 })
        }
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
      const email = adminEmail || 'admin@forexyemeni.com'

      try {
        const { initializeApp: initApp, cert: firebaseCert, deleteApp: delApp } = await import('firebase-admin/app')
        const { getFirestore: getFs } = await import('firebase-admin/firestore')

        const setupApp = initApp({
          credential: firebaseCert(serviceAccount as any),
        }, `setup-${Date.now()}`)

        const newDb = getFs(setupApp)

        // 1. Check if admin already exists
        const adminSnapshot = await newDb.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get()

        if (!adminSnapshot.empty) {
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
            adminEmail: email,
            adminPassword: setupPassword,
            adminUpdated: true,
            adminCreated: false,
            message: `حساب المسؤول موجود مسبقاً - تم تحديث كلمة المرور في المشروع: ${projectId}`,
          })
        }

        // 2. Create new admin user
        const adminId = generateId()
        const affiliateCode = generateAffiliateCode()
        const passwordHash = await bcrypt.hash(setupPassword, 12)

        const adminUser = {
          id: adminId,
          email,
          passwordHash,
          fullName: adminName || 'مدير النظام',
          phone: adminPhone || null,
          country: adminCountry || null,
          role: 'admin',
          status: 'active',
          emailVerified: true,
          phoneVerified: false,
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

        await delApp(setupApp)

        return NextResponse.json({
          success: true,
          projectId,
          adminEmail: adminUser.email,
          adminPassword: setupPassword,
          adminCreated: true,
          adminUpdated: false,
          message: `تم إنشاء قاعدة البيانات بنجاح في المشروع: ${projectId}`,
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

      const db = getDb()
      await db.collection('systemSettings').doc('customFirebase').set({
        encodedKey,
        projectId,
        updatedAt: nowTimestamp(),
      }, { merge: true })

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
