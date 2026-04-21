import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'
import { userOperations } from '@/lib/db-firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

// List and remove FCM tokens (devices) for the logged-in user
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId, action, tokenId } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const db = getDb()

    if (action === 'list') {
      // List all FCM tokens for this user
      const snapshot = await db.collection('fcmTokens')
        .where('userId', '==', userId)
        .get()

      const devices = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          token: data.token || '',
          deviceName: data.deviceName || 'جهاز غير معروف',
          platform: data.platform || 'unknown',
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || '',
        }
      })

      return NextResponse.json({ success: true, devices })
    }

    if (action === 'remove') {
      if (!tokenId) {
        return NextResponse.json({ success: false, message: 'معرف الجهاز مطلوب' }, { status: 400 })
      }

      // Verify the token belongs to this user
      const tokenDoc = await db.collection('fcmTokens').doc(tokenId).get()
      if (!tokenDoc.exists || tokenDoc.data()?.userId !== userId) {
        return NextResponse.json({ success: false, message: 'الجهاز غير موجود أو لا ينتمي لحسابك' }, { status: 403 })
      }

      await db.collection('fcmTokens').doc(tokenId).delete()
      return NextResponse.json({ success: true, message: 'تم إزالة الجهاز بنجاح' })
    }

    if (action === 'remove-others') {
      // Remove all tokens EXCEPT the current one (keeps the device making the request)
      const currentToken = request.headers.get('x-fcm-token')

      const snapshot = await db.collection('fcmTokens')
        .where('userId', '==', userId)
        .get()

      let removedCount = 0
      const batch = db.batch()
      for (const doc of snapshot.docs) {
        // Keep the current device's token
        if (currentToken && doc.data().token === currentToken) continue
        batch.delete(doc.ref)
        removedCount++
      }

      if (removedCount > 0) {
        await batch.commit()
      }

      return NextResponse.json({ success: true, message: `تم إزالة ${removedCount} جهاز`, removedCount })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    console.error('[user-devices] Error:', error)
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 })
  }
}
