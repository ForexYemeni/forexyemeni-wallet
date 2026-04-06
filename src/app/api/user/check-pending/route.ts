import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'

// Lightweight endpoint: only returns pendingConfirmation field
// Called every 20s by the client to detect new withdrawal confirmations
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
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
