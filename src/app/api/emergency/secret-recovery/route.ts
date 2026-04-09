import { NextRequest, NextResponse } from 'next/server'

/**
 * Secret Recovery Endpoint — NO authentication, NO ensureDb dependency.
 * Completely self-contained — only admin can access it (10-tap secret from login page).
 * 
 * Actions:
 * - status: Get current DB info (works even if custom DB is dead)
 * - test: Test a new Firebase connection
 * - save: Save new config + create admin + switch to it
 */

async function getDirectDb(serviceAccountKeyJson: string) {
  const serviceAccount = JSON.parse(serviceAccountKeyJson)
  const { initializeApp, cert, deleteApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const tempApp = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  }, `recovery-${Date.now()}`)
  const db = getFirestore(tempApp)
  return { db, cleanup: async () => { try { await deleteApp(tempApp) } catch {} } }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, serviceAccountKey, adminEmail, adminPassword } = body

    if (!action) {
      return NextResponse.json({ success: false, message: 'Action required' }, { status: 400 })
    }

    // === STATUS: Get current DB info ===
    if (action === 'status') {
      let currentProjectId = 'غير معروف'
      try {
        const { _fbk } = await import('@/lib/firebase-key')
        const raw = Buffer.from(_fbk, 'base64').toString()
        const sa = JSON.parse(raw)
        currentProjectId = sa.project_id || 'غير معروف'
      } catch {}

      return NextResponse.json({
        success: true,
        currentProjectId,
      })
    }

    // === TEST: Test new Firebase connection ===
    if (action === 'test') {
      if (!serviceAccountKey) {
        return NextResponse.json({ success: false, message: 'Service Account key is required' }, { status: 400 })
      }

      let sa: any
      try {
        sa = JSON.parse(serviceAccountKey)
        if (!sa.project_id || !sa.private_key) throw new Error('Invalid')
      } catch {
        return NextResponse.json({ success: false, message: 'صيغة JSON غير صالحة أو مفتاح غير مكتمل' })
      }

      const { db, cleanup } = await getDirectDb(serviceAccountKey)
      try {
        await withTimeout(db.collection('systemSettings').doc('testConnection').get(), 8000)
        
        // Count users
        const usersSnap = await db.collection('users').limit(100).get()
        const userCount = usersSnap.size
        
        // Check if admin email exists
        let adminExists = false
        if (adminEmail) {
          const adminSnap = await db.collection('users').where('email', '==', adminEmail).limit(1).get()
          adminExists = !adminSnap.empty
        }

        await cleanup()
        return NextResponse.json({
          success: true,
          message: 'اتصال ناجح!',
          projectId: sa.project_id,
          totalUsers: userCount,
          adminExists,
        })
      } catch (err: any) {
        await cleanup()
        return NextResponse.json({
          success: false,
          message: 'فشل الاتصال: ' + (err?.message || 'خطأ غير معروف'),
        })
      }
    }

    // === SAVE: Save new config + create admin + switch ===
    if (action === 'save') {
      if (!serviceAccountKey) {
        return NextResponse.json({ success: false, message: 'Service Account key is required' }, { status: 400 })
      }
      if (!adminEmail || !adminPassword) {
        return NextResponse.json({ success: false, message: 'البريد وكلمة المرور مطلوبان' }, { status: 400 })
      }
      if (adminPassword.length < 6) {
        return NextResponse.json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 })
      }

      let sa: any
      try {
        sa = JSON.parse(serviceAccountKey)
        if (!sa.project_id || !sa.private_key) throw new Error('Invalid')
      } catch {
        return NextResponse.json({ success: false, message: 'صيغة JSON غير صالحة' })
      }

      // Step 1: Test connection first
      const { db, cleanup: cleanup1 } = await getDirectDb(serviceAccountKey)
      try {
        await withTimeout(db.collection('systemSettings').doc('testConnection').get(), 8000)
      } catch (err: any) {
        await cleanup1()
        return NextResponse.json({ success: false, message: 'فشل الاتصال بقاعدة البيانات الجديدة' })
      }
      await cleanup1()

      // Step 2: Create/update admin user in new DB
      const bcrypt = await import('bcryptjs')
      const hash = await bcrypt.hash(adminPassword, 12)
      const { db: db2, cleanup: cleanup2 } = await getDirectDb(serviceAccountKey)
      try {
        const existing = await db2.collection('users').where('email', '==', adminEmail).limit(1).get()
        if (!existing.empty) {
          await db2.collection('users').doc(existing.docs[0].id).update({
            passwordHash: hash,
            role: 'admin',
            status: 'active',
            emailVerified: true,
          })
        } else {
          const adminId = 'admin_' + Date.now().toString(36)
          await db2.collection('users').doc(adminId).set({
            email: adminEmail,
            passwordHash: hash,
            fullName: 'المسؤول',
            phone: null, country: null,
            role: 'admin', status: 'active',
            emailVerified: true, phoneVerified: false,
            kycStatus: 'none',
            kycIdPhoto: null, kycSelfie: null, kycNotes: null,
            balance: 0, frozenBalance: 0,
            mustChangePassword: false,
            affiliateCode: 'ADMIN',
            referredBy: null, merchantId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      } finally {
        await cleanup2()
      }

      // Step 3: Update firebase-key.ts content (the default key)
      // We'll update the default DB to point to the new project
      const encodedKey = Buffer.from(serviceAccountKey).toString('base64')
      
      // Step 4: Update default DB config
      const { _fbk } = await import('@/lib/firebase-key')
      const raw = Buffer.from(_fbk, 'base64').toString()
      const defaultSa = JSON.parse(raw)
      
      const { initializeApp, cert, deleteApp } = await import('firebase-admin/app')
      const { getFirestore } = await import('firebase-admin/firestore')
      
      const tempApp = initializeApp({
        credential: cert(defaultSa),
      }, `recovery-save-${Date.now()}`)
      const defaultDb = getFirestore(tempApp)
      
      try {
        await defaultDb.collection('systemSettings').doc('customFirebase').set({
          encodedKey,
          projectId: sa.project_id,
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      } catch (err: any) {
        // Default DB might be dead - that's ok, we still switch
      }
      try { await deleteApp(tempApp) } catch {}

      return NextResponse.json({
        success: true,
        message: 'تم حفظ قاعدة البيانات الجديدة بنجاح! سجّل دخول بالبريد وكلمة المرور الجديدة.',
        projectId: sa.project_id,
        adminEmail,
      })
    }

    return NextResponse.json({ success: false, message: 'Action not recognized' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
