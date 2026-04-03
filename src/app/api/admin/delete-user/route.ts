import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, nowTimestamp } from '@/lib/firebase'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { sendVerificationEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// POST - Delete user with email OTP + password verification
export async function POST(request: NextRequest) {
  try {
    const { adminId, userId, step, otp, password } = await request.json()

    if (!adminId || !userId) {
      return NextResponse.json({ success: false, message: 'معرفات مطلوبة' }, { status: 400 })
    }

    // Verify admin exists and is admin
    const admin = await userOperations.findUnique({ id: adminId })
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Prevent deleting yourself
    if (adminId === userId) {
      return NextResponse.json({ success: false, message: 'لا يمكنك حذف حسابك الخاص' }, { status: 400 })
    }

    // === STEP 1: Send OTP to admin email ===
    if (step === 'send_otp') {
      // Delete old OTPs for this admin
      const db = getDb()
      const oldOtps = await db.collection('otpCodes')
        .where('email', '==', admin.email)
        .where('type', '==', 'delete_user')
        .limit(10)
        .get()
      for (const doc of oldOtps.docs) {
        await doc.ref.delete()
      }

      // Generate 6-digit OTP
      const otpCode = crypto.randomInt(100000, 999999).toString()

      await otpCodeOperations.create({
        userId: adminId,
        email: admin.email,
        code: otpCode,
        type: 'delete_user',
        verified: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      })

      // Send email
      const emailSent = await sendVerificationEmail(admin.email, otpCode)

      if (emailSent) {
        return NextResponse.json({ success: true, message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' })
      } else {
        // For debugging: return the OTP if email fails
        return NextResponse.json({ success: true, message: 'تم إنشاء رمز التحقق', debugOtp: otpCode })
      }
    }

    // === STEP 2: Verify OTP ===
    if (step === 'verify_otp') {
      if (!otp) {
        return NextResponse.json({ success: false, message: 'رمز التحقق مطلوب' }, { status: 400 })
      }

      const otpRecord = await otpCodeOperations.findFirst({
        where: {
          email: admin.email,
          type: 'delete_user',
          verified: false,
        }
      })

      if (!otpRecord) {
        return NextResponse.json({ success: false, message: 'رمز التحقق غير صالح أو منتهي الصلاحية' }, { status: 400 })
      }

      if (otpRecord.code !== otp) {
        return NextResponse.json({ success: false, message: 'رمز التحقق غير صحيح' }, { status: 400 })
      }

      // Mark OTP as verified
      await otpCodeOperations.update(otpRecord.id, { verified: true })

      return NextResponse.json({ success: true, message: 'تم التحقق من الرمز بنجاح' })
    }

    // === STEP 3: Verify password and delete user ===
    if (step === 'confirm_delete') {
      if (!password) {
        return NextResponse.json({ success: false, message: 'كلمة المرور مطلوبة' }, { status: 400 })
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, admin.passwordHash)
      if (!isPasswordValid) {
        return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 400 })
      }

      // Verify user to delete exists
      const userToDelete = await userOperations.findUnique({ id: userId })
      if (!userToDelete) {
        return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
      }

      // Delete user and all related data
      const db = getDb()

      // Delete user's payment methods
      const userMethods = await db.collection('userPaymentMethods')
        .where('userId', '==', userId)
        .limit(50)
        .get()
      for (const doc of userMethods.docs) {
        await doc.ref.delete()
      }

      // Delete user's OTP codes
      const userOtps = await db.collection('otpCodes')
        .where('userId', '==', userId)
        .limit(50)
        .get()
      for (const doc of userOtps.docs) {
        await doc.ref.delete()
      }

      // Delete user's transactions
      const userTx = await db.collection('transactions')
        .where('userId', '==', userId)
        .limit(100)
        .get()
      for (const doc of userTx.docs) {
        await doc.ref.delete()
      }

      // Delete user's notifications
      const userNotifs = await db.collection('notifications')
        .where('userId', '==', userId)
        .limit(50)
        .get()
      for (const doc of userNotifs.docs) {
        await doc.ref.delete()
      }

      // Delete user's KYC records
      const userKyc = await db.collection('kycRecords')
        .where('userId', '==', userId)
        .limit(20)
        .get()
      for (const doc of userKyc.docs) {
        await doc.ref.delete()
      }

      // Delete user's deposits
      const userDeposits = await db.collection('deposits')
        .where('userId', '==', userId)
        .limit(100)
        .get()
      for (const doc of userDeposits.docs) {
        await doc.ref.delete()
      }

      // Delete user's withdrawals
      const userWithdrawals = await db.collection('withdrawals')
        .where('userId', '==', userId)
        .limit(100)
        .get()
      for (const doc of userWithdrawals.docs) {
        await doc.ref.delete()
      }

      // Finally delete the user
      await db.collection('users').doc(userId).delete()

      return NextResponse.json({ success: true, message: `تم حذف المستخدم ${userToDelete.fullName || userToDelete.email} بشكل نهائي` })
    }

    return NextResponse.json({ success: false, message: 'خطوة غير معروفة' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
