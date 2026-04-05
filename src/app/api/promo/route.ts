import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, nowTimestamp } from '@/lib/firebase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const db = getDb()

    // Check user exists
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Fetch active promos
    const snapshot = await db.collection('promos')
      .where('isActive', '==', true)
      .limit(50)
      .get()

    const now = new Date()
    const promos = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((promo: any) => {
        if (promo.expiresAt && new Date(promo.expiresAt) < now) return false
        if (promo.maxUses && promo.usedCount >= promo.maxUses) return false
        return true
      })
      .map((promo: any) => ({
        id: promo.id,
        code: promo.code,
        type: promo.type,
        value: promo.value,
        description: promo.description || '',
        expiresAt: promo.expiresAt || null,
        maxUses: promo.maxUses || null,
        usedCount: promo.usedCount || 0,
      }))

    return NextResponse.json({ success: true, promos })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    const db = getDb()

    // === ADMIN: CREATE PROMO ===
    if (action === 'create') {
      const { adminId, code, type, value, maxUses, expiresAt, description } = body

      if (!adminId) {
        return NextResponse.json({ success: false, message: 'معرف المسؤول مطلوب' }, { status: 400 })
      }

      // Verify admin
      const adminDoc = await db.collection('users').doc(adminId).get()
      if (!adminDoc.exists || (adminDoc.data()?.role !== 'admin' && !(adminDoc.data()?.permissions && Object.values(adminDoc.data().permissions).some((v: boolean) => v)))) {
        return NextResponse.json({ success: false, message: 'ليس لديك صلاحية' }, { status: 403 })
      }

      if (!code || !type || !value) {
        return NextResponse.json({ success: false, message: 'الكود والنوع والقيمة مطلوبون' }, { status: 400 })
      }

      const upperCode = code.toUpperCase().trim()

      // Check if code already exists
      const existingCode = await db.collection('promos')
        .where('code', '==', upperCode)
        .limit(1)
        .get()

      if (!existingCode.empty) {
        return NextResponse.json({ success: false, message: 'هذا الكود موجود بالفعل' }, { status: 400 })
      }

      const id = generateId()
      const now = nowTimestamp()
      const promo = {
        id,
        code: upperCode,
        type, // 'fixed' or 'percentage'
        value: parseFloat(value),
        maxUses: maxUses ? parseInt(maxUses) : null,
        usedCount: 0,
        totalRewarded: 0,
        expiresAt: expiresAt || null,
        description: description || '',
        isActive: true,
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
      }

      await db.collection('promos').doc(id).set(promo)

      return NextResponse.json({ success: true, promo })
    }

    // === ADMIN: DELETE PROMO ===
    if (action === 'delete') {
      const { adminId, promoId } = body

      if (!adminId || !promoId) {
        return NextResponse.json({ success: false, message: 'معرف المسؤول والكود مطلوبان' }, { status: 400 })
      }

      // Verify admin
      const adminDoc = await db.collection('users').doc(adminId).get()
      if (!adminDoc.exists || (adminDoc.data()?.role !== 'admin' && !(adminDoc.data()?.permissions && Object.values(adminDoc.data().permissions).some((v: boolean) => v)))) {
        return NextResponse.json({ success: false, message: 'ليس لديك صلاحية' }, { status: 403 })
      }

      await db.collection('promos').doc(promoId).delete()
      return NextResponse.json({ success: true, message: 'تم حذف الكود الترويجي' })
    }

    // === ADMIN: LIST ALL PROMOS ===
    if (action === 'list_all') {
      const { adminId } = body

      if (!adminId) {
        return NextResponse.json({ success: false, message: 'معرف المسؤول مطلوب' }, { status: 400 })
      }

      // Verify admin
      const adminDoc = await db.collection('users').doc(adminId).get()
      if (!adminDoc.exists || (adminDoc.data()?.role !== 'admin' && !(adminDoc.data()?.permissions && Object.values(adminDoc.data().permissions).some((v: boolean) => v)))) {
        return NextResponse.json({ success: false, message: 'ليس لديك صلاحية' }, { status: 403 })
      }

      const snapshot = await db.collection('promos').limit(100).get()
      const promos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      promos.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return NextResponse.json({ success: true, promos })
    }

    // === USER: REDEEM PROMO ===
    if (action === 'redeem') {
      const { userId, code } = body

      if (!userId || !code) {
        return NextResponse.json({ success: false, message: 'معرف المستخدم والكود مطلوبان' }, { status: 400 })
      }

      // Fetch user
      const userDoc = await db.collection('users').doc(userId).get()
      if (!userDoc.exists) {
        return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
      }
      const userData = userDoc.data()

      if (userData.role === 'admin') {
        return NextResponse.json({ success: false, message: 'المدير لا يمكنه استخدام الأكواد الترويجية' }, { status: 403 })
      }

      if (userData.status !== 'active') {
        return NextResponse.json({ success: false, message: 'حسابك غير مفعّل' }, { status: 403 })
      }

      // Find promo code
      const promoSnapshot = await db.collection('promos')
        .where('code', '==', code.toUpperCase().trim())
        .limit(1)
        .get()

      if (promoSnapshot.empty) {
        return NextResponse.json({ success: false, message: 'الكود الترويجي غير صالح' }, { status: 404 })
      }

      const promoDoc = promoSnapshot.docs[0]
      const promoData = promoDoc.data()

      // Check promo is active
      if (!promoData.isActive) {
        return NextResponse.json({ success: false, message: 'هذا الكود غير مفعّل' }, { status: 400 })
      }

      // Check not expired
      if (promoData.expiresAt && new Date(promoData.expiresAt) < new Date()) {
        return NextResponse.json({ success: false, message: 'هذا الكود منتهي الصلاحية' }, { status: 400 })
      }

      // Check max uses
      if (promoData.maxUses && promoData.usedCount >= promoData.maxUses) {
        return NextResponse.json({ success: false, message: 'تم استخدام هذا الكود الحد الأقصى من المرات' }, { status: 400 })
      }

      // Check user hasn't already used it
      const usageSnapshot = await db.collection('promoUsages')
        .where('userId', '==', userId)
        .where('promoId', '==', promoDoc.id)
        .limit(1)
        .get()

      if (!usageSnapshot.empty) {
        return NextResponse.json({ success: false, message: 'لقد استخدمت هذا الكود بالفعل' }, { status: 400 })
      }

      // Calculate reward
      const currentBalance = userData.balance || 0
      let reward = 0
      if (promoData.type === 'fixed') {
        reward = promoData.value
      } else if (promoData.type === 'percentage') {
        reward = (promoData.value / 100) * currentBalance
      }

      if (reward <= 0) {
        return NextResponse.json({ success: false, message: 'المكافأة تساوي صفر. رصيدك الحالي غير كافي للنسبة المئوية.' }, { status: 400 })
      }

      const now = nowTimestamp()
      const newBalance = currentBalance + reward

      // Use batch for atomic operations
      const batch = db.batch()

      // Update user balance
      batch.update(db.collection('users').doc(userId), {
        balance: newBalance,
        updatedAt: now,
      })

      // Update promo usage count
      batch.update(db.collection('promos').doc(promoDoc.id), {
        usedCount: (promoData.usedCount || 0) + 1,
        totalRewarded: (promoData.totalRewarded || 0) + reward,
        updatedAt: now,
      })

      // Record usage
      const usageId = generateId()
      batch.set(db.collection('promoUsages').doc(usageId), {
        id: usageId,
        userId,
        promoId: promoDoc.id,
        code: promoData.code,
        reward,
        createdAt: now,
      })

      // Create transaction
      const txId = generateId()
      batch.set(db.collection('transactions').doc(txId), {
        id: txId,
        userId,
        type: 'bonus',
        amount: reward,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `مكافأة من الكود الترويجي: ${promoData.code}`,
        referenceId: promoDoc.id,
        createdAt: now,
      })

      // Create notification
      const notifId = generateId()
      batch.set(db.collection('notifications').doc(notifId), {
        id: notifId,
        userId,
        title: 'مكافأة ترويجية',
        message: `لقد حصلت على ${reward.toFixed(2)} USDT من الكود الترويجي ${promoData.code}`,
        type: 'bonus',
        read: false,
        createdAt: now,
      })

      await batch.commit()

      return NextResponse.json({
        success: true,
        message: `تم تطبيق الكود بنجاح! حصلت على ${reward.toFixed(2)} USDT`,
        reward,
        newBalance,
      })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
