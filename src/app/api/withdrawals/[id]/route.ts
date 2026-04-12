import { NextRequest, NextResponse } from 'next/server'
import { withdrawalOperations } from '@/lib/db-firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

// User-facing endpoint: fetch withdrawal details by ID
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { userId, withdrawalId } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    if (!withdrawalId) {
      return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    // Fetch all withdrawals for the user and find the matching one
    const withdrawals = await withdrawalOperations.findMany()
    const withdrawal = withdrawals.find(w => w.id === withdrawalId && w.userId === userId)

    if (!withdrawal) {
      return NextResponse.json({ success: false, message: 'السحب غير موجود' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        fee: withdrawal.fee || 0,
        netAmount: withdrawal.netAmount || withdrawal.amount - (withdrawal.fee || 0),
        method: withdrawal.method,
        toAddress: withdrawal.toAddress,
        network: withdrawal.network,
        status: withdrawal.status,
        screenshot: withdrawal.screenshot || null,
        walletAddress: withdrawal.toAddress,
        walletName: withdrawal.paymentMethodName || withdrawal.method,
        createdAt: withdrawal.createdAt,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
