import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    const transactions = await db.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      success: true,
      transactions,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
