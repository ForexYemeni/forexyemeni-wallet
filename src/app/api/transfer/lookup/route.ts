import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { receiver, senderId } = await request.json()

    if (!receiver || !senderId) {
      return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
    }

    const db = getDb()
    const receiverInput = receiver.trim()
    let found: { id: string; fullName: string | null; email: string; phone: string | null; accountNumber: number | null } | null = null

    // Try 1: Account Number (numeric)
    if (/^\d{4,10}$/.test(receiverInput)) {
      const snap = await db.collection('users')
        .where('accountNumber', '==', parseInt(receiverInput, 10))
        .limit(1)
        .get()
      if (!snap.empty) {
        const d = snap.docs[0].data()
        found = { id: snap.docs[0].id, fullName: d.fullName, email: d.email, phone: d.phone, accountNumber: d.accountNumber }
      }
    }

    // Try 2: Email
    if (!found && receiverInput.includes('@')) {
      const snap = await db.collection('users')
        .where('email', '==', receiverInput.toLowerCase())
        .limit(1)
        .get()
      if (!snap.empty) {
        const d = snap.docs[0].data()
        found = { id: snap.docs[0].id, fullName: d.fullName, email: d.email, phone: d.phone, accountNumber: d.accountNumber }
      }
    }

    // Try 3: Phone — supports with/without country code
    if (!found) {
      const cleanPhone = receiverInput.replace(/[\s\-\+]/g, '')
      const phoneVariants = new Set<string>([cleanPhone])
      if (cleanPhone.startsWith('0')) {
        phoneVariants.add('967' + cleanPhone.slice(1))
      }
      if (/^\d{9}$/.test(cleanPhone)) {
        phoneVariants.add('967' + cleanPhone)
      }
      if (cleanPhone.startsWith('967')) {
        phoneVariants.add('0' + cleanPhone.slice(3))
      }
      for (const variant of phoneVariants) {
        const snap = await db.collection('users')
          .where('phone', '==', variant)
          .limit(1)
          .get()
        if (!snap.empty) {
          const d = snap.docs[0].data()
          found = { id: snap.docs[0].id, fullName: d.fullName, email: d.email, phone: d.phone, accountNumber: d.accountNumber }
          break
        }
      }
    }

    if (!found) {
      return NextResponse.json({ success: false, message: 'المستلم غير موجود. تأكد من البيانات المدخلة' }, { status: 404 })
    }

    // Cannot transfer to yourself
    if (found.id === senderId) {
      return NextResponse.json({ success: false, message: 'لا يمكنك التحويل لنفسك' }, { status: 400 })
    }

    // Check receiver is active and not admin
    if (found.status !== 'active') {
      return NextResponse.json({ success: false, message: 'حساب المستلم غير مفعّل' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      receiver: {
        id: found.id,
        fullName: found.fullName || null,
        email: found.email,
        phone: found.phone || null,
        accountNumber: found.accountNumber || null,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
