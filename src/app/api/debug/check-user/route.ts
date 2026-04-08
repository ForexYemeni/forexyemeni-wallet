import { NextRequest, NextResponse } from 'next/server'

// TEMPORARY DEBUG ENDPOINT
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 })
  }

  try {
    const { userOperations } = await import('@/lib/db-firebase')
    const user = await userOperations.findUnique({ email })
    if (!user) {
      return NextResponse.json({ error: 'User not found', email })
    }

    return NextResponse.json({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      mustChangePassword: user.mustChangePassword,
      hasPasswordHash: !!user.passwordHash,
      passwordHashLength: user.passwordHash?.length || 0,
      twoFactorEnabled: user.twoFactorEnabled || false,
      hasTempPin: !!user.tempPinHash,
      accountNumber: user.accountNumber,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt,
    })
  } catch (error: any) {
    console.error('[DEBUG CHECK-USER ERROR]', error?.message, error?.stack?.substring(0, 500))
    return NextResponse.json({ error: error.message, stack: error?.stack?.substring(0, 500) }, { status: 500 })
  }
}
