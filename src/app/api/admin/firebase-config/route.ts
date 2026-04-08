import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import { getDb, reinitializeFirebase, resetFirebaseToDefault, getCurrentProjectId, nowTimestamp } from '@/lib/firebase'

// Helper: verify admin role
async function verifyAdmin(userId: string) {
  if (!userId) {
    return { ok: false, error: 'معرف المستخدم مطلوب', status: 400 }
  }
  const user = await userOperations.findUnique({ id: userId })
  if (!user) {
    return { ok: false, error: 'المستخدم غير موجود', status: 404 }
  }
  if (user.role !== 'admin') {
    return { ok: false, error: 'ليس لديك صلاحية لهذا الإجراء', status: 403 }
  }
  return { ok: true }
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
      // Test connection by reading systemSettings
      await db.collection('systemSettings').doc('customFirebase').get()
      connected = true
    } catch {
      connected = false
    }

    // Check if there is a custom config saved
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

// POST - test / save / revert Firebase config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, serviceAccountKey } = body

    const check = await verifyAdmin(userId)
    if (!check.ok) {
      return NextResponse.json({ success: false, message: check.error }, { status: check.status })
    }

    // === TEST ACTION ===
    if (action === 'test') {
      if (!serviceAccountKey) {
        return NextResponse.json({ success: false, message: 'مفتاح Service Account مطلوب' }, { status: 400 })
      }

      // Validate JSON
      let serviceAccount: Record<string, unknown>
      try {
        serviceAccount = JSON.parse(serviceAccountKey)
      } catch {
        return NextResponse.json({ success: false, message: 'صيغة JSON غير صالحة' }, { status: 400 })
      }

      // Check required fields
      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        return NextResponse.json({
          success: false,
          message: 'المفتاح مفقود بعض الحقول المطلوبة (project_id, private_key, client_email)'
        }, { status: 400 })
      }

      // Try to initialize a temporary Firebase app and test connection
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

        // Try to read something from Firestore
        await testDb.collection('systemSettings').doc('testConnection').get()

        // Clean up the test app
        await delApp(testApp)

        return NextResponse.json({
          success: true,
          projectId: testProjectId,
          message: 'تم الاتصال بنجاح',
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

    // === SAVE ACTION ===
    if (action === 'save') {
      if (!serviceAccountKey) {
        return NextResponse.json({ success: false, message: 'مفتاح Service Account مطلوب' }, { status: 400 })
      }

      // Validate JSON
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

      // First, save the custom config using the CURRENT db connection
      const db = getDb()
      await db.collection('systemSettings').doc('customFirebase').set({
        encodedKey,
        projectId,
        updatedAt: nowTimestamp(),
      }, { merge: true })

      // Now reinitialize Firebase with the new key
      try {
        reinitializeFirebase(serviceAccountKey)

        // Verify the new connection works
        const newDb = getDb()
        await newDb.collection('systemSettings').doc('customFirebase').get()

        return NextResponse.json({
          success: true,
          projectId,
          message: `تم حفظ المفتاح وتفعيله بنجاح - المشروع: ${projectId}`,
        })
      } catch (initError: unknown) {
        // If reinitialization fails, revert to default
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
        // First, delete the custom config from Firestore using current connection
        const db = getDb()
        await db.collection('systemSettings').doc('customFirebase').delete()

        // Reset Firebase to default key
        resetFirebaseToDefault()

        // Verify default connection works
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
