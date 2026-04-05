import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

const MAX_EXPORT_RECORDS = 1000

// Helper to escape CSV fields
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Helper to build CSV row
function csvRow(values: unknown[]): string {
  return values.map(escapeCSV).join(',') + '\n'
}

// Helper to format date for filename
function dateForFilename(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// GET: Export data as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('adminId')
    const type = searchParams.get('type')

    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المسؤول مطلوب' }, { status: 400 })
    }

    if (!type || !['users', 'deposits', 'withdrawals', 'audit'].includes(type)) {
      return NextResponse.json({ success: false, message: 'نوع التصدير غير صالح. الاختيارات: users, deposits, withdrawals, audit' }, { status: 400 })
    }

    // Verify admin
    const db = getDb()
    const adminDoc = await db.collection('users').doc(adminId).get()
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // UTF-8 BOM for Arabic support
    const BOM = '\uFEFF'
    let csvContent = ''
    let filename = ''

    if (type === 'users') {
      // Export users
      filename = `export_users_${dateForFilename()}.csv`
      const snapshot = await db.collection('users').limit(MAX_EXPORT_RECORDS).get()

      // Arabic headers
      csvContent = csvRow(['المعرف', 'الاسم الكامل', 'البريد الإلكتروني', 'الهاتف', 'الدور', 'الحالة', 'الرصيد', 'تاريخ التسجيل', 'حالة KYC'])

      for (const doc of snapshot.docs) {
        const u = doc.data()
        csvContent += csvRow([
          doc.id,
          u.fullName || '',
          u.email || '',
          u.phone || '',
          u.role || '',
          u.status || '',
          u.balance || 0,
          u.createdAt || '',
          u.kycStatus || '',
        ])
      }
    } else if (type === 'deposits') {
      // Export deposits
      filename = `export_deposits_${dateForFilename()}.csv`
      const [depositsSnap, usersSnap] = await Promise.all([
        db.collection('deposits').limit(MAX_EXPORT_RECORDS).get(),
        db.collection('users').limit(MAX_EXPORT_RECORDS).get(),
      ])

      // Build user map
      const userMap = new Map<string, string>()
      for (const uDoc of usersSnap.docs) {
        userMap.set(uDoc.id, uDoc.data()?.fullName || uDoc.data()?.email || '')
      }

      // Arabic headers
      csvContent = csvRow(['المعرف', 'معرف المستخدم', 'اسم المستخدم', 'المبلغ', 'الرسوم', 'المبلغ الصافي', 'الحالة', 'الشبكة', 'تاريخ الإنشاء'])

      for (const doc of depositsSnap.docs) {
        const d = doc.data()
        csvContent += csvRow([
          doc.id,
          d.userId || '',
          userMap.get(d.userId || '') || '',
          d.amount || 0,
          d.fee || 0,
          d.netAmount || d.amount || 0,
          d.status || '',
          d.network || '',
          d.createdAt || '',
        ])
      }
    } else if (type === 'withdrawals') {
      // Export withdrawals
      filename = `export_withdrawals_${dateForFilename()}.csv`
      const [withdrawalsSnap, usersSnap] = await Promise.all([
        db.collection('withdrawals').limit(MAX_EXPORT_RECORDS).get(),
        db.collection('users').limit(MAX_EXPORT_RECORDS).get(),
      ])

      // Build user map
      const userMap = new Map<string, string>()
      for (const uDoc of usersSnap.docs) {
        userMap.set(uDoc.id, uDoc.data()?.fullName || uDoc.data()?.email || '')
      }

      // Arabic headers
      csvContent = csvRow(['المعرف', 'معرف المستخدم', 'اسم المستخدم', 'المبلغ', 'الرسوم', 'المبلغ الصافي', 'الحالة', 'الشبكة', 'عنوان الاستقبال', 'تاريخ الإنشاء'])

      for (const doc of withdrawalsSnap.docs) {
        const w = doc.data()
        csvContent += csvRow([
          doc.id,
          w.userId || '',
          userMap.get(w.userId || '') || '',
          w.amount || 0,
          w.fee || 0,
          w.netAmount || w.amount || 0,
          w.status || '',
          w.network || '',
          w.toAddress || '',
          w.createdAt || '',
        ])
      }
    } else if (type === 'audit') {
      // Export audit logs
      filename = `export_audit_${dateForFilename()}.csv`
      const snapshot = await db.collection('auditLog').limit(MAX_EXPORT_RECORDS).get()

      // Sort in JS by createdAt desc
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      logs.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

      // Arabic headers
      csvContent = csvRow(['المعرف', 'اسم المسؤول', 'نوع الإجراء', 'نوع الهدف', 'اسم الهدف', 'التفاصيل', 'تاريخ الإنشاء'])

      for (const log of logs) {
        csvContent += csvRow([
          log.id,
          log.adminName || '',
          log.actionType || '',
          log.targetType || '',
          log.targetName || '',
          log.details || '',
          log.createdAt || '',
        ])
      }
    }

    const fullContent = BOM + csvContent

    return new NextResponse(fullContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
