// ===================== EMAIL SERVICE (Google Apps Script - FREE) =====================

const SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || ''
const EMAIL_SECRET = process.env.EMAIL_SECRET || 'fxwallet2024'

async function sendEmailViaScript(to: string, subject: string, htmlContent: string): Promise<boolean> {
  if (!SCRIPT_URL) {
    console.log('[EMAIL] Skipped - No GOOGLE_APPS_SCRIPT_URL. OTP for ' + to + ' NOT sent')
    return false
  }

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        secret: EMAIL_SECRET,
        to: to,
        subject: subject,
        html: htmlContent,
      }),
      redirect: 'follow',
    })

    const responseText = await response.text()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    let result: { success?: boolean; error?: string }
    try {
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { success: false }
    } catch {
      console.error('[EMAIL] Parse error:', responseText.substring(0, 200))
      return false
    }

    if (result.success) {
      console.log('[EMAIL] Sent to ' + to)
      return true
    } else {
      console.error('[EMAIL] Error:', result.error)
      return false
    }
  } catch (error) {
    console.error('[EMAIL] Fetch error:', error instanceof Error ? error.message : String(error))
    return false
  }
}

// ===================== HTML EMAIL TEMPLATES =====================

function buildOtpEmail(title: string, description: string, otp: string, color: string, footer: string): string {
  return '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:30px 10px;">'
    + '<tr><td align="center">'
    + '<table width="460" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'

    // Header
    + '<tr><td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px 20px;text-align:center;">'
    + '<h1 style="margin:0;color:#d4af37;font-size:22px;">فوركس يمني</h1>'
    + '<p style="margin:6px 0 0;color:#8888aa;font-size:13px;">محفظة USDT الرقمية</p>'
    + '</td></tr>'

    // Body
    + '<tr><td style="padding:30px 20px;">'
    + '<h2 style="margin:0 0 10px;color:#333;font-size:18px;text-align:center;">' + title + '</h2>'
    + '<p style="margin:0 0 20px;color:#666;font-size:14px;text-align:center;">' + description + '</p>'

    // OTP Code Box
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    + '<div style="background:#f8f9fa;border:2px dashed ' + color + ';border-radius:12px;padding:20px 30px;display:inline-block;">'
    + '<span style="font-size:32px;font-weight:bold;color:#333;letter-spacing:10px;font-family:Courier New,monospace;">' + otp + '</span>'
    + '</div>'
    + '</td></tr></table>'

    + '<p style="margin:16px 0 0;color:#999;font-size:12px;text-align:center;">هذا الرمز صالح لمدة 10 دقائق فقط</p>'
    + '</td></tr>'

    // Footer
    + '<tr><td style="background:#fafafa;padding:20px;border-top:1px solid #eee;">'
    + '<p style="margin:0 0 6px;color:#aaa;font-size:11px;text-align:center;">' + footer + '</p>'
    + '<p style="margin:0;color:#ccc;font-size:10px;text-align:center;">\u00A9 ' + new Date().getFullYear() + ' فوركس يمني - جميع الحقوق محفوظة</p>'
    + '</td></tr>'

    + '</table>'
    + '</td></tr></table>'
    + '</body></html>'
}

// ===================== NOTIFICATION EMAIL TEMPLATE =====================

