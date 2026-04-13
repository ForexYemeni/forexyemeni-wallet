import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import { authenticateRequest } from '@/lib/auth-server'

// GET - fetch fresh user profile data (used to sync client state after admin actions)
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const user = await userOperations.findUnique({ id: auth.user.id })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        kycStatus: user.kycStatus,
        balance: user.balance,
        frozenBalance: user.frozenBalance,
        mustChangePassword: user.mustChangePassword,
        hasPin: !!user.pinHash,
        twoFactorEnabled: user.twoFactorEnabled || false,
        createdAt: user.createdAt,
        merchantId: user.merchantId || null,
        affiliateCode: user.affiliateCode || null,
        accountNumber: user.accountNumber || null,
        permissions: user.permissions || null,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
