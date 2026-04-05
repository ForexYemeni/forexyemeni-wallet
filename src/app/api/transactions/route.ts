import { NextRequest, NextResponse } from 'next/server'
import { transactionOperations, userOperations } from '@/lib/db-firebase'
import { generateAccountNumber } from '@/lib/firebase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    const transactions = await transactionOperations.findMany(userId)

    // Also return latest user balance + accountNumber for real-time updates
    let balance = null
    let accountNumber = null
    let frozenBalance = null
    try {
      const userData = await userOperations.findUnique({ id: userId })
      if (userData) {
        balance = userData.balance ?? 0
        frozenBalance = userData.frozenBalance ?? 0
        accountNumber = userData.accountNumber || null

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
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
