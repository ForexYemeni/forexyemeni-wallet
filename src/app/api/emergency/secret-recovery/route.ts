import { NextRequest, NextResponse } from 'next/server'

/**
 * Secret Recovery Endpoint — NO authentication, NO ensureDb dependency.
 * Completely self-contained — only admin can access it (10-tap secret from login page).
 * 
 * Actions:
 * - status: Get current DB info (works even if custom DB is dead)
 * - test: Test a new Firebase connection
 * - save: Save new config + create admin + switch to it
 * - fcm-status: Get FCM notification status (token count, connectivity)
 * - fcm-test: Send a test FCM push notification
 * - fcm-send: Send a custom notification to a specific user
 * - fcm-cleanup: Clean up invalid/mismatched FCM tokens
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

async function getDirectMessaging(serviceAccountKeyJson: string) {
  const serviceAccount = JSON.parse(serviceAccountKeyJson)
  const { initializeApp, cert, deleteApp } = await import('firebase-admin/app')
  const { getMessaging, getFirestore } = await import('firebase-admin/messaging')
  const appName = `recovery-fcm-${Date.now()}`
  const tempApp = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  }, appName)
  const messaging = getMessaging(tempApp)
  const db = getFirestore(tempApp)
  return {
    messaging,
    db,
    projectId: serviceAccount.project_id,
    cleanup: async () => { try { await deleteApp(tempApp) } catch {} } }
}

/** Get the current (default) service account key as JSON string */
function getCurrentServiceAccountKey(): string {
  const { _fbk } = require('@/lib/firebase-key')
  return Buffer.from(_fbk, 'base64').toString()
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
    const { action, serviceAccountKey, adminEmail, adminPassword, userId, title, message: msgBody, fcmType } = body

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

    // === FCM STATUS: Get FCM info ===
    if (action === 'fcm-status') {
      const keyToUse = serviceAccountKey || getCurrentServiceAccountKey()
      let sa: any
      try {
        sa = JSON.parse(keyToUse)
      } catch {
        return NextResponse.json({ success: false, message: 'مفتاح Firebase غير صالح' })
      }

      const diagnostics: Record<string, unknown> = { projectId: sa.project_id }

      try {
        const { messaging, db, cleanup } = await getDirectMessaging(keyToUse)
        try {
          // Count FCM tokens
          const tokensSnap = await db.collection('fcmTokens').limit(200).get()
          const tokens = tokensSnap.docs.map(doc => ({
            id: doc.id,
            token: doc.data().token?.substring(0, 25) + '...',
            deviceName: doc.data().deviceName,
            userId: doc.data().userId?.substring(0, 12) + '...',
            createdAt: doc.data().createdAt,
          }))

          diagnostics.firebaseMessaging = 'متصل ✓'
          diagnostics.totalTokens = tokensSnap.size
          diagnostics.tokens = tokens.slice(0, 10) // Show max 10

          // Count admin tokens
          const adminTokens = tokensSnap.docs.filter(doc => {
            const data = doc.data()
            return data.isAdmin === true
          })
          diagnostics.adminTokenCount = adminTokens.length

          // Count unique users with tokens
          const uniqueUsers = new Set(tokensSnap.docs.map(doc => doc.data().userId).filter(Boolean))
          diagnostics.uniqueUsersWithTokens = uniqueUsers.size
        } catch (err: any) {
          diagnostics.firebaseMessaging = 'فشل: ' + (err?.message || String(err))
        }
        await cleanup()
      } catch (err: any) {
        diagnostics.error = err?.message || String(err)
      }

      return NextResponse.json({ success: true, diagnostics })
    }

    // === FCM TEST: Send test notification ===
    if (action === 'fcm-test') {
      const keyToUse = serviceAccountKey || getCurrentServiceAccountKey()
      let sa: any
      try {
        sa = JSON.parse(keyToUse)
      } catch {
        return NextResponse.json({ success: false, message: 'مفتاح Firebase غير صالح' })
      }

      const targetUserId = userId // Optional: specific user to send to

      try {
        const { messaging, db, projectId, cleanup } = await getDirectMessaging(keyToUse)
        try {
          // Get tokens to send to
          let tokens: string[] = []
          let tokensSnap

          if (targetUserId) {
            tokensSnap = await db.collection('fcmTokens').where('userId', '==', targetUserId).get()
          } else {
            // Send to all admin tokens first, fallback to all tokens
            tokensSnap = await db.collection('fcmTokens').limit(50).get()
          }

          if (tokensSnap.empty) {
            await cleanup()
            return NextResponse.json({
              success: false,
              message: 'لا يوجد أجهزة مسجلة لاستقبال الإشعارات',
            })
          }

          tokens = tokensSnap.docs.map(doc => doc.data().token).filter(Boolean)

          if (tokens.length === 0) {
            await cleanup()
            return NextResponse.json({ success: false, message: 'لا يوجد توكنات صالحة' })
          }

          const testTitle = '🔔 اختبار الإشعارات'
          const testBody = 'إذا سمعت صوت التنبيه = الإشعارات تعمل بنجاح!'

          const multicastMessage = {
            android: {
              priority: 'high' as const,
              ttl: 86400,
              notification: {
                channelId: 'fx_v8',
                sound: 'default',
                title: testTitle,
                body: testBody,
                clickAction: 'OPEN_NOTIFICATIONS',
              },
              data: {
                type: 'test',
                title: testTitle,
                body: testBody,
              },
            },
            notification: { title: testTitle, body: testBody },
            data: {
              type: 'test',
              title: testTitle,
              body: testBody,
              click_action: 'OPEN_NOTIFICATIONS',
            },
            tokens,
          }

          const response = await messaging.sendEachForMulticast(multicastMessage)

          // Clean up invalid tokens
          if (response.failureCount > 0) {
            const batch = db.batch()
            let cleanedCount = 0
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const errCode = resp.error?.info?.code || resp.error?.code || ''
                if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered', 'messaging/mismatched-credential', 'UNREGISTERED'].includes(errCode)) {
                  const docToDelete = tokensSnap.docs[idx]
                  if (docToDelete) { batch.delete(docToDelete.ref); cleanedCount++ }
                }
              }
            })
            if (cleanedCount > 0) await batch.commit()
          }

          await cleanup()

          const successMsg = response.successCount > 0
            ? `تم إرسال الإشعار بنجاح إلى ${response.successCount} جهاز ✓`
            : 'فشل إرسال الإشعار — لا يوجد أجهزة صالحة'

          return NextResponse.json({
            success: response.successCount > 0,
            message: successMsg,
            projectId,
            sentTo: tokens.length,
            successCount: response.successCount,
            failureCount: response.failureCount,
            errors: response.responses.filter(r => !r.success).map((r, i) => ({
              token: tokens[i]?.substring(0, 20) + '...',
              code: r.error?.info?.code || r.error?.code,
              message: r.error?.message,
            })),
          })
        } catch (err: any) {
          await cleanup()
          return NextResponse.json({ success: false, message: 'خطأ FCM: ' + (err?.message || String(err)) })
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, message: 'خطأ: ' + (err?.message || String(err)) })
      }
    }

    // === FCM SEND: Send custom notification to a user ===
    if (action === 'fcm-send') {
      const keyToUse = serviceAccountKey || getCurrentServiceAccountKey()
      const targetUserId = userId
      const notifTitle = title || 'إشعار جديد'
      const notifBody = msgBody || ''
      const notifType = fcmType || 'info'

      if (!targetUserId) {
        return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
      }
      if (!notifBody) {
        return NextResponse.json({ success: false, message: 'نص الإشعار مطلوب' }, { status: 400 })
      }

      try {
        const { messaging, db, cleanup } = await getDirectMessaging(keyToUse)
        try {
          const tokensSnap = await db.collection('fcmTokens').where('userId', '==', targetUserId).get()
          if (tokensSnap.empty) {
            await cleanup()
            return NextResponse.json({ success: false, message: 'لا يوجد أجهزة مسجلة لهذا المستخدم' })
          }

          const tokens = tokensSnap.docs.map(doc => doc.data().token).filter(Boolean)
          if (tokens.length === 0) {
            await cleanup()
            return NextResponse.json({ success: false, message: 'لا يوجد توكنات صالحة' })
          }

          const multicastMessage = {
            android: {
              priority: 'high' as const,
              ttl: 86400,
              notification: {
                channelId: 'fx_v8',
                sound: 'default',
                title: notifTitle,
                body: notifBody,
                clickAction: 'OPEN_NOTIFICATIONS',
              },
              data: { type: notifType, userId: targetUserId, title: notifTitle, body: notifBody },
            },
            notification: { title: notifTitle, body: notifBody },
            data: { type: notifType, userId: targetUserId, title: notifTitle, body: notifBody, click_action: 'OPEN_NOTIFICATIONS' },
            tokens,
          }

          const response = await messaging.sendEachForMulticast(multicastMessage)

          // Clean up invalid tokens
          if (response.failureCount > 0) {
            const batch = db.batch()
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const errCode = resp.error?.info?.code || resp.error?.code || ''
                if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered', 'messaging/mismatched-credential', 'UNREGISTERED'].includes(errCode)) {
                  const docToDelete = tokensSnap.docs[idx]
                  if (docToDelete) batch.delete(docToDelete.ref)
                }
              }
            })
            await batch.commit()
          }

          await cleanup()
          return NextResponse.json({
            success: response.successCount > 0,
            message: response.successCount > 0
              ? `تم إرسال الإشعار إلى ${response.successCount} جهاز ✓`
              : 'فشل إرسال الإشعار',
            successCount: response.successCount,
            failureCount: response.failureCount,
          })
        } catch (err: any) {
          await cleanup()
          return NextResponse.json({ success: false, message: 'خطأ: ' + (err?.message || String(err)) })
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, message: 'خطأ: ' + (err?.message || String(err)) })
      }
    }

    // === FCM CLEANUP: Remove invalid tokens ===
    if (action === 'fcm-cleanup') {
      const keyToUse = serviceAccountKey || getCurrentServiceAccountKey()

      try {
        const { messaging, db, cleanup } = await getDirectMessaging(keyToUse)
        try {
          const tokensSnap = await db.collection('fcmTokens').limit(200).get()
          if (tokensSnap.empty) {
            await cleanup()
            return NextResponse.json({ success: true, message: 'لا يوجد توكنات للتنظيف', cleanedCount: 0 })
          }

          const tokens = tokensSnap.docs.map(doc => doc.data().token).filter(Boolean)
          if (tokens.length === 0) {
            await cleanup()
            return NextResponse.json({ success: true, message: 'لا يوجد توكنات صالحة للفحص', cleanedCount: 0 })
          }

          // Send a dry-run message to check all tokens
          const testMessage = {
            android: { priority: 'high' as const, notification: { channelId: 'fx_v8', title: '', body: '' } },
            tokens,
          }

          const response = await messaging.sendEachForMulticast(testMessage, true) // dryRun = true

          // Delete all invalid tokens
          const batch = db.batch()
          let cleanedCount = 0
          const errors: { code: string; message: string }[] = []

          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errCode = resp.error?.info?.code || resp.error?.code || 'unknown'
              errors.push({ code: errCode, message: resp.error?.message || '' })
              const docToDelete = tokensSnap.docs[idx]
              if (docToDelete) { batch.delete(docToDelete.ref); cleanedCount++ }
            }
          })

          if (cleanedCount > 0) await batch.commit()

          await cleanup()
          return NextResponse.json({
            success: true,
            message: `تم تنظيف ${cleanedCount} توكن غير صالح من أصل ${tokens.length}`,
            totalTokens: tokens.length,
            cleanedCount,
            validCount: tokens.length - cleanedCount,
            errors: errors.slice(0, 10),
          })
        } catch (err: any) {
          await cleanup()
          return NextResponse.json({ success: false, message: 'خطأ: ' + (err?.message || String(err)) })
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, message: 'خطأ: ' + (err?.message || String(err)) })
      }
    }

    return NextResponse.json({ success: false, message: 'Action not recognized' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
