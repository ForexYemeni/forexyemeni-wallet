import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'
import { authenticateRequest } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId, pin } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    if (!pin) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (!user.pinHash) {
      return NextResponse.json({ success: false, message: 'لم يتم إعداد رمز PIN', hasPin: false }, { status: 400 })
    }

    const isValid = await bcrypt.compare(pin, user.pinHash)
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' }, { status: 401 })
    }

    return NextResponse.json({ success: true, message: 'تم التحقق بنجاح' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

function verifyUserId(auth: { success: true; user: { id: string } }, requestedUserId: string): boolean {
  return auth.user.id === requestedUserId
}
