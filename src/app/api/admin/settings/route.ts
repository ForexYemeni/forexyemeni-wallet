import { NextRequest, NextResponse } from 'next/server'
import { userOperations, otpCodeOperations } from '@/lib/db-firebase'
import { getDb, nowTimestamp } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

// GET - admin settings (phone, email, hasPIN)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'ليس لديك صلاحية' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      settings: {
        email: user.email,
        phone: user.phone,
        hasPIN: !!user.pinHash,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST - update admin settings
// Actions: change_phone, change_email, change_password, set_pin, recover_with_email, recover_with_admin_number
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId } = body

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'ليس لديك صلاحية' }, { status: 403 })
    }

    // === CHANGE PHONE ===
    if (action === 'change_phone') {
      const { currentPassword, newPhone } = body
      if (!currentPassword || !newPhone) {
        return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 })
      }

      await userOperations.update({ id: userId }, { phone: newPhone })
      return NextResponse.json({ success: true, message: 'تم تغيير رقم الهاتف' })
    }

    // === CHANGE EMAIL ===
    if (action === 'change_email') {
      const { currentPassword, newEmail } = body
      if (!currentPassword || !newEmail) {
        return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 })
      }

      await userOperations.update({ id: userId }, { email: newEmail })
      return NextResponse.json({ success: true, message: 'تم تغيير البريد الإلكتروني. ستحتاج لتسجيل الدخول بالبريد الجديد.' })
    }

    // === CHANGE PASSWORD (ADMIN) ===
    if (action === 'change_password') {
      const { currentPassword, newPassword } = body
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 })
      }

      const newHash = await bcrypt.hash(newPassword, 12)
      await userOperations.update({ id: userId }, { passwordHash: newHash })
      return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور' })
    }

    // === SET PIN ===
    if (action === 'set_pin') {
      const { currentPassword, pin } = body
      if (!currentPassword || !pin) {
        return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (pin.length < 4 || pin.length > 8) {
        return NextResponse.json({ success: false, message: 'رمز PIN يجب أن يكون بين 4 و 8 أرقام' }, { status: 400 })
      }
      if (!/^\d+$/.test(pin)) {
        return NextResponse.json({ success: false, message: 'رمز PIN يجب أن يكون أرقاماً فقط' }, { status: 400 })
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 })
      }

      const pinHash = await bcrypt.hash(pin, 10)
      await userOperations.update({ id: userId }, { pinHash })
      return NextResponse.json({ success: true, message: 'تم تعيين رمز PIN بنجاح' })
    }

    // === RECOVER WITH EMAIL + PIN ===
    if (action === 'recover_with_email') {
      const { email, pin, newPassword } = body
      if (!email || !pin || !newPassword) {
        return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
      }

      // Verify email matches
      if (user.email !== email) {
        return NextResponse.json({ success: false, message: 'البريد الإلكتروني غير صحيح' }, { status: 401 })
      }

      // Verify PIN
      if (!user.pinHash) {
        return NextResponse.json({ success: false, message: 'لم يتم تعيين رمز PIN. استعادة الحساب برقم الإدارة بدلاً.' }, { status: 400 })
      }

      const pinValid = await bcrypt.compare(pin, user.pinHash)
      if (!pinValid) {
        return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' }, { status: 401 })
      }

      const newHash = await bcrypt.hash(newPassword, 12)
      await userOperations.update({ id: userId }, { passwordHash: newHash })
      return NextResponse.json({ success: true, message: 'تم استعادة كلمة المرور بنجاح' })
    }

    // === RECOVER WITH ADMIN NUMBER + NEW EMAIL ===
    if (action === 'recover_with_admin_number') {
      const { adminNumber, newEmail, pin, newPassword } = body
      if (!adminNumber || !newEmail || !pin || !newPassword) {
        return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
      }

      // Verify admin number (phone) matches
      if (!user.phone || user.phone !== adminNumber) {
        return NextResponse.json({ success: false, message: 'رقم الإدارة غير صحيح' }, { status: 401 })
      }

      // Verify PIN
      if (!user.pinHash) {
        return NextResponse.json({ success: false, message: 'لم يتم تعيين رمز PIN. لا يمكن الاستعادة.' }, { status: 400 })
      }

      const pinValid = await bcrypt.compare(pin, user.pinHash)
      if (!pinValid) {
        return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' }, { status: 401 })
      }

      // Change email and password
      const newHash = await bcrypt.hash(newPassword, 12)
      await userOperations.update({ id: userId }, { email: newEmail, passwordHash: newHash })
      return NextResponse.json({ success: true, message: 'تم استعادة الحساب وتغيير البريد وكلمة المرور' })
    }

    // === ADMIN RESET PASSWORD WITH EMAIL OTP + PIN ===
    if (action === 'admin_reset_with_pin') {
      const { email, pin, newPassword } = body
      if (!email || !pin || !newPassword) {
        return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
      }

      // Verify email matches admin account
      if (user.email !== email) {
        return NextResponse.json({ success: false, message: 'البريد الإلكتروني غير متطابق' }, { status: 401 })
      }

      // Check that the OTP was verified (exists and verified)
      const verifiedOtp = await otpCodeOperations.findFirst({
        where: { email, type: 'admin_password_reset', verified: true },
      })
      if (!verifiedOtp) {
        return NextResponse.json({ success: false, message: 'يرجى التحقق من رمز البريد الإلكتروني أولاً' }, { status: 400 })
      }

      // Verify PIN
      if (!user.pinHash) {
        return NextResponse.json({ success: false, message: 'لم يتم تعيين رمز PIN بعد. لا يمكن تغيير كلمة المرور.' }, { status: 400 })
      }

      const pinValid = await bcrypt.compare(pin, user.pinHash)
      if (!pinValid) {
        return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' }, { status: 401 })
      }

      const newHash = await bcrypt.hash(newPassword, 12)
      await userOperations.update({ id: userId }, { passwordHash: newHash })
      return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
    }

    // === ADMIN RECOVER WITH PHONE NUMBER + NEW EMAIL + OTP + PIN ===
    if (action === 'admin_reset_with_number') {
      const { adminNumber, newEmail, pin, newPassword } = body
      if (!adminNumber || !newEmail || !pin || !newPassword) {
        return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
      }

      // Verify admin phone number matches
      if (!user.phone || user.phone !== adminNumber) {
        return NextResponse.json({ success: false, message: 'رقم الإدارة غير صحيح' }, { status: 401 })
      }

      // Check that OTP was sent to the NEW email and verified
      const verifiedOtp = await otpCodeOperations.findFirst({
        where: { email: newEmail, type: 'admin_password_reset', verified: true },
      })
      if (!verifiedOtp) {
        return NextResponse.json({ success: false, message: 'يرجى التحقق من رمز البريد الإلكتروني الجديد أولاً' }, { status: 400 })
      }

      // Verify PIN
      if (!user.pinHash) {
        return NextResponse.json({ success: false, message: 'لم يتم تعيين رمز PIN. لا يمكن الاستعادة.' }, { status: 400 })
      }

      const pinValid = await bcrypt.compare(pin, user.pinHash)
      if (!pinValid) {
        return NextResponse.json({ success: false, message: 'رمز PIN غير صحيح' }, { status: 401 })
      }

      // Update both email and password
      const newHash = await bcrypt.hash(newPassword, 12)
      await userOperations.update({ id: userId }, { email: newEmail, passwordHash: newHash })
      return NextResponse.json({ success: true, message: 'تم استعادة الحساب وتغيير البريد وكلمة المرور بنجاح' })
    }

    // === UPDATE FEE SETTINGS ===
    if (action === 'update_fees') {
      const { depositFee, withdrawalFee } = body
      if (typeof depositFee !== 'number' || typeof withdrawalFee !== 'number') {
        return NextResponse.json({ success: false, message: 'قيم الرسوم مطلوبة' }, { status: 400 })
      }
      const db = getDb()
      await db.collection('systemSettings').doc('fees').set({
        depositFee,
        withdrawalFee,
        updatedAt: nowTimestamp(),
      }, { merge: true })
      return NextResponse.json({ success: true, message: 'تم تحديث الرسوم بنجاح' })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
