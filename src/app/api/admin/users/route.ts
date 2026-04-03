import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all users (admin)
export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        country: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        kycStatus: true,
        balance: true,
        frozenBalance: true,
        createdAt: true,
      },
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
    const { userId, status, role, balance, kycStatus, notes } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (role) updateData.role = role
    if (typeof balance === 'number') updateData.balance = balance
    if (kycStatus) updateData.kycStatus = kycStatus
    if (notes) updateData.kycNotes = notes

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
    })

    return NextResponse.json({ success: true, user })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
