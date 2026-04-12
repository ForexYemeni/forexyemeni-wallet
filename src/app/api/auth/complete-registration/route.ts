import { NextRequest, NextResponse } from 'next/server'
import { otpCodeOperations } from '@/lib/db-firebase'
import { sendVerificationEmail } from '@/lib/email'
import { getDb, generateAffiliateCode, generateAccountNumber, checkAndApplyCustomFirebase } from '@/lib/firebase'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, password, pin, otpId } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'البيانات مطلوبة' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' },
        { status: 400 }
      )
    }

    if (!pin || pin.length < 6) {
      return NextResponse.json(
        { success: false, message: 'رمز PIN مكون من 6 أرقام على الأقل' },
        { status: 400 }
      )
    }

    await checkAndApplyCustomFirebase()
    const db = getDb()

    // Step 1: Find pending registration
    const pendingSnap = await db.collection('pendingRegistrations').where('email', '==', email).limit(1).get()
    if (pendingSnap.empty) {
      return NextResponse.json(
        { success: false, message: 'الطلب غير موجود. يرجى التسجيل من جديد.' },
        { status: 404 }
      )
    }

    const pendingDoc = pendingSnap.docs[0]
    const pendingData = pendingDoc.data()

    // Step 2: Generate account number
    let accountNumber: number
    try {
      accountNumber = await generateAccountNumber()
    } catch (err: any) {
      console.error('[COMPLETE-REG] accountNumber failed:', err.code || err.message)
      return NextResponse.json(
        { success: false, message: 'خطأ في إنشاء رقم الحساب. يرجى المحاولة لاحقاً.' },
        { status: 503 }
      )
    }

    // Step 3: Create the actual user in users collection
    const passwordHash = await bcrypt.hash(password, 12)
    const pinHash = await bcrypt.hash(pin, 12)

    const userId = db.collection('users').doc().id
    await db.collection('users').doc(userId).set({
      email,
      passwordHash,
      pinHash,
      fullName: fullName || null,
      phone: null,
      country: null,
      role: 'user',
      status: 'active',
      emailVerified: true,
      phoneVerified: false,
      kycStatus: 'none',
      kycIdPhoto: null,
      kycSelfie: null,
      kycNotes: null,
      balance: 0,
      frozenBalance: 0,
      mustChangePassword: false,
      hasPin: true,
      referredBy: null,
      merchantId: null,
      affiliateCode: generateAffiliateCode(),
      accountNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Step 4: Delete the pending registration
    await db.collection('pendingRegistrations').doc(pendingDoc.id).delete()

    // Step 5: Generate login token
    const token = crypto.randomUUID()
    await otpCodeOperations.create({
      userId,
      email,
      code: token,
      type: 'login',
      verified: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: userId,
        email,
        fullName: fullName || null,
        phone: null,
        role: 'user',
        status: 'active',
        emailVerified: true,
        phoneVerified: false,
        kycStatus: 'none',
        balance: 0,
        frozenBalance: 0,
        mustChangePassword: false,
        hasPin: true,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
