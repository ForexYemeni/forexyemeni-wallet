import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/db-firebase'
import { getDb } from '@/lib/firebase'
import bcrypt from 'bcryptjs'

// POST - Bulk cleanup: delete all deposits, withdrawals, transactions, notifications, KYC records, OTP codes, and non-admin users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, password, confirmText } = body

    if (!userId || !password || !confirmText) {
      return NextResponse.json({ success: false, message: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    // Verify admin
    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (user.role !== 'admin' || user.permissions) {
      return NextResponse.json({ success: false, message: 'ليس لديك صلاحية. فقط المدير الرئيسي يمكنه تنفيذ هذا الإجراء.' }, { status: 403 })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'كلمة المرور غير صحيحة' }, { status: 401 })
    }

    // Verify confirmation text
    if (confirmText !== 'حذف الكل') {
      return NextResponse.json({ success: false, message: 'يرجى كتابة "حذف الكل" للتأكيد' }, { status: 400 })
    }

    const db = getDb()
    const results: Record<string, number> = {}

    // 1. Delete all deposits
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('deposits').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('deposits').limit(500).get()
      }
      results.deposits = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.deposits_error = -1
      console.error('Error deleting deposits:', msg)
    }

    // 2. Delete all withdrawals
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('withdrawals').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('withdrawals').limit(500).get()
      }
      results.withdrawals = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.withdrawals_error = -1
      console.error('Error deleting withdrawals:', msg)
    }

    // 3. Delete all transactions
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('transactions').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('transactions').limit(500).get()
      }
      results.transactions = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.transactions_error = -1
      console.error('Error deleting transactions:', msg)
    }

    // 4. Delete all notifications
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('notifications').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('notifications').limit(500).get()
      }
      results.notifications = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.notifications_error = -1
      console.error('Error deleting notifications:', msg)
    }

    // 5. Delete all KYC records
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('kycRecords').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('kycRecords').limit(500).get()
      }
      results.kycRecords = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.kycRecords_error = -1
      console.error('Error deleting KYC records:', msg)
    }

    // 6. Delete all OTP codes
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('otpCodes').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('otpCodes').limit(500).get()
      }
      results.otpCodes = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.otpCodes_error = -1
      console.error('Error deleting OTP codes:', msg)
    }

    // 7. Delete user payment methods
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('userPaymentMethods').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('userPaymentMethods').limit(500).get()
      }
      results.userPaymentMethods = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.userPaymentMethods_error = -1
      console.error('Error deleting user payment methods:', msg)
    }

    // 8. Delete user device records
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('userDevices').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('userDevices').limit(500).get()
      }
      results.userDevices = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.userDevices_error = -1
      console.error('Error deleting user devices:', msg)
    }

    // 9. Delete pending device auth records
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('pendingDeviceAuth').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
        totalDeleted += snapshot.size
        snapshot = await db.collection('pendingDeviceAuth').limit(500).get()
      }
      results.pendingDeviceAuth = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.pendingDeviceAuth_error = -1
      console.error('Error deleting pending device auth:', msg)
    }

    // 10. Delete all non-admin users (keep admin accounts)
    try {
      let totalDeleted = 0
      let snapshot = await db.collection('users').limit(500).get()
      while (snapshot.size > 0) {
        const batch = db.batch()
        let hasMore = false
        for (const doc of snapshot.docs) {
          const userData = doc.data()
          // Skip admin accounts (main admin + sub-admins)
          if (userData.role === 'admin') continue
          batch.delete(doc.ref)
          totalDeleted++
          hasMore = true
        }
        if (!hasMore) break
        await batch.commit()
        snapshot = await db.collection('users').limit(500).get()
      }
      results.users = totalDeleted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.users_error = -1
      console.error('Error deleting users:', msg)
    }

    // 11. Reset admin balance to 0 (optional clean start)
    try {
      // Find all admin accounts and reset their balances
      const adminSnapshot = await db.collection('users').where('role', '==', 'admin').limit(20).get()
      const batch = db.batch()
      for (const doc of adminSnapshot.docs) {
        batch.update(doc.ref, { balance: 0, frozenBalance: 0 })
      }
      if (adminSnapshot.size > 0) {
        await batch.commit()
        results.adminReset = adminSnapshot.size
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Error resetting admin balance:', msg)
    }

    return NextResponse.json({
      success: true,
      message: 'تم تنظيف قاعدة البيانات بنجاح',
      results,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء التنظيف'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
