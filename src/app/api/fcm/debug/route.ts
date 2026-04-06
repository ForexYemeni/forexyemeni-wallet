import { NextRequest, NextResponse } from 'next/server'
import { getDb, initializeFirebase } from '@/lib/firebase'
import { getMessaging } from 'firebase-admin/messaging'

/**
 * Debug endpoint to diagnose why push notifications aren't working.
 * Call: GET /api/fcm/debug?userId=XXX
 * 
 * Checks:
 * 1. Does the user have FCM tokens registered?
 * 2. Is Firebase Admin SDK initialized properly?
 * 3. Can we send a test FCM message?
 * 4. What does FCM respond with?
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 })
    }

    const diagnostics: Record<string, unknown> = {}

    // 1. Check FCM tokens for this user
    try {
      const db = getDb()
      const tokensSnapshot = await db.collection('fcmTokens')
        .where('userId', '==', userId)
        .get()

      const tokens = tokensSnapshot.docs.map(doc => ({
        id: doc.id,
        token: doc.data().token?.substring(0, 20) + '...',
        deviceName: doc.data().deviceName,
        platform: doc.data().platform,
        createdAt: doc.data().createdAt,
        updatedAt: doc.data().updatedAt,
      }))

      diagnostics.fcmTokens = {
        count: tokensSnapshot.size,
        tokens,
      }
    } catch (err: unknown) {
      diagnostics.fcmTokensError = err instanceof Error ? err.message : String(err)
    }

    // 2. Check Firebase Admin SDK
    try {
      const { app } = initializeFirebase()
      const messaging = getMessaging(app)
      diagnostics.firebaseAdmin = 'OK - Messaging initialized'
      diagnostics.projectId = app.options.projectId || 'unknown'

      // 3. If user has tokens, try sending a test message
      const db = getDb()
      const tokensSnapshot = await db.collection('fcmTokens')
        .where('userId', '==', userId)
        .get()

      if (!tokensSnapshot.empty) {
        const realTokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean)

        if (realTokens.length > 0) {
          const testMessage = {
            android: {
              priority: 'high' as const,
              notification: {
                channelId: 'fx_v8',
                sound: 'default',
                title: '🔔 اختبار FCM',
                body: 'إذا رأيت هذا الإشعار = الإشعارات تعمل!',
                clickAction: 'OPEN_NOTIFICATIONS',
              },
              data: {
                type: 'test',
                userId,
                title: '🔔 اختبار FCM',
                body: 'إذا رأيت هذا الإشعار = الإشعارات تعمل!',
              },
            },
            notification: {
              title: '🔔 اختبار FCM',
              body: 'إذا رأيت هذا الإشعار = الإشعارات تعمل!',
            },
            data: {
              type: 'test',
              userId,
              title: '🔔 اختبار FCM',
              body: 'إذا رأيت هذا الإشعار = الإشعارات تعمل!',
              click_action: 'OPEN_NOTIFICATIONS',
            },
            tokens: realTokens,
          }

          const response = await messaging.sendEachForMulticast(testMessage)
          diagnostics.testSend = {
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses.map((resp, idx) => ({
              success: resp.success,
              error: resp.success ? null : {
                code: resp.error?.info?.code,
                message: resp.error?.message,
              },
              tokenId: realTokens[idx]?.substring(0, 20) + '...',
            })),
          }
        } else {
          diagnostics.testSend = 'No valid tokens found'
        }
      } else {
        diagnostics.testSend = 'SKIPPED - No FCM tokens registered for this user'
      }
    } catch (err: unknown) {
      diagnostics.firebaseAdminError = err instanceof Error ? err.message : String(err)
    }

    // 4. Check environment
    diagnostics.env = {
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set',
    }

    return NextResponse.json({ success: true, diagnostics })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