function buildNotificationEmail(
  icon: string,        // emoji icon
  title: string,       // notification title
  message: string,     // main message body (can include HTML)
  statusColor: string, // #22c55e green, #ef4444 red, #3b82f6 blue, #f59e0b yellow
  statusLabel: string, // status badge text (e.g. "طلب جديد", "تم القبول")
  details?: Array<{ label: string; value: string }> // optional details rows
): string {
  let detailsHtml = ''
  if (details && details.length > 0) {
    detailsHtml = '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;border-collapse:collapse;">'
    details.forEach(function(d) {
      detailsHtml += '<tr style="border-bottom:1px solid #f0f0f0;">'
        + '<td style="padding:10px 0;color:#888;font-size:13px;width:40%;">' + d.label + '</td>'
        + '<td style="padding:10px 0;color:#333;font-size:13px;font-weight:bold;width:60%;direction:ltr;text-align:right;">' + d.value + '</td>'
        + '</tr>'
    })
    detailsHtml += '</table>'
  }

  return '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:30px 10px;">'
    + '<tr><td align="center">'
    + '<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'

    // Header
    + '<tr><td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px 20px;text-align:center;">'
    + '<h1 style="margin:0;color:#d4af37;font-size:22px;">فوركس يمني</h1>'
    + '<p style="margin:6px 0 0;color:#8888aa;font-size:13px;">محفظة USDT الرقمية</p>'
    + '</td></tr>'

    // Body
    + '<tr><td style="padding:30px 20px;">'

    // Status Badge
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    + '<div style="display:inline-block;background:' + statusColor + '15;border:1px solid ' + statusColor + '30;border-radius:20px;padding:6px 16px;">'
    + '<span style="font-size:12px;color:' + statusColor + ';font-weight:bold;">' + statusLabel + '</span>'
    + '</div>'
    + '</td></tr></table>'

    // Icon + Title
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td align="center">'
    + '<span style="font-size:40px;">' + icon + '</span>'
    + '</td></tr></table>'

    + '<h2 style="margin:10px 0;color:#333;font-size:18px;text-align:center;">' + title + '</h2>'
    + '<p style="margin:0 0 8px;color:#555;font-size:14px;text-align:center;line-height:1.8;">' + message + '</p>'

    // Details Table
    + detailsHtml

    + '</td></tr>'

    // Footer
    + '<tr><td style="background:#fafafa;padding:20px;border-top:1px solid #eee;">'
    + '<p style="margin:0 0 6px;color:#aaa;font-size:11px;text-align:center;">هذا إشعار تلقائي من محفظة فوركس يمني</p>'
    + '<p style="margin:0;color:#ccc;font-size:10px;text-align:center;">\u00A9 ' + new Date().getFullYear() + ' فوركس يمني - جميع الحقوق محفوظة</p>'
    + '</td></tr>'

    + '</table>'
    + '</td></tr></table>'
    + '</body></html>'
}

// ===================== OTP EMAIL FUNCTIONS =====================

export async function sendVerificationEmail(to: string, otp: string): Promise<boolean> {
  const html = buildOtpEmail(
    'رمز التحقق',
    'أدخل هذا الرمز لتفعيل بريدك الإلكتروني',
    otp,
    '#d4af37',
    'إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة'
  )
  return sendEmailViaScript(to, 'رمز التحقق - فوركس يمني', html)
}

export async function sendPasswordResetEmail(to: string, otp: string): Promise<boolean> {
  const html = buildOtpEmail(
    'إعادة تعيين كلمة المرور',
    'أدخل هذا الرمز لإعادة تعيين كلمة المرور',
    otp,
    '#ef4444',
    'إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة'
  )
  return sendEmailViaScript(to, 'إعادة تعيين كلمة المرور - فوركس يمني', html)
}

export async function sendPhoneVerificationEmail(to: string, phone: string, otp: string): Promise<boolean> {
  const html = buildOtpEmail(
    'التحقق من رقم الهاتف',
    'أدخل هذا الرمز للتحقق من الرقم: <strong style="color:#3b82f6;direction:ltr;">' + phone + '</strong>',
    otp,
    '#3b82f6',
    'إذا لم تطلب هذا التحقق، تجاهل هذه الرسالة'
  )
  return sendEmailViaScript(to, 'رمز التحقق من رقم الهاتف - فوركس يمني', html)
}

// ===================== ADMIN EMAIL NOTIFICATIONS =====================
// These emails are sent to the ADMIN when users/merchants submit requests

