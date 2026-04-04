// ===================== AUDIT LOG UTILITY =====================
// Logs admin actions for the super admin panel
// Usage: logAudit(adminId, 'user_suspend', 'user', userId, userName, 'تم إيقاف الحساب')

import { getDb, nowTimestamp, generateId } from '@/lib/firebase'

const AUDIT_ACTION_LABELS: Record<string, string> = {
  user_suspend: 'إيقاف مستخدم',
  user_activate: 'تفعيل مستخدم',
  user_promote: 'ترقية مستخدم لمدير',
  user_demote: 'إزالة صلاحية الإدارة',
  balance_add: 'إضافة رصيد',
  balance_withdraw: 'سحب رصيد',
  deposit_approve: 'تأكيد إيداع',
  deposit_reject: 'رفض إيداع',
  deposit_review: 'إرسال إيداع للمراجعة',
  withdrawal_approve: 'موافقة على سحب',
  withdrawal_reject: 'رفض سحب',
  withdrawal_processing: 'تنفيذ سحب',
  kyc_approve: 'توثيق موافقة',
  kyc_reject: 'توثيق رفض',
  pin_reset: 'إعادة تعيين PIN',
  pin_send: 'إرسال PIN مؤقت',
  settings_change: 'تغيير إعدادات النظام',
  merchant_approve: 'موافقة على تاجر',
  merchant_reject: 'رفض تاجر',
  merchant_remove: 'إزالة تاجر',
  payment_method_change: 'تعديل طرق الدفع',
  delete_user: 'حذف مستخدم',
  system_cleanup: 'تنظيف قاعدة البيانات',
  faq_change: 'تعديل الأسئلة الشائعة',
  referral_change: 'تعديل برنامج الدعوات',
  social_links_change: 'تعديل الروابط الاجتماعية',
  p2p_dispute_resolve: 'حل نزاع P2P',
  role_change: 'تغيير دور مستخدم',
  permissions_change: 'تغيير صلاحيات مدير',
  bot_settings_change: 'تعديل إعدادات البوت',
}

export function getActionLabel(actionType: string): string {
  return AUDIT_ACTION_LABELS[actionType] || actionType
}

export function getActionColor(actionType: string): string {
  if (actionType.includes('approve') || actionType.includes('activate') || actionType.includes('add')) return 'text-green-400'
  if (actionType.includes('reject') || actionType.includes('suspend') || actionType.includes('delete') || actionType.includes('remove') || actionType.includes('cleanup') || actionType.includes('withdraw')) return 'text-red-400'
  if (actionType.includes('change') || actionType.includes('review')) return 'text-blue-400'
  if (actionType.includes('send') || actionType.includes('reset')) return 'text-orange-400'
  return 'text-gray-400'
}

export function getActionBg(actionType: string): string {
  if (actionType.includes('approve') || actionType.includes('activate') || actionType.includes('add')) return 'bg-green-500/10'
  if (actionType.includes('reject') || actionType.includes('suspend') || actionType.includes('delete') || actionType.includes('remove') || actionType.includes('cleanup') || actionType.includes('withdraw')) return 'bg-red-500/10'
  if (actionType.includes('change') || actionType.includes('review')) return 'bg-blue-500/10'
  if (actionType.includes('send') || actionType.includes('reset')) return 'bg-orange-500/10'
  return 'bg-gray-500/10'
}

export async function logAudit(
  adminId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  targetName: string,
  details: string
): Promise<void> {
  try {
    const db = getDb()

    // Get admin info
    let adminName = 'نظام'
    let adminEmail = ''
    try {
      const adminDoc = await db.collection('users').doc(adminId).get()
      if (adminDoc.exists) {
        const adminData = adminDoc.data()
        adminName = adminData?.fullName || adminData?.email || 'مدير'
        adminEmail = adminData?.email || ''
      }
    } catch {}

    await db.collection('auditLog').add({
      id: generateId(),
      adminId,
      adminName,
      adminEmail,
      actionType,
      targetType,
      targetId,
      targetName,
      details,
      createdAt: nowTimestamp(),
    })
  } catch (error) {
    // Audit logging should never fail the main operation
  }
}
