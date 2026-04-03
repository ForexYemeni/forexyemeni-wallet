import { NextResponse } from 'next/server'
import { paymentMethodOperations } from '@/lib/db-firebase'

// GET active payment methods (user-facing)
export async function GET() {
  try {
    const methods = await paymentMethodOperations.findActive()
    return NextResponse.json({ success: true, methods })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
