import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'

// GET all users (admin)
export async function GET() {
  try {
    const users = await userOperations.findMany({
      take: 200,
    })

    return NextResponse.json({ success: true, users })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST update user (admin)
export async function POST(request: NextRequest) {
  try {
    const { userId, status, role, balance, balanceAdjustment, kycStatus, notes, permissions, merchantId } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (role) updateData.role = role
    if (typeof balance === 'number') updateData.balance = balance
    if (typeof balanceAdjustment === 'number' && balanceAdjustment !== 0) {
      const targetUser = await userOperations.findUnique({ id: userId })
      if (!targetUser) {
        return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
      }
      const newBalance = Math.max(0, (targetUser.balance || 0) + balanceAdjustment)
      updateData.balance = newBalance
    }
    if (kycStatus) updateData.kycStatus = kycStatus
    if (notes !== undefined) updateData.kycNotes = notes
    if (permissions) updateData.permissions = JSON.stringify(permissions)
    if (merchantId !== undefined) updateData.merchantId = merchantId

    const user = await userOperations.update({ id: userId }, updateData)

    return NextResponse.json({ success: true, user })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
