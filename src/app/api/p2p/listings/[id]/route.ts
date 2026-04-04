import { NextRequest, NextResponse } from 'next/server'
import { userOperations, merchantOperations, p2pListingOperations } from '@/lib/db-firebase'

// GET: get single listing
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const listing = await p2pListingOperations.findUnique(id)
    if (!listing) return NextResponse.json({ success: false, message: 'الإعلان غير موجود' }, { status: 404 })

    const merchant = await merchantOperations.findUnique(listing.merchantId)
    const user = merchant ? await userOperations.findUnique({ id: merchant.userId }) : null

    return NextResponse.json({
      success: true,
      listing: {
        ...listing,
        merchantName: merchant?.fullName || user?.fullName || 'تاجر',
        merchantPhone: merchant?.phone || user?.phone || null,
      },
    })
  } catch (error: any) {
    console.error('[Listing Detail GET]', error)
    return NextResponse.json({ success: false, message: 'خطأ' }, { status: 500 })
  }
}

// POST: update listing (pause, activate, edit)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 })

    const { id } = await params
    const { action, amount, price, minAmount, maxAmount, paymentMethods, network } = await req.json()

    const listing = await p2pListingOperations.findUnique(id)
    if (!listing) return NextResponse.json({ success: false, message: 'الإعلان غير موجود' }, { status: 404 })

    // Verify ownership
    const merchant = await merchantOperations.findUnique(listing.merchantId)
    if (!merchant || merchant.userId !== userId) {
      return NextResponse.json({ success: false, message: 'غير مصرح بتعديل هذا الإعلان' }, { status: 403 })
    }

    if (action === 'pause') {
      await p2pListingOperations.pause(id)
      return NextResponse.json({ success: true, message: 'تم إيقاف الإعلان' })
    }
    if (action === 'activate') {
      await p2pListingOperations.activate(id)
      return NextResponse.json({ success: true, message: 'تم تفعيل الإعلان' })
    }
    if (action === 'edit') {
      const updateData: any = {}
      if (amount !== undefined) updateData.amount = amount
      if (price !== undefined) updateData.price = price
      if (minAmount !== undefined) updateData.minAmount = minAmount
      if (maxAmount !== undefined) updateData.maxAmount = maxAmount
      if (paymentMethods) updateData.paymentMethods = paymentMethods
      if (network) updateData.network = network
      const updated = await p2pListingOperations.update(id, updateData)
      return NextResponse.json({ success: true, listing: updated })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير صالح' }, { status: 400 })
  } catch (error: any) {
    console.error('[Listing Detail POST]', error)
    return NextResponse.json({ success: false, message: 'خطأ في تحديث الإعلان' }, { status: 500 })
  }
}

// DELETE: delete listing
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 })

    const { id } = await params
    const listing = await p2pListingOperations.findUnique(id)
    if (!listing) return NextResponse.json({ success: false, message: 'الإعلان غير موجود' }, { status: 404 })

    const merchant = await merchantOperations.findUnique(listing.merchantId)
    if (!merchant || merchant.userId !== userId) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    await p2pListingOperations.delete(id)
    return NextResponse.json({ success: true, message: 'تم حذف الإعلان' })
  } catch (error: any) {
    console.error('[Listing DELETE]', error)
    return NextResponse.json({ success: false, message: 'خطأ في حذف الإعلان' }, { status: 500 })
  }
}
