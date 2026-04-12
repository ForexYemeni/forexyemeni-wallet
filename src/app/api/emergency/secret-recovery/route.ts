import { NextRequest, NextResponse } from 'next/server'

/**
 * Secret Recovery Endpoint — Requires Recovery PIN verification.
 * Self-contained — only admin can access it (10-tap secret from login page + PIN).
 * 
 * SECURITY: All actions require a valid recovery PIN to be verified first.
 * 
 * Actions:
 * - verify-pin: Verify the recovery PIN (returns a session token)
 * - status: Get current DB info (requires valid session token)
 * - test: Test a new Firebase connection (requires valid session token)
 * - save: Save new config + create admin + switch to it (requires valid session token)
 * - fcm-status: Get FCM notification status (requires valid session token)
 * - fcm-test: Send a test FCM push notification (requires valid session token)
 * - fcm-send: Send a custom notification to a specific user (requires valid session token)
 * - fcm-cleanup: Clean up invalid/mismatched FCM tokens (requires valid session token)
 */

// Rate limiting — max 5 attempts per minute
const attemptLog: { ip: string; timestamp: number; success: boolean }[] = []
const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW = 60 * 1000 // 1 minute

// Active session tokens (PIN verified within last 10 minutes)
const activeSessions = new Map<string, number>() // token -> expiry timestamp
const SESSION_DURATION = 10 * 60 * 1000 // 10 minutes

function cleanupOldEntries() {
  const now = Date.now()
  // Clean attempts
  while (attemptLog.length > 0 && now - attemptLog[0].timestamp > ATTEMPT_WINDOW) {
    attemptLog.shift()
  }
  // Clean sessions
  for (const [token, expiry] of activeSessions.entries()) {
    if (now > expiry) activeSessions.delete(token)
  }
}

function checkRateLimit(ip: string): boolean {
  cleanupOldEntries()
  const recentAttempts = attemptLog.filter(a => a.ip === ip && !a.success)
  return recentAttempts.length < MAX_ATTEMPTS
}

function recordAttempt(ip: string, success: boolean) {
  cleanupOldEntries()
  attemptLog.push({ ip, timestamp: Date.now(), success })
}

function verifySession(token: string): boolean {
  cleanupOldEntries()
  const expiry = activeSessions.get(token)
  if (!expiry) return false
  if (Date.now() > expiry) {
    activeSessions.delete(token)
    return false
  }
  return true
}

