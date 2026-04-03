import { NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const results: Record<string, unknown> = {}

    // 1. Test Firebase connection
    try {
      const { getDb } = await import('@/lib/firebase')
      const db = getDb()
      results.firebase_connection = '✅ متصل'
      results.project_id = process.env.FIREBASE_SERVICE_ACCOUNT ? 'موجود' : 'غير موجود'
    } catch (e: unknown) {
      results.firebase_connection = '❌ خطأ: ' + (e instanceof Error ? e.message : String(e))
    }

    // 2. Check admin user
    try {
      const admin = await userOperations.findUnique({ email: 'mshay2024m@gmail.com' })
      if (admin) {
        results.admin_found = true
        results.admin_id = admin.id
        results.admin_role = admin.role
        results.admin_email = admin.email

        // 3. Test password
        const isValid = await bcrypt.compare('admin123admin123admin123', admin.passwordHash)
        results.password_valid = isValid
      } else {
        results.admin_found = false
      }
    } catch (e: unknown) {
      results.admin_check_error = (e instanceof Error ? e.message : String(e))
    }

    // 4. Count all users
    try {
      const users = await userOperations.findMany({ orderBy: 'createdAt', take: 100 })
      results.total_users = users.length
      results.users = users.map(u => ({ id: u.id, email: u.email, role: u.role }))
    } catch (e: unknown) {
      results.users_error = (e instanceof Error ? e.message : String(e))
    }

    return NextResponse.json(results)
  } catch (error: unknown) {
    return NextResponse.json({
      error: true,
      message: error instanceof Error ? error.message : 'خطأ غير معروف',
    }, { status: 500 })
  }
}
