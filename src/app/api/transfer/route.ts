import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, nowTimestamp } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { senderId, receiverEmail, amount, token, pin } = body

    if (!senderId || !receiverEmail || !amount || !pin) {
      return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    const transferAmount = parseFloat(amount)
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json({ success: false, message: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 })
    }

    const db = getDb()

    // Fetch sender
    const senderDoc = await db.collection('users').doc(senderId).get()
    if (!senderDoc.exists) {
      return NextResponse.json({ success: false, message: 'المرسل غير موجود' }, { status: 404 })
    }

    const senderData = senderDoc.data()

    // Check sender is not admin
    if (senderData.role === 'admin') {
      return NextResponse.json({ success: false, message: 'المدير لا يمكنه إجراء تحويلات' }, { status: 403 })
    }

    // Check sender status
    if (senderData.status !== 'active') {
      return NextResponse.json({ success: false, message: 'حسابك غير مفعّل' }, { status: 403 })
    }

    // Verify PIN using bcrypt (same method used in set-pin)
    const pinHash = senderData.pinHash
    if (!pinHash) {
      return NextResponse.json({ success: false, message: 'لم يتم إعداد رمز PIN. يرجى إعداده أولاً' }, { status: 400 })
    }

    const isPinValid = await bcrypt.compare(pin, pinHash)
    if (!isPinValid) {
      return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' }, { status: 401 })
    }

    // Check sender has enough balance
    const senderBalance = senderData.balance || 0
    if (senderBalance < transferAmount) {
      return NextResponse.json({ success: false, message: 'رصيدك غير كافي' }, { status: 400 })
    }

    // Check sender is not transferring to themselves
    if (senderData.email.toLowerCase() === receiverEmail.toLowerCase()) {
      return NextResponse.json({ success: false, message: 'لا يمكنك التحويل لنفسك' }, { status: 400 })
    }

    // Find receiver by email
    const receiverSnapshot = await db.collection('users')
      .where('email', '==', receiverEmail.toLowerCase().trim())
      .limit(1)
      .get()

    if (receiverSnapshot.empty) {
      return NextResponse.json({ success: false, message: 'المستلم غير موجود. تأكد من عنوان البريد الإلكتروني' }, { status: 404 })
    }

    const receiverDoc = receiverSnapshot.docs[0]
    const receiverId = receiverDoc.id
    const receiverData = receiverDoc.data()

    // Check receiver is active and not admin
    if (receiverData.status !== 'active') {
      return NextResponse.json({ success: false, message: 'حساب المستلم غير مفعّل' }, { status: 400 })
    }

    if (receiverData.role === 'admin') {
      return NextResponse.json({ success: false, message: 'لا يمكن التحويل إلى حساب إداري' }, { status: 400 })
    }

    const receiverBalance = receiverData.balance || 0
    const newSenderBalance = senderBalance - transferAmount
    const newReceiverBalance = receiverBalance + transferAmount
    const now = nowTimestamp()

    // Use Firestore batch for atomic updates
    const batch = db.batch()

    // Update sender balance
    batch.update(db.collection('users').doc(senderId), {
      balance: newSenderBalance,
      updatedAt: now,
    })

    // Update receiver balance
    batch.update(db.collection('users').doc(receiverId), {
      balance: newReceiverBalance,
      updatedAt: now,
    })

    // Create sender transaction record
    const senderTxId = generateId()
    batch.set(db.collection('transactions').doc(senderTxId), {
      id: senderTxId,
      userId: senderId,
      type: 'transfer_out',
      amount: -transferAmount,
      balanceBefore: senderBalance,
      balanceAfter: newSenderBalance,
      description: `تحويل إلى ${receiverData.fullName || receiverData.email}`,
      referenceId: senderTxId,
      createdAt: now,
    })

    // Create receiver transaction record
    const receiverTxId = generateId()
    batch.set(db.collection('transactions').doc(receiverTxId), {
      id: receiverTxId,
      userId: receiverId,
      type: 'transfer_in',
      amount: transferAmount,
      balanceBefore: receiverBalance,
      balanceAfter: newReceiverBalance,
      description: `تحويل وارد من ${senderData.fullName || senderData.email}`,
      referenceId: senderTxId,
      createdAt: now,
    })

    // Commit batch
    await batch.commit()

    // Create notification for receiver
    const notifId = generateId()
    await db.collection('notifications').doc(notifId).set({
      id: notifId,
      userId: receiverId,
      title: 'تحويل وارد',
      message: `لقد استلمت ${transferAmount.toFixed(2)} USDT من ${senderData.fullName || senderData.email}`,
      type: 'transfer',
      read: false,
      createdAt: now,
    })

    return NextResponse.json({
      success: true,
      message: 'تم التحويل بنجاح',
      senderBalance: newSenderBalance,
      receiverBalance: newReceiverBalance,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء التحويل'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
