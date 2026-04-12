import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

// Lightweight endpoint: only returns pendingConfirmation field
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      pendingConfirmation: user.pendingConfirmation || null,
    })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 })
  }
}
