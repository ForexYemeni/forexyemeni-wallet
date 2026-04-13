import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId } from '@/lib/firebase'
import { authenticateRequest } from '@/lib/auth-server'

// POST - upload KYC file (stores as base64 in Firestore kycFiles collection)
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await authenticateRequest(request)
    if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const userId = auth.user.id

    const formData = await request.formData()
    const type = formData.get('type') as string // 'id_front' | 'id_back'
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'الملف مطلوب' }, { status: 400 })
    }

    if (!type || !['id_front', 'id_back', 'id_photo'].includes(type)) {
      return NextResponse.json({ success: false, message: 'نوع الملف غير صحيح' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: 'حجم الملف كبير جداً (الحد الأقصى 10MB)' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'نوع الملف غير مدعوم (PNG, JPG, WebP فقط)' }, { status: 400 })
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Generate unique file name
    const fileName = generateId()

    // Store in Firestore kycFiles collection
    const db = getDb()
    await db.collection('kycFiles').doc(fileName).set({
      userId,
      type,
      mimeType: file.type,
      data: base64,
      createdAt: new Date().toISOString(),
    })

    // Create KYC record
    const fileUrl = `/api/kyc/file/${fileName}`
    await db.collection('kycRecords').add({
      userId,
      type,
      fileUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })

    // Update user KYC status to 'pending' if not already approved
    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists) {
      const userData = userDoc.data()
      if (userData.kycStatus !== 'approved' && userData.kycStatus !== 'pending') {
        await db.collection('users').doc(userId).update({ kycStatus: 'pending' })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم رفع الملف بنجاح',
      fileName,
      fileUrl,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في رفع الملف'
    console.error('[KYC Upload Error]', error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