async function verifyPinLocally(pin: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs')
  
  // Try to read stored PIN from default DB
  try {
    const { _fbk } = await import('@/lib/firebase-key')
    if (!_fbk) return false
    
    let serviceAccount: any
    try {
      const raw = Buffer.from(_fbk, 'base64').toString()
      serviceAccount = JSON.parse(raw)
    } catch {
      try { serviceAccount = JSON.parse(_fbk) } catch { return false }
    }
    
    const { initializeApp, cert, deleteApp } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    
    const tempApp = initializeApp({
      credential: cert(serviceAccount),
    }, `pin-verify-${Date.now()}`)
    const db = getFirestore(tempApp)
    
    try {
      const doc = await db.collection('systemSettings').doc('recoveryPin').get()
      if (doc.exists && doc.data()?.pinHash) {
        const isMatch = await bcrypt.compare(pin, doc.data().pinHash)
        if (isMatch) return true
      }
    } finally {
      try { await deleteApp(tempApp) } catch {}
    }
  } catch {
    // DB unreachable — check env var fallback
  }
  
  // Check env var fallback
  const envPin = process.env.RECOVERY_DEFAULT_PIN || '202477'
  if (envPin && pin === envPin) return true
  
  return false
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown'
}

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, pin, sessionToken, serviceAccountKey, adminEmail, adminPassword, userId, title, message: msgBody, fcmType, googleServicesJson } = body
    const clientIp = getClientIp(request)

    if (!action) {
      return NextResponse.json({ success: false, message: 'Action required' }, { status: 400 })
    }

    // === VERIFY-PIN: Verify recovery PIN and return session token ===
    if (action === 'verify-pin') {
      if (!pin || pin.length < 4) {
        return NextResponse.json({ success: false, message: 'رمز PIN مطلوب' }, { status: 400 })
      }

      // Rate limiting
      if (!checkRateLimit(clientIp)) {
        return NextResponse.json({ 
          success: false, 
          message: 'عدد المحاولات كثير. انتظر دقيقة ثم حاول مرة أخرى.' 
        }, { status: 429 })
      }

      const isValid = await verifyPinLocally(pin)
      
      if (!isValid) {
        recordAttempt(clientIp, false)
        return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' }, { status: 403 })
      }

      recordAttempt(clientIp, true)
      
      // Generate session token
      const token = 'rp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2)
      activeSessions.set(token, Date.now() + SESSION_DURATION)
      
      return NextResponse.json({ success: true, sessionToken: token })
    }

    // === ALL OTHER ACTIONS: Require valid session token ===
    if (!sessionToken || !verifySession(sessionToken)) {
      return NextResponse.json({ 
        success: false, 
        message: 'جلسة غير صالحة أو منتهية الصلاحية. يرجى التحقق من رمز PIN مرة أخرى.' 
      }, { status: 401 })
    }

    // === STATUS: Get current DB info ===
    if (action === 'status') {
      let currentProjectId = 'غير معروف'
      try {
        const { _fbk } = await import('@/lib/firebase-key')
        if (_fbk) {
          let sa: any
          try {
            const raw = Buffer.from(_fbk, 'base64').toString()
            sa = JSON.parse(raw)
          } catch {
            sa = JSON.parse(_fbk)
          }
          currentProjectId = sa.project_id || 'غير معروف'
        }
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
        
        const usersSnap = await db.collection('users').limit(100).get()
        const userCount = usersSnap.size
        
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
      if (!googleServicesJson) {
        return NextResponse.json({ success: false, message: 'ملف google-services.json مطلوب للإشعارات الصوتية' }, { status: 400 })
      }

      let gsjParsed: any
      try {
        gsjParsed = JSON.parse(googleServicesJson)
        if (!gsjParsed.project_info?.project_id) throw new Error('missing project_id')
        if (!gsjParsed.client?.length) throw new Error('missing client')
        const pkg = gsjParsed.client[0]?.client_info?.android_client_info?.package_name
        if (pkg !== 'com.forexyemeni.wallet') {
          return NextResponse.json({ success: false, message: `حزمة التطبيق غير مطابقة: ${pkg}` }, { status: 400 })
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, message: 'ملف google-services.json غير صالح: ' + (err?.message || '') }, { status: 400 })
      }

      let sa: any
      try {
        sa = JSON.parse(serviceAccountKey)
        if (!sa.project_id || !sa.private_key) throw new Error('Invalid')
      } catch {
        return NextResponse.json({ success: false, message: 'صيغة JSON غير صالحة' })
      }

      if (sa.project_id !== gsjParsed.project_info.project_id) {
        return NextResponse.json({
          success: false,
          message: `معرف المشروع غير مطابق! Service Account: ${sa.project_id} ≠ Google Services: ${gsjParsed.project_info.project_id}`
        }, { status: 400 })
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

      // Step 3: Update default DB config
      const encodedKey = Buffer.from(serviceAccountKey).toString('base64')
      
      try {
        const { _fbk } = await import('@/lib/firebase-key')
        if (_fbk) {
          let defaultSa: any
          try {
            const raw = Buffer.from(_fbk, 'base64').toString()
            defaultSa = JSON.parse(raw)
          } catch {
            defaultSa = JSON.parse(_fbk)
          }
          
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
              googleServicesJson: googleServicesJson || null,
              updatedAt: new Date().toISOString(),
            }, { merge: true })
          } catch (err: any) {
            // Default DB might be dead - that's ok
          }
          try { await deleteApp(tempApp) } catch {}
        }
      } catch {}

      // Step 4: Update google-services.json file
      try {
        const fs = await import('fs')
        const path = await import('path')
        const gsjPath = path.join(process.cwd(), 'android', 'app', 'google-services.json')
        const formatted = JSON.stringify(JSON.parse(googleServicesJson), null, 4)
        fs.writeFileSync(gsjPath, formatted, 'utf-8')
        console.log(`[Recovery] Updated google-services.json at ${gsjPath}`)
      } catch (err: any) {
        console.error('[Recovery] Failed to update google-services.json:', err?.message)
      }

      return NextResponse.json({
        success: true,
        message: 'تم حفظ قاعدة البيانات والملف الجديد بنجاح!',
        projectId: sa.project_id,
        adminEmail,
      })
    }

    // === FCM STATUS ===
    if (action === 'fcm-status') {
      try {
        const { _fbk } = await import('@/lib/firebase-key')
        if (!_fbk) {
          return NextResponse.json({ success: false, message: 'Firebase not configured' })
        }
        const keyToUse = _fbk
        let sa: any
        try {
          const raw = Buffer.from(keyToUse, 'base64').toString()
          sa = JSON.parse(raw)
        } catch {
          sa = JSON.parse(keyToUse)
        }

        const diagnostics: Record<string, unknown> = { projectId: sa.project_id }

        try {
          const { messaging, db, cleanup } = await getDirectMessaging(keyToUse)
          try {
            const tokensSnap = await db.collection('fcmTokens').limit(200).get()
            const tokens = tokensSnap.docs.map(doc => ({
              id: doc.id,
              token: doc.data().token?.substring(0, 25) + '...',
              deviceName: doc.data().deviceName,
              userId: doc.data().userId?.substring(0, 12) + '...',
              createdAt: doc.data().createdAt,
            }))

            diagnostics.firebaseMessaging = 'متصل'
            diagnostics.totalTokens = tokensSnap.size
            diagnostics.tokens = tokens.slice(0, 10)

            const adminTokens = tokensSnap.docs.filter(doc => doc.data().isAdmin === true)
            diagnostics.adminTokenCount = adminTokens.length

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
      } catch (err: any) {
        return NextResponse.json({ success: false, message: 'خطأ: ' + (err?.message || String(err)) })
      }
    }

    // === FCM TEST ===
    if (action === 'fcm-test') {
      try {
        const { _fbk } = await import('@/lib/firebase-key')
        if (!_fbk) {
          return NextResponse.json({ success: false, message: 'Firebase not configured' })
        }
        const keyToUse = _fbk

        try {
          const { messaging, db, projectId, cleanup } = await getDirectMessaging(keyToUse)
          try {
            let tokens: string[] = []
            let tokensSnap

            if (userId) {
              tokensSnap = await db.collection('fcmTokens').where('userId', '==', userId).get()
            } else {
              tokensSnap = await db.collection('fcmTokens').limit(50).get()
            }

            if (tokensSnap.empty) {
              await cleanup()
              return NextResponse.json({ success: false, message: 'لا يوجد أجهزة مسجلة لاستقبال الإشعارات' })
            }

            tokens = tokensSnap.docs.map(doc => doc.data().token).filter(Boolean)

            if (tokens.length === 0) {
              await cleanup()
              return NextResponse.json({ success: false, message: 'لا يوجد توكنات صالحة' })
            }

            const testTitle = 'اختبار الإشعارات'
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
                data: { type: 'test', title: testTitle, body: testBody },
              },
              notification: { title: testTitle, body: testBody },
              data: { type: 'test', title: testTitle, body: testBody, click_action: 'OPEN_NOTIFICATIONS' },
              tokens,
            }

            const response = await messaging.sendEachForMulticast(multicastMessage)

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
              ? `تم إرسال الإشعار بنجاح إلى ${response.successCount} جهاز`
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
      } catch (err: any) {
        return NextResponse.json({ success: false, message: 'خطأ: ' + (err?.message || String(err)) })
      }
    }

    // === FCM SEND ===
    if (action === 'fcm-send') {
      try {
        const { _fbk } = await import('@/lib/firebase-key')
        if (!_fbk) {
          return NextResponse.json({ success: false, message: 'Firebase not configured' })
        }
        const keyToUse = _fbk
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
                ? `تم إرسال الإشعار إلى ${response.successCount} جهاز`
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
      } catch (err: any) {
        return NextResponse.json({ success: false, message: 'خطأ: ' + (err?.message || String(err)) })
      }
    }

    // === FCM CLEANUP ===
    if (action === 'fcm-cleanup') {
      try {
        const { _fbk } = await import('@/lib/firebase-key')
        if (!_fbk) {
          return NextResponse.json({ success: false, message: 'Firebase not configured' })
        }
        const keyToUse = _fbk

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

            const testMessage = {
              android: { priority: 'high' as const, notification: { channelId: 'fx_v8', title: '', body: '' } },
              tokens,
            }

            const response = await messaging.sendEachForMulticast(testMessage, true)

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
