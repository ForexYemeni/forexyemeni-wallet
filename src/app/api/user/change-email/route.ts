import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendChangeEmailCodeEmail } from '@/lib/email'
import { getDb } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

// POST - change email (send code or verify code)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, newEmail, code, token } = body

    if (!userId || !action) {
      return NextResponse.json({ success: false, message: 'بيانات غير مكتملة' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // ===================== SEND CODE =====================
    if (action === 'send_code') {
      const { password } = body

      if (!newEmail || !password) {
        return NextResponse.json({ success: false, message: 'البريد الإلكتروني الجديد وكلمة المرور مطلوبان' }, { status: 400 })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(newEmail)) {
        return NextResponse.json({ success: false, message: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 })
      }

      // Check new email is different from current
      if (newEmail.toLowerCase() === user.email.toLowerCase()) {
        return NextResponse.json({ success: false, message: 'البريد الإلكتروني الجديد يجب أن يكون مختلفاً عن الحالي' }, { status: 400 })
      }

      // Check new email is not already used by another user
      const existingUser = await userOperations.findUnique({ email: newEmail })
      if (existingUser) {
        return NextResponse.json({ success: false, message: 'هذا البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
      }

      // Delete old change_email OTPs for this user
      const db = getDb()
      try {
        const oldOtps = await db.collection('otpCodes')
          .where('userId', '==', userId)
          .where('type', '==', 'change_email')
          .limit(20)
          .get()
        const batch = db.batch()
        for (const doc of oldOtps.docs) {
          batch.delete(doc.ref)
        }
        if (oldOtps.docs.length > 0) {
          await batch.commit()
        }
      } catch {
        // Continue even if delete fails
      }

      // Generate 6-digit code
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await otpCodeOperations.create({
        userId: userId as string,
        email: newEmail as string,
        code: otp,
        type: 'change_email',
        purpose: newEmail as string,
        verified: false,
        expiresAt,
      })

      // Send verification email to new email
      await sendChangeEmailCodeEmail(newEmail, otp)

      return NextResponse.json({ success: true, message: 'تم إرسال رمز التحقق للبريد الجديد' })
    }

    // ===================== VERIFY CODE =====================
    if (action === 'verify') {
      if (!code) {
        return NextResponse.json({ success: false, message: 'رمز التحقق مطلوب' }, { status: 400 })
      }

      // Find latest OTP for this user with type change_email
      const otpRecord = await otpCodeOperations.findFirst({
        where: {
          userId,
          type: 'change_email',
          verified: false,
        },
      })

      if (!otpRecord) {
        return NextResponse.json({ success: false, message: 'لم يتم العثور على رمز تحقق. يرجى إعادة إرسال الرمز.' }, { status: 400 })
      }

      if (new Date(otpRecord.expiresAt) < new Date()) {
        return NextResponse.json({ success: false, message: 'انتهت صلاحية الرمز. يرجى إعادة إرسال رمز جديد.' }, { status: 400 })
      }

      if (otpRecord.code !== code) {
        return NextResponse.json({ success: false, message: 'رمز التحقق غير صحيح' }, { status: 400 })
      }

      const newEmailAddress = otpRecord.purpose || otpRecord.email

      if (!newEmailAddress) {
        return NextResponse.json({ success: false, message: 'حدث خطأ في البيانات' }, { status: 400 })
      }

      // Update user email in Firestore
      await userOperations.update({ id: userId }, {
        email: newEmailAddress,
        emailVerified: true,
      })

      // Mark OTP as verified
      await otpCodeOperations.update(otpRecord.id, { verified: true })

      return NextResponse.json({ success: true, message: 'تم تغيير البريد الإلكتروني بنجاح', newEmail: newEmailAddress })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير صالح' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
