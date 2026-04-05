import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'

// POST - Verify admin phone number for account recovery
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminNumber } = body

    if (!adminNumber) {
      return NextResponse.json({ success: false, message: 'رقم الهاتف مطلوب' }, { status: 400 })
    }

    // Find admin by phone number
    // We need to query users where role=admin and phone=adminNumber
    const { getDb } = await import('@/lib/firebase')
    const db = getDb()
    
    const snapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .where('phone', '==', adminNumber)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ 
        success: false, 
        message: 'رقم الإدارة غير صحيح. تأكد من الرقم المسجل في حساب الإدارة.' 
      }, { status: 404 })
    }

    const adminDoc = snapshot.docs[0]
    const adminData = adminDoc.data()

    return NextResponse.json({
      success: true,
      message: 'تم التحقق من الرقم',
      adminId: adminDoc.id,
      hasPIN: !!adminData.pinHash,
      adminEmail: adminData.email,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
