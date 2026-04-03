import { NextResponse } from 'next/server'
import { seedDatabase } from '@/lib/db-firebase'

export async function POST() {
  try {
    await seedDatabase()
    return NextResponse.json({
      success: true,
      message: 'تم تهيئة قاعدة البيانات بنجاح. تم إنشاء حساب المدير.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ في تهيئة قاعدة البيانات'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
