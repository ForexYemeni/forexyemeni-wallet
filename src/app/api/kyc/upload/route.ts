import { NextRequest, NextResponse } from 'next/server'
import { userOperations, kycRecordOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { sendAdminNewKycEmail } from '@/lib/email'
import { getDb } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const userId = formData.get('userId') as string
    const type = formData.get('type') as string
    const file = formData.get('file') as File

    if (!userId || !type || !file) {
      return NextResponse.json(
        { success: false, message: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    if (!['id_photo', 'selfie'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'نوع الملف غير صحيح' },
        { status: 400 }
      )
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // Convert file to base64 for Firestore storage
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const fileUrl = `data:${file.type};base64,${base64.substring(0, 50)}...`

    // For Vercel, we store a reference. In production, you'd use Firebase Storage or Cloudinary
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}_${type}_${Date.now()}.${fileExt}`
    // Store the base64 data in Firestore (for demo - in production use Firebase Storage)
    const storageUrl = `/api/kyc/file/${fileName}`

    await kycRecordOperations.create({
      userId,
      type,
      fileUrl: storageUrl,
      status: 'pending',
    })

    // Store the actual file data in a separate collection for retrieval
    const db = getDb()
    await db.collection('kycFiles').doc(fileName).set({
      userId,
      type,
      fileName,
      mimeType: file.type,
      data: base64,
      createdAt: new Date().toISOString(),
    })

    if (type === 'id_photo') {
      await userOperations.update({ id: userId }, { kycIdPhoto: storageUrl })
    } else if (type === 'selfie') {
      await userOperations.update({ id: userId }, { kycSelfie: storageUrl })
    }

    // Notify admin(s) about new KYC upload
    try {
      const adminDocs = await db.collection('users').where('role', '==', 'admin').get()
      for (const adminDoc of adminDocs.docs) {
        const admin = adminDoc.data() as any
        const adminId = adminDoc.id
        const typeLabel = type === 'id_photo' ? 'صورة الهوية' : 'الصورة الشخصية'
        const title = 'طلب توثيق جديد'
        const message = `${typeLabel} جديدة من ${user.fullName || user.email}`
        await notificationOperations.create({ userId: adminId, title, message, type: 'info' })
        sendPushNotification(adminId, title, message, 'info').catch(() => {})

        // Send email to admin
        sendAdminNewKycEmail(
          admin.email,
          user.fullName || user.email,
          user.email,
          type,
          userId
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'تم رفع الملف بنجاح',
      fileUrl: storageUrl,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في رفع الملف'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
