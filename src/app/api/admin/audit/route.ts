import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, nowTimestamp } from '@/lib/firebase'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

// Valid action types for audit logging
const VALID_ACTION_TYPES = [
  'user_suspend', 'user_activate', 'user_promote', 'user_demote',
  'balance_add', 'balance_withdraw',
  'deposit_approve', 'deposit_reject',
  'withdrawal_approve', 'withdrawal_reject',
  'kyc_approve', 'kyc_reject',
  'pin_reset', 'pin_send',
  'settings_change',
  'merchant_approve', 'merchant_reject',
  'payment_method_change',
  'delete_user',
  'system_cleanup',
  'faq_change',
  'referral_change',
] as const

// GET: Return audit log entries with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('adminId')
    const actionType = searchParams.get('actionType')
    const targetType = searchParams.get('targetType')
    const targetId = searchParams.get('targetId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const limitParam = searchParams.get('limit')

    // Verify admin
    if (!adminId) {
      return NextResponse.json({ success: false, message: 'معرف المسؤول مطلوب' }, { status: 400 })
    }

    const db = getDb()
    const adminDoc = await db.collection('users').doc(adminId).get()
    if (!adminDoc.exists || (adminDoc.data()?.email !== ADMIN_EMAIL && adminDoc.data()?.role !== 'admin')) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
    }

    // Parse limit (default 50, max 200)
    let limit = 50
    if (limitParam) {
      limit = parseInt(limitParam, 10)
      if (isNaN(limit) || limit < 1) limit = 50
      if (limit > 200) limit = 200
    }

    // Build query
    let query: FirebaseFirestore.Query = db.collection('auditLog')

    // Apply filters (Firestore supports at most one inequality filter, so we handle dates in JS)
    if (actionType) {
      query = query.where('actionType', '==', actionType)
    }
    if (targetType) {
      query = query.where('targetType', '==', targetType)
    }
    if (targetId) {
      query = query.where('targetId', '==', targetId)
    }

    // Fetch with generous limit then filter in JS
    query = query.limit(Math.min(limit * 2, 500))
    const snapshot = await query.get()

    let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Filter by date range in JS
    if (fromDate) {
      const from = new Date(fromDate).getTime()
      logs = logs.filter((log: any) => log.createdAt && new Date(log.createdAt).getTime() >= from)
    }
    if (toDate) {
      const to = new Date(toDate).getTime()
      logs = logs.filter((log: any) => log.createdAt && new Date(log.createdAt).getTime() <= to)
    }

    // Sort by createdAt descending
    logs.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

    // Apply limit after filtering
    const total = logs.length
    logs = logs.slice(0, limit)

    return NextResponse.json({ success: true, logs, total })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST: Create a new audit log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminId, actionType, targetType, targetId, targetName, details, ipAddress } = body

    if (!adminId || !actionType) {
      return NextResponse.json({ success: false, message: 'معرف المسؤول ونوع الإجراء مطلوبان' }, { status: 400 })
    }

    if (!VALID_ACTION_TYPES.includes(actionType)) {
      return NextResponse.json({ success: false, message: 'نوع إجراء غير صالح' }, { status: 400 })
    }

    const db = getDb()

    // Fetch admin user info
    const adminDoc = await db.collection('users').doc(adminId).get()
    if (!adminDoc.exists) {
      return NextResponse.json({ success: false, message: 'المسؤول غير موجود' }, { status: 404 })
    }

    const adminData = adminDoc.data()
    const adminName = adminData.fullName || adminData.email
    const adminEmail = adminData.email

    // Create audit log entry
    const id = generateId()
    const now = nowTimestamp()
    const auditEntry = {
      id,
      adminId,
      adminName,
      adminEmail,
      actionType,
      targetType: targetType || null,
      targetId: targetId || null,
      targetName: targetName || null,
      details: details || '',
      ipAddress: ipAddress || null,
      createdAt: now,
    }

    await db.collection('auditLog').doc(id).set(auditEntry)

    return NextResponse.json({ success: true, log: auditEntry })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
