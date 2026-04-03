import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

// GET - serve KYC file image from Firestore
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params

    if (!fileName) {
      return NextResponse.json({ success: false, message: 'اسم الملف مطلوب' }, { status: 400 })
    }

    const db = getDb()
    const doc = await db.collection('kycFiles').doc(fileName).get()

    if (!doc.exists) {
      return NextResponse.json({ success: false, message: 'الملف غير موجود' }, { status: 404 })
    }

    const data = doc.data()
    const base64 = data.data
    const mimeType = data.mimeType || 'image/jpeg'

    const buffer = Buffer.from(base64, 'base64')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