export async function sendAdminNewDepositEmail(
  adminEmail: string,
  userName: string,
  userEmail: string,
  amount: number,
  fee: number,
  netAmount: number,
  network: string,
  depositId: string
): Promise<boolean> {
  const feeInfo = fee > 0 ? ` (الرسوم: ${fee.toFixed(2)} USDT - الصافي: ${netAmount.toFixed(2)} USDT)` : ''
  const html = buildNotificationEmail(
    '💰',
    'طلب إيداع جديد',
    'طلب إيداع جديد من المستخدم <strong>' + userName + '</strong> بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong>' + feeInfo + '.<br>يرجى مراجعة الطلب والموافقة عليه من لوحة الإدارة.',
    '#3b82f6',
    'طلب جديد',
    [
      { label: 'المستخدم', value: userName + ' (' + userEmail + ')' },
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'الشبكة', value: network },
      { label: 'معرف الطلب', value: depositId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(adminEmail, 'طلب إيداع جديد - ' + userName, html)
}

export async function sendAdminNewWithdrawalEmail(
  adminEmail: string,
  userName: string,
  userEmail: string,
  amount: number,
  fee: number,
  netAmount: number,
  network: string,
  toAddress: string,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '📤',
    'طلب سحب جديد',
    'طلب سحب جديد من المستخدم <strong>' + userName + '</strong> بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong> (الصافي: ' + netAmount.toFixed(2) + ' USDT).<br>يرجى مراجعة الطلب والموافقة عليه من لوحة الإدارة.',
    '#f59e0b',
    'طلب جديد',
    [
      { label: 'المستخدم', value: userName + ' (' + userEmail + ')' },
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'الرسوم', value: fee.toFixed(2) + ' USDT' },
      { label: 'الصافي', value: netAmount.toFixed(2) + ' USDT' },
      { label: 'الشبكة', value: network },
      { label: 'العنوان', value: toAddress.substring(0, 16) + '...' },
      { label: 'معرف الطلب', value: withdrawalId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(adminEmail, 'طلب سحب جديد - ' + userName, html)
}

export async function sendAdminNewKycEmail(
  adminEmail: string,
  userName: string,
  userEmail: string,
  docType: string,
  userId: string
): Promise<boolean> {
  const typeLabel = docType === 'id_photo' ? 'صورة الهوية' : 'الصورة الشخصية'
  const html = buildNotificationEmail(
    '🪪',
    'طلب توثيق جديد',
    'تم رفع مستند توثيق جديد (<strong>' + typeLabel + '</strong>) من المستخدم <strong>' + userName + '</strong>.<br>يرجى مراجعة المستندات والموافقة أو الرفض من لوحة الإدارة.',
    '#8b5cf6',
    'طلب توثيق',
    [
      { label: 'المستخدم', value: userName + ' (' + userEmail + ')' },
      { label: 'نوع المستند', value: typeLabel },
      { label: 'معرف المستخدم', value: userId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(adminEmail, 'طلب توثيق جديد - ' + userName, html)
}

// ===================== USER EMAIL NOTIFICATIONS =====================
// These emails are sent to USERS when admin processes their requests

export async function sendUserDepositConfirmedEmail(
  userEmail: string,
  userName: string,
  amount: number,
  fee: number,
  creditAmount: number,
  depositId: string
): Promise<boolean> {
  const feeInfo = fee > 0 ? `<br>تم خصم رسوم قدرها <strong>${fee.toFixed(2)} USDT</strong>` : ''
  const html = buildNotificationEmail(
    '✅',
    'تم تأكيد إيداعك',
    'تم تأكيد إيداعك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong> بنجاح.' + feeInfo + '<br>تم إضافة مبلغ <strong>' + creditAmount.toFixed(2) + ' USDT</strong> إلى رصيدك.',
    '#22c55e',
    'مقبول',
    [
      { label: 'المبلغ المطلوب', value: amount.toFixed(2) + ' USDT' },
      { label: 'الرسوم', value: fee > 0 ? fee.toFixed(2) + ' USDT' : 'لا يوجد' },
      { label: 'المبلغ المضاف', value: creditAmount.toFixed(2) + ' USDT' },
      { label: 'معرف الطلب', value: depositId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, '✅ تم تأكيد إيداعك بنجاح - فوركس يمني', html)
}

export async function sendUserDepositRejectedEmail(
  userEmail: string,
  userName: string,
  amount: number,
  reason: string,
  depositId: string
): Promise<boolean> {
  const reasonText = reason ? '<br>السبب: <strong>' + reason + '</strong>' : ''
  const html = buildNotificationEmail(
    '❌',
    'تم رفض إيداعك',
    'تم رفض طلب إيداعك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong>.' + reasonText + '<br>يمكنك تقديم طلب جديد أو التواصل مع الدعم الفني.',
    '#ef4444',
    'مرفوض',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'السبب', value: reason || 'غير محدد' },
      { label: 'معرف الطلب', value: depositId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, '❌ تم رفض طلب الإيداع - فوركس يمني', html)
}

export async function sendUserDepositReviewingEmail(
  userEmail: string,
  userName: string,
  amount: number,
  depositId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '🔍',
    'طلب إيداعك قيد المراجعة',
    'تم بدء مراجعة طلب إيداعك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong>.<br>سيتم إشعارك بالنتيجة قريباً.',
    '#f59e0b',
    'قيد المراجعة',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'معرف الطلب', value: depositId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, '🔍 طلب إيداعك قيد المراجعة - فوركس يمني', html)
}

export async function sendUserWithdrawalApprovedEmail(
  userEmail: string,
  userName: string,
  amount: number,
  netAmount: number,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '✅',
    'تم قبول طلب السحب',
    'تم قبول طلب سحبك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong> (الصافي: ' + netAmount.toFixed(2) + ' USDT).<br>جاري معالجة الدفع وسيتم إرسال الأموال إلى عنوانك قريباً.',
    '#22c55e',
    'مقبول',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'الصافي', value: netAmount.toFixed(2) + ' USDT' },
      { label: 'معرف الطلب', value: withdrawalId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, '✅ تم قبول طلب السحب - فوركس يمني', html)
}

export async function sendUserWithdrawalProcessingEmail(
  userEmail: string,
  userName: string,
  amount: number,
  netAmount: number,
  toAddress: string,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '💸',
    'تم تنفيذ السحب بنجاح',
    'تم تنفيذ سحبك بقيمة <strong>' + netAmount.toFixed(2) + ' USDT</strong> بنجاح.<br>تم إرسال الأموال إلى العنوان المحدد. يرجى تأكيد الاستلام من التطبيق.',
    '#22c55e',
    'تم التنفيذ',
    [
      { label: 'المبلغ المرسل', value: netAmount.toFixed(2) + ' USDT' },
      { label: 'إلى العنوان', value: toAddress.substring(0, 20) + '...' },
      { label: 'معرف الطلب', value: withdrawalId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, '💸 تم تنفيذ السحب بنجاح - فوركس يمني', html)
}

export async function sendUserWithdrawalRejectedEmail(
  userEmail: string,
  userName: string,
  amount: number,
  reason: string,
  withdrawalId: string
): Promise<boolean> {
  const reasonText = reason ? '<br>السبب: <strong>' + reason + '</strong>' : ''
  const html = buildNotificationEmail(
    '❌',
    'تم رفض طلب السحب',
    'تم رفض طلب سحبك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong>.' + reasonText + '<br>تم إعادة المبلغ بالكامل إلى رصيدك.',
    '#ef4444',
    'مرفوض',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'السبب', value: reason || 'غير محدد' },
      { label: 'معرف الطلب', value: withdrawalId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, '❌ تم رفض طلب السحب - فوركس يمني', html)
}

export async function sendUserKycApprovedEmail(
  userEmail: string,
  userName: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '✅',
    'تم قبول توثيق حسابك',
    'تهانينا! تم قبول جميع مستندات التحقق الخاصة بك بنجاح.<br>حسابك الآن موثق بالكامل ويمكنك الاستفادة من جميع ميزات المحفظة.',
    '#22c55e',
    'موثق',
    []
  )
  return sendEmailViaScript(userEmail, '✅ تم قبول توثيق حسابك - فوركس يمني', html)
}

export async function sendUserKycRejectedEmail(
  userEmail: string,
  userName: string,
  reason: string
): Promise<boolean> {
  const reasonText = reason ? '<br>السبب: <strong>' + reason + '</strong>' : ''
  const html = buildNotificationEmail(
    '❌',
    'تم رفض طلب التوثيق',
    'تم رفض أحد مستندات التحقق الخاصة بك.' + reasonText + '<br>يرجى إعادة رفع المستندات المطلوبة من خلال التطبيق.',
    '#ef4444',
    'مرفوض',
    [
      { label: 'السبب', value: reason || 'غير محدد' },
    ]
  )
  return sendEmailViaScript(userEmail, '❌ تم رفض طلب التوثيق - فوركس يمني', html)
}

// ===================== MERCHANT EMAIL NOTIFICATIONS =====================
// These emails are sent to MERCHANTS when their P2P orders are processed

export async function sendMerchantNewOrderEmail(
  merchantEmail: string,
  merchantName: string,
  userName: string,
  amount: number,
  currency: string,
  orderId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '📦',
    'طلب P2P جديد',
    'لديك طلب جديد من المستخدم <strong>' + userName + '</strong> بقيمة <strong>' + amount.toFixed(2) + ' ' + currency + '</strong>.<br>يرجى مراجعة الطلب والموافقة عليه أو رفضه من لوحة تحكم التاجر.',
    '#3b82f6',
    'طلب جديد',
    [
      { label: 'المستخدم', value: userName },
      { label: 'المبلغ', value: amount.toFixed(2) + ' ' + currency },
      { label: 'معرف الطلب', value: orderId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, '📦 طلب P2P جديد - فوركس يمني', html)
}

export async function sendMerchantOrderCompletedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  currency: string,
  orderId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '✅',
    'تم اكتمال الصفقة',
    'تم اكتمال الصفقة رقم <strong>' + orderId.substring(0, 8) + '</strong> بنجاح بقيمة <strong>' + amount.toFixed(2) + ' ' + currency + '</strong>.<br>تم تحديث رصيدك وفقاً لذلك.',
    '#22c55e',
    'مكتمل',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' ' + currency },
      { label: 'معرف الطلب', value: orderId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, '✅ تم اكتمال الصفقة - فوركس يمني', html)
}

export async function sendMerchantOrderCancelledEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  currency: string,
  reason: string,
  orderId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '❌',
    'تم إلغاء الصفقة',
    'تم إلغاء الصفقة رقم <strong>' + orderId.substring(0, 8) + '</strong> بقيمة <strong>' + amount.toFixed(2) + ' ' + currency + '</strong>.<br>السبب: ' + (reason || 'غير محدد'),
    '#ef4444',
    'ملغي',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' ' + currency },
      { label: 'السبب', value: reason || 'غير محدد' },
      { label: 'معرف الطلب', value: orderId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, '❌ تم إلغاء الصفقة - فوركس يمني', html)
}

export async function sendMerchantDepositConfirmedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  creditAmount: number,
  depositId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '✅',
    'تم تأكيد إيداعك',
    'تم تأكيد إيداعك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong> بنجاح.<br>تم إضافة مبلغ <strong>' + creditAmount.toFixed(2) + ' USDT</strong> إلى رصيدك.',
    '#22c55e',
    'مقبول',
    [
      { label: 'المبلغ المطلوب', value: amount.toFixed(2) + ' USDT' },
      { label: 'المبلغ المضاف', value: creditAmount.toFixed(2) + ' USDT' },
      { label: 'معرف الطلب', value: depositId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, '✅ تم تأكيد إيداعك - فوركس يمني', html)
}

export async function sendMerchantDepositRejectedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  reason: string,
  depositId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '❌',
    'تم رفض إيداعك',
    'تم رفض طلب إيداعك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong>.<br>السبب: ' + (reason || 'غير محدد'),
    '#ef4444',
    'مرفوض',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'السبب', value: reason || 'غير محدد' },
      { label: 'معرف الطلب', value: depositId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, '❌ تم رفض طلب الإيداع - فوركس يمني', html)
}

export async function sendMerchantWithdrawalApprovedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  netAmount: number,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '✅',
    'تم قبول طلب السحب',
    'تم قبول طلب سحبك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong> (الصافي: ' + netAmount.toFixed(2) + ' USDT).<br>جاري معالجة الدفع.',
    '#22c55e',
    'مقبول',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'الصافي', value: netAmount.toFixed(2) + ' USDT' },
      { label: 'معرف الطلب', value: withdrawalId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, '✅ تم قبول طلب السحب - فوركس يمني', html)
}

