import { NextRequest, NextResponse } from 'next/server'
import { paymentMethodOperations } from '@/lib/db-firebase'

// GET all payment methods (admin)
export async function GET() {
  try {
    const methods = await paymentMethodOperations.findMany()
    return NextResponse.json({ success: true, methods })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST create/update/delete payment method (admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, id, ...data } = body

    if (action === 'delete') {
      if (!id) return NextResponse.json({ success: false, message: 'المعرف مطلوب' }, { status: 400 })
      await paymentMethodOperations.delete(id)
      return NextResponse.json({ success: true, message: 'تم حذف طريقة الدفع' })
    }

    if (action === 'update') {
      if (!id) return NextResponse.json({ success: false, message: 'المعرف مطلوب' }, { status: 400 })
      await paymentMethodOperations.update(id, data)
      return NextResponse.json({ success: true, message: 'تم تحديث طريقة الدفع' })
    }

    // action === 'create' or default
    await paymentMethodOperations.create({
      name: data.name || '',
      type: data.type || 'bank_transfer',
      category: data.category || 'bank',
      isActive: data.isActive !== false,
      network: data.network || null,
      walletAddress: data.walletAddress || null,
      accountName: data.accountName || null,
      accountNumber: data.accountNumber || null,
      beneficiaryName: data.beneficiaryName || null,
      phone: data.phone || null,
      recipientName: data.recipientName || null,
      recipientPhone: data.recipientPhone || null,
      minAmount: data.minAmount || null,
      maxAmount: data.maxAmount || null,
      instructions: data.instructions || null,
    })

    return NextResponse.json({ success: true, message: 'تم إضافة طريقة الدفع' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
