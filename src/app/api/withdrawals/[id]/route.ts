import { NextRequest, NextResponse } from 'next/server'
import { withdrawalOperations } from '@/lib/db-firebase'

// User-facing endpoint: fetch withdrawal details by ID
// Used by the confirmation dialog to display withdrawal info
export async function POST(request: NextRequest) {
  try {
    const { userId, withdrawalId } = await request.json()

    if (!userId || !withdrawalId) {
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
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 })
  }
}
