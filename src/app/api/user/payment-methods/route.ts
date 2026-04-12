import { NextRequest, NextResponse } from 'next/server'
import { userPaymentMethodOperations } from '@/lib/db-firebase'
import { authenticateRequest, verifyUserId } from '@/lib/auth-server'

// GET - Get user's payment methods
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    const methods = await userPaymentMethodOperations.findByUserId(userId)
    return NextResponse.json({ success: true, methods })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST - Create, update, delete user payment method
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const { action, id, userId, ...data } = body

    if (!userId || !verifyUserId(auth, userId)) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ success: false, message: 'المعرف مطلوب' }, { status: 400 })
      await userPaymentMethodOperations.delete(id)
      return NextResponse.json({ success: true, message: 'تم حذف طريقة الدفع' })
    }

    if (action === 'update') {
      if (!id) return NextResponse.json({ success: false, message: 'المعرف مطلوب' }, { status: 400 })
      await userPaymentMethodOperations.update(id, data)
      return NextResponse.json({ success: true, message: 'تم تحديث طريقة الدفع' })
    }

    // action === 'create' or default
    await userPaymentMethodOperations.create({
      userId,
      name: data.name || '',
      type: data.type || 'bank_transfer',
      category: data.category || 'bank',
      currency: data.currency || null,
      isActive: true,
      network: data.network || null,
      walletAddress: data.walletAddress || null,
      accountName: data.accountName || null,
      accountNumber: data.accountNumber || null,
      beneficiaryName: data.beneficiaryName || null,
      phone: data.phone || null,
      recipientName: data.recipientName || null,
      recipientPhone: data.recipientPhone || null,
    })

    return NextResponse.json({ success: true, message: 'تم إضافة طريقة الدفع بنجاح' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
