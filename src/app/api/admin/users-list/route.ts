import { NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'

// GET - List all non-admin users for admin to pick for chat
export async function GET() {
  try {
    const users = await userOperations.findMany({ take: 500 })
    // Filter to non-admin users only
    const filtered = users.filter(u => u.role !== 'admin').map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
    }))

    return NextResponse.json({ success: true, users: filtered })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