export async function sendMerchantWithdrawalProcessingEmail(
  merchantEmail: string,
  merchantName: string,
  netAmount: number,
  toAddress: string,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '💸',
    'تم تنفيذ السحب بنجاح',
    'تم تنفيذ سحبك بقيمة <strong>' + netAmount.toFixed(2) + ' USDT</strong> بنجاح.<br>تم إرسال الأموال إلى العنوان المحدد.',
    '#22c55e',
    'تم التنفيذ',
    [
      { label: 'المبلغ المرسل', value: netAmount.toFixed(2) + ' USDT' },
      { label: 'إلى العنوان', value: toAddress.substring(0, 20) + '...' },
      { label: 'معرف الطلب', value: withdrawalId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, '💸 تم تنفيذ السحب - فوركس يمني', html)
}

export async function sendMerchantWithdrawalRejectedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  reason: string,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '❌',
    'تم رفض طلب السحب',
    'تم رفض طلب سحبك بقيمة <strong>' + amount.toFixed(2) + ' USDT</strong>.<br>تم إعادة المبلغ بالكامل إلى رصيدك. السبب: ' + (reason || 'غير محدد'),
    '#ef4444',
    'مرفوض',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + ' USDT' },
      { label: 'السبب', value: reason || 'غير محدد' },
      { label: 'معرف الطلب', value: withdrawalId.substring(0, 12) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, '❌ تم رفض طلب السحب - فوركس يمني', html)
}

// ===================== PIN RECOVERY EMAIL =====================
// Sent to user/merchant when admin generates a temporary PIN for account recovery

export async function sendPinRecoveryEmail(
  userEmail: string,
  userName: string,
  pin: string
): Promise<boolean> {
  const html = buildOtpEmail(
    'رمز PIN مؤقت لاستعادة الحساب',
    'تم إنشاء رمز PIN مؤقت لحسابك من قبل الإدارة.<br>استخدم هذا الرمز لتسجيل الدخول بدلاً من كلمة المرور.<br>بعد تسجيل الدخول، يجب عليك تغيير كلمة المرور فوراً.',
    pin,
    '#d4af37',
    'هذا الرمز صالح لمدة 30 دقيقة فقط. إذا لم تطلب هذا الرمز، تواصل مع الإدارة فوراً.'
  )
  return sendEmailViaScript(userEmail, '🔑 رمز PIN مؤقت - فوركس يمني', html)
}
