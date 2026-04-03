import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'kyc')
    await mkdir(uploadDir, { recursive: true })

    const fileName = `${userId}_${type}_${Date.now()}.${file.name.split('.').pop()}`
    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    const fileUrl = `/uploads/kyc/${fileName}`

    await db.kYCRecord.create({
      data: {
        userId,
        type,
        fileUrl,
        status: 'pending',
      },
    })

    if (type === 'id_photo') {
      await db.user.update({
        where: { id: userId },
        data: { kycIdPhoto: fileUrl },
      })
    } else if (type === 'selfie') {
      await db.user.update({
        where: { id: userId },
        data: { kycSelfie: fileUrl },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'تم رفع الملف بنجاح',
      fileUrl,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في رفع الملف'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
