import { NextRequest, NextResponse } from 'next/server'
import { transactionOperations, userOperations } from '@/lib/db-firebase'
import { generateAccountNumber } from '@/lib/firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    if (!verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const transactions = await transactionOperations.findMany(userId)

    // Also return latest user balance + accountNumber + kycStatus for real-time updates
    let balance: number | string | null = null
    let accountNumber: number | string | null = null
    let frozenBalance: number | string | null = null
    let kycStatus: string | null = null
    try {
      const userData = await userOperations.findUnique({ id: userId })
      if (userData) {
        balance = userData.balance ?? 0
        frozenBalance = userData.frozenBalance ?? 0
        accountNumber = userData.accountNumber || null
        kycStatus = userData.kycStatus || 'none'

        // Auto-generate account number if missing
        if (!userData.accountNumber) {
          try {
            const newAccountNumber = await generateAccountNumber()
            await userOperations.update({ id: userId }, { accountNumber: newAccountNumber })
            accountNumber = newAccountNumber
          } catch {
            // Non-critical: continue even if generation fails
          }
        }
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      transactions,
      balance,
      accountNumber,
      frozenBalance,
      kycStatus,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
