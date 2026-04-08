import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// POST /api/fcm/register - Register FCM device token
// Body: { userId, fcmToken, deviceName? }
export async function POST(request: NextRequest) {
  try {
    const { userId, fcmToken, deviceName } = await request.json()

    if (!userId || !fcmToken) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    const db = getDb()

    console.log(`[FCM/register] Registering token for user ${userId}, device=${deviceName || 'unknown'}`)

    // Check if token already exists for this user
    const existingTokens = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .where('token', '==', fcmToken)
      .get()

    if (existingTokens.empty) {
      // Remove old tokens if user has too many (keep latest 3)
      const oldTokens = await db.collection('fcmTokens')
        .where('userId', '==', userId)
        .get()

      if (oldTokens.size >= 3) {
        const batch = db.batch()
        const sorted = oldTokens.docs.sort((a, b) => {
          const aTime = a.data().createdAt || ''
          const bTime = b.data().createdAt || ''
          return aTime.localeCompare(bTime)
        })
        const toDelete = sorted.slice(0, oldTokens.size - 2)
        for (const doc of toDelete) {
          batch.delete(doc.ref)
        }
        if (toDelete.length > 0) {
          await batch.commit()
          console.log(`[FCM/register] Cleaned up ${toDelete.length} old token(s) for user ${userId}`)
        }
      }

      // Add new token
      await db.collection('fcmTokens').add({
        userId,
        token: fcmToken,
        deviceName: deviceName || 'Android',
        platform: 'android',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      console.log(`[FCM/register] New token saved for user ${userId} (total: ${oldTokens.size + 1})`)
    } else {
      // Update existing token timestamp
      await existingTokens.docs[0].ref.update({
        updatedAt: new Date().toISOString(),
        deviceName: deviceName || 'Android',
      })
      console.log(`[FCM/register] Existing token updated for user ${userId}`)
    }

    return NextResponse.json({ success: true, message: 'تم تسجيل الجهاز بنجاح' })
  } catch (error: unknown) {
    console.error('[FCM/register] Error:', error)
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// DELETE /api/fcm/register - Remove FCM token (on logout)
export async function DELETE(request: NextRequest) {
  try {
    const { userId, fcmToken } = await request.json()

    if (!userId || !fcmToken) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    console.log(`[FCM/register] Removing token for user ${userId}`)

    const db = getDb()
    const tokens = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .where('token', '==', fcmToken)
      .get()

    const batch = db.batch()
    for (const doc of tokens.docs) {
      batch.delete(doc.ref)
    }
    if (tokens.size > 0) {
      await batch.commit()
      console.log(`[FCM/register] Removed ${tokens.size} token(s) for user ${userId}`)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[FCM/register] Delete error:', error)
    return NextResponse.json({ success: true })
  }
}
