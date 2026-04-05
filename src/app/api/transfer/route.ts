import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, nowTimestamp } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { senderId, receiver, amount, token, pin } = body

    if (!senderId || !receiver || !amount || !pin) {
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

    // --- Find receiver by: email OR phone OR accountNumber ---
    const receiverInput = receiver.trim().toLowerCase()
    let receiverDoc_snap: FirebaseFirestore.QueryDocumentSnapshot | null = null

    // Try 1: Account Number (FX-XXXX) — exact match
    if (/^fx-\d+$/i.test(receiverInput)) {
      const snap = await db.collection('users')
        .where('accountNumber', '==', receiverInput.toUpperCase())
        .limit(1)
        .get()
      if (!snap.empty) receiverDoc_snap = snap.docs[0]
    }

    // Try 2: Email
    if (!receiverDoc_snap && receiverInput.includes('@')) {
      const snap = await db.collection('users')
        .where('email', '==', receiverInput)
        .limit(1)
        .get()
      if (!snap.empty) receiverDoc_snap = snap.docs[0]
    }

    // Try 3: Phone number (strip +, spaces, dashes)
    if (!receiverDoc_snap) {
      const cleanPhone = receiverInput.replace(/[\s\-\+]/g, '')
      const snap = await db.collection('users')
        .where('phone', '==', cleanPhone)
        .limit(1)
        .get()
      if (!snap.empty) receiverDoc_snap = snap.docs[0]
    }

    if (!receiverDoc_snap) {
      return NextResponse.json({
        success: false,
        message: 'المستلم غير موجود. تأكد من البريد الإلكتروني أو رقم الهاتف أو رقم الحساب (FX-XXXX)',
      }, { status: 404 })
    }

    const receiverId = receiverDoc_snap.id
    const receiverData = receiverDoc_snap.data()

    // Check sender is not transferring to themselves
    if (receiverId === senderId) {
      return NextResponse.json({ success: false, message: 'لا يمكنك التحويل لنفسك' }, { status: 400 })
    }

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

    const receiverLabel = receiverData.fullName || receiverData.email

    // Create sender transaction record
    const senderTxId = generateId()
    batch.set(db.collection('transactions').doc(senderTxId), {
      id: senderTxId,
      userId: senderId,
      type: 'transfer_out',
      amount: -transferAmount,
      balanceBefore: senderBalance,
      balanceAfter: newSenderBalance,
      description: `تحويل إلى ${receiverLabel}${receiverData.accountNumber ? ` (${receiverData.accountNumber})` : ''}`,
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
      description: `تحويل وارد من ${senderData.fullName || senderData.email}${senderData.accountNumber ? ` (${senderData.accountNumber})` : ''}`,
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
