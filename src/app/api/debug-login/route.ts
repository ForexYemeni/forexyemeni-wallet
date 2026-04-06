import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import { getDb } from '@/lib/firebase'

// Diagnostic endpoint - helps identify login issues
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      // Check maintenance mode status
      const db = getDb()
      const globalDoc = await db.collection('systemSettings').doc('global').get()
      const maintenanceDoc = await db.collection('systemSettings').doc('maintenance').get()
      
      return NextResponse.json({
        success: true,
        diagnostics: {
          globalSettingsExists: globalDoc.exists,
          globalSettingsData: globalDoc.exists ? globalDoc.data() : null,
          maintenanceDocExists: maintenanceDoc.exists,
          maintenanceDocData: maintenanceDoc.exists ? maintenanceDoc.data() : null,
          timestamp: new Date().toISOString(),
        }
      })
    }

    // Check specific user
    const user = await userOperations.findUnique({ email: email.trim() })
    if (!user) {
      // Try lowercase too
      const userLower = await userOperations.findUnique({ email: email.trim().toLowerCase() })
      return NextResponse.json({
        success: true,
        diagnostics: {
          userFound: false,
          userFoundLowercase: !!userLower,
          searchedEmail: email.trim(),
          searchedEmailLowercase: email.trim().toLowerCase(),
          timestamp: new Date().toISOString(),
        }
      })
    }

    return NextResponse.json({
      success: true,
      diagnostics: {
        userFound: true,
        userId: user.id,
        email: user.email,
        emailCase: user.email === email.trim() ? 'MATCH' : 'CASE_MISMATCH',
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        hasPasswordHash: !!user.passwordHash,
        passwordHashPrefix: user.passwordHash ? user.passwordHash.substring(0, 10) : null,
        passwordHashLength: user.passwordHash ? user.passwordHash.length : 0,
        mustChangePassword: user.mustChangePassword,
        twoFactorEnabled: user.twoFactorEnabled,
        hasPinHash: !!user.pinHash,
        accountNumber: user.accountNumber,
        createdAt: user.createdAt,
        timestamp: new Date().toISOString(),
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, message, diagnostics: { error: message } }, { status: 500 })
  }
}
