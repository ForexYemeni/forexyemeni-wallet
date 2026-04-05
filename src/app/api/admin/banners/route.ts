import { NextResponse } from 'next/server'
import { getDb, generateId, nowTimestamp } from '@/lib/firebase'

// GET - List all banners (public endpoint - no auth needed)
export async function GET() {
  try {
    const db = getDb()
    const snapshot = await db
      .collection('banners')
      .orderBy('order', 'asc')
      .get()

    const banners = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({ success: true, banners })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST - Create or update a banner (admin only)
export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const { userId, title, description, imageUrl, link, active, existingBannerId, swapOrder } = body

    // Verify admin role
    if (!userId) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Update existing banner (toggle active / reorder)
    if (existingBannerId) {
      const bannerDoc = await db.collection('banners').doc(existingBannerId).get()
      if (!bannerDoc.exists) {
        return NextResponse.json({ success: false, message: 'البانر غير موجود' }, { status: 404 })
      }

      const existingData = bannerDoc.data()!
      const updates: Record<string, unknown> = {}

      if (active !== undefined) {
        updates.active = active
      }

      // Swap order with another banner
      if (swapOrder !== undefined) {
        const currentOrder = existingData.order || 0
        updates.order = swapOrder

        // Find the banner at the target order and swap
        const targetSnap = await db.collection('banners')
          .where('order', '==', swapOrder)
          .get()
        if (!targetSnap.empty) {
          const targetDoc = targetSnap.docs[0]
          if (targetDoc.id !== existingBannerId) {
            await targetDoc.ref.update({ order: currentOrder })
          }
        }
      }

      await bannerDoc.ref.update(updates)

      return NextResponse.json({ success: true, message: 'تم تحديث البانر بنجاح' })
    }

    // Create new banner
    if (!title?.trim() || !imageUrl?.trim()) {
      return NextResponse.json({ success: false, message: 'العنوان والصورة مطلوبان' }, { status: 400 })
    }

    // Determine order (place at the end)
    const existingSnap = await db.collection('banners').orderBy('order', 'desc').limit(1).get()
    let order = 0
    if (!existingSnap.empty) {
      order = (existingSnap.docs[0].data().order || 0) + 1
    }

    const bannerId = generateId()
    const banner = {
      id: bannerId,
      title: title.trim(),
      description: description?.trim() || '',
      imageUrl: imageUrl.trim(),
      link: link?.trim() || '',
      active: active !== undefined ? active : true,
      order,
      createdAt: nowTimestamp(),
    }

    await db.collection('banners').doc(bannerId).set(banner)

    return NextResponse.json({ success: true, message: 'تم إنشاء البانر بنجاح', banner })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// DELETE - Delete a banner by ID (admin only)
export async function DELETE(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const bannerId = searchParams.get('id')
    const userId = searchParams.get('userId')

    // Verify admin role
    if (!userId || !bannerId) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Check banner exists
    const bannerDoc = await db.collection('banners').doc(bannerId).get()
    if (!bannerDoc.exists) {
      return NextResponse.json({ success: false, message: 'البانر غير موجود' }, { status: 404 })
    }

    await db.collection('banners').doc(bannerId).delete()

    return NextResponse.json({ success: true, message: 'تم حذف البانر بنجاح' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
