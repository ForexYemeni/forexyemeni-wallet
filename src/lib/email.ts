// ===================== EMAIL SERVICE (Google Apps Script - FREE) =====================

const SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || ''
const EMAIL_SECRET = process.env.EMAIL_SECRET || 'fxwallet2024'

async function sendEmailViaScript(to: string, subject: string, htmlContent: string): Promise<boolean> {
  if (!SCRIPT_URL) {
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
      return false
    }

    if (result.success) {
      return true
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}

// ===================== HELPER: EMAIL WRAPPER =====================

function emailWrapper(bodyContent: string): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })

  return '<!DOCTYPE html>'
    + '<html dir="rtl" lang="ar">'
    + '<head>'
    + '<meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="X-UA-Compatible" content="IE=edge">'
    + '<title>فوركس يمني</title>'
    + '<style>'
    + 'body{margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans Arabic",sans-serif;}'
    + '.email-body{background:#f0f2f5;padding:32px 16px;}'
    + '.email-container{max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);}'
    + '</style>'
    + '</head>'
    + '<body>'
    + '<div class="email-body">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:transparent;">'
    + '<tr><td align="center">'

    // Main container
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" class="email-container" style="max-width:560px;width:100%;">'

    // === HEADER ===
    + '<tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);padding:0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    + '<tr>'
    // Logo area
    + '<td style="padding:28px 32px 20px;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0">'
    + '<tr>'
    + '<td style="vertical-align:middle;">'
    + '<div style="width:44px;height:44px;background:linear-gradient(135deg,#d4af37,#f4d03f);border-radius:12px;text-align:center;line-height:44px;font-size:20px;color:#0f172a;font-weight:bold;">F</div>'
    + '</td>'
    + '<td style="padding-right:14px;vertical-align:middle;">'
    + '<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">فوركس يمني</h1>'
    + '<p style="margin:2px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:1px;">FOREX YEMENI WALLET</p>'
    + '</td>'
    + '</tr></table>'
    + '</td>'
    + '</tr>'
    // Gold accent line
    + '<tr><td style="padding:0 32px;">'
    + '<div style="height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,0.4),transparent);"></div>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr>'

    // === BODY ===
    + '<tr><td style="padding:32px;">'
    + bodyContent
    + '</td></tr>'

    // === FOOTER ===
    + '<tr><td style="background:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    // Date/time
    + '<tr><td style="text-align:center;padding-bottom:12px;">'
    + '<p style="margin:0;color:#94a3b8;font-size:11px;">' + dateStr + ' &bull; ' + timeStr + '</p>'
    + '</td></tr>'
    // Brand
    + '<tr><td style="text-align:center;padding-bottom:8px;">'
    + '<p style="margin:0;color:#64748b;font-size:12px;font-weight:600;">فوركس يمني &mdash; محفظة USDT الرقمية</p>'
    + '</td></tr>'
    // Disclaimer
    + '<tr><td style="text-align:center;">'
    + '<p style="margin:0;color:#94a3b8;font-size:10px;line-height:1.6;">هذا إشعار تلقائي من نظام فوركس يمني. يرجى عدم الرد على هذه الرسالة.<br>&copy; ' + now.getFullYear() + ' فوركس يمني. جميع الحقوق محفوظة.</p>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr>'

    + '</table>'
    + '</td></tr></table>'
    + '</div>'
    + '</body></html>'
}

// ===================== OTP EMAIL TEMPLATE =====================

function buildOtpEmail(title: string, description: string, otp: string, accentColor: string, footerNote: string): string {
  // Split OTP into individual digits for styling
  var digits = otp.split('')
  var otpDigitsHtml = ''
  digits.forEach(function(d) {
    otpDigitsHtml += '<span style="display:inline-block;width:40px;height:48px;line-height:48px;text-align:center;background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;font-size:24px;font-weight:700;color:#1e293b;font-family:\'Courier New\',monospace;margin:0 3px;">' + d + '</span>'
  })

  var body = ''
  // Icon circle
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding-bottom:24px;">'
  + '<div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,' + accentColor + '15,' + accentColor + '08);border:2px solid ' + accentColor + '20;text-align:center;line-height:64px;font-size:28px;">&#128274;</div>'
  + '</td></tr></table>'

  // Title
  + '<h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;font-weight:700;text-align:center;">' + title + '</h2>'

  // Description
  + '<p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.8;text-align:center;">' + description + '</p>'

  // OTP Digits
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding:24px 0 8px;">'
  + '<div style="background:#f8fafc;border-radius:16px;padding:20px 16px;display:inline-block;border:1px solid #e2e8f0;">'
  + otpDigitsHtml
  + '</div>'
  + '</td></tr></table>'

  // Expiry note
  + '<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;text-align:center;">&#9202; هذا الرمز صالح لمدة محدودة فقط</p>'

  // Divider
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0 0;">'
  + '<div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>'
  + '</td></tr></table>'

  // Security note
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;">'
  + '<div style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 18px;">'
  + '<p style="margin:0;color:#9a3412;font-size:11px;line-height:1.6;">&#9888; ' + footerNote + '</p>'
  + '</div>'
  + '</td></tr></table>'

  return emailWrapper(body)
}

// ===================== NOTIFICATION EMAIL TEMPLATE =====================

function buildNotificationEmail(
  icon: string,
  title: string,
  message: string,
  statusColor: string,
  statusLabel: string,
  statusType: string, // 'success', 'error', 'warning', 'info'
  details?: Array<{ label: string; value: string }>
): string {
  // Status bar color mapping
  var statusBgMap: Record<string, string> = {
    success: '#dcfce7',
    error: '#fee2e2',
    warning: '#fef3c7',
    info: '#dbeafe',
  }
  var statusBorderMap: Record<string, string> = {
    success: '#86efac',
    error: '#fca5a5',
    warning: '#fcd34d',
    info: '#93c5fd',
  }
  var statusIconMap: Record<string, string> = {
    success: '&#10004;',
    error: '&#10008;',
    warning: '&#9888;',
    info: '&#8505;',
  }
  var bg = statusBgMap[statusType] || statusBgMap.info
  var border = statusBorderMap[statusType] || statusBorderMap.info
  var sIcon = statusIconMap[statusType] || statusIconMap.info

  // Build details table
  var detailsHtml = ''
  if (details && details.length > 0) {
    detailsHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">'
    // Table header
    detailsHtml += '<tr><td style="background:#f8fafc;padding:10px 16px;border-bottom:1px solid #e2e8f0;">'
    + '<p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.5px;">تفاصيل العملية</p>'
    + '</td></tr>'

    details.forEach(function(d, i) {
      var rowBg = i % 2 === 0 ? '#ffffff' : '#fafbfc'
      detailsHtml += '<tr>'
        + '<td style="background:' + rowBg + ';padding:12px 16px;border-bottom:1px solid #f1f5f9;width:38%;">'
        + '<p style="margin:0;color:#94a3b8;font-size:12px;">' + d.label + '</p>'
        + '</td>'
        + '<td style="background:' + rowBg + ';padding:12px 16px;border-bottom:1px solid #f1f5f9;width:62%;direction:ltr;text-align:right;">'
        + '<p style="margin:0;color:#1e293b;font-size:13px;font-weight:600;">' + d.value + '</p>'
        + '</td>'
        + '</tr>'
    })

    detailsHtml += '</table>'
  }

  var body = ''

  // Status banner
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom:24px;">'
  + '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:14px;padding:14px 20px;text-align:center;">'
  + '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
  + '<td style="vertical-align:middle;">'
  + '<div style="width:32px;height:32px;border-radius:50%;background:' + border + ';color:#ffffff;text-align:center;line-height:32px;font-size:14px;font-weight:bold;">' + sIcon + '</div>'
  + '</td>'
  + '<td style="vertical-align:middle;padding-right:10px;">'
  + '<span style="color:' + statusColor + ';font-size:14px;font-weight:700;">' + statusLabel + '</span>'
  + '</td>'
  + '</tr></table>'
  + '</div>'
  + '</td></tr></table>'

  // Large icon
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding-bottom:16px;">'
  + '<div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,' + statusColor + '12,' + statusColor + '06);text-align:center;line-height:72px;font-size:36px;">' + icon + '</div>'
  + '</td></tr></table>'

  // Title
  + '<h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;text-align:center;">' + title + '</h2>'

  // Message
  + '<p style="margin:0 auto 0;color:#64748b;font-size:14px;line-height:2;text-align:center;max-width:420px;">' + message + '</p>'

  // Details
  + detailsHtml

  // Bottom action hint
  + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0 0;text-align:center;">'
  + '<div style="display:inline-block;background:#f8fafc;border-radius:10px;padding:10px 20px;border:1px solid #e2e8f0;">'
  + '<p style="margin:0;color:#94a3b8;font-size:11px;">&#128203; يمكنك متابعة تفاصيل هذه العملية من خلال التطبيق</p>'
  + '</div>'
  + '</td></tr></table>'

  return emailWrapper(body)
}

// ===================== OTP EMAIL FUNCTIONS =====================

export async function sendVerificationEmail(to: string, otp: string): Promise<boolean> {
  const html = buildOtpEmail(
    'رمز التحقق من البريد الإلكتروني',
    'أدخل الرمز أدناه لتفعيل بريدك الإلكتروني واستكمال تسجيل حسابك في محفظة فوركس يمني.',
    otp,
    '#d4af37',
    'إذا لم تطلب هذا الرمز بنفسك، يرجى تجاهل هذه الرسالة تماماً. لا تشارك هذا الرمز مع أي شخص.'
  )
  return sendEmailViaScript(to, 'رمز التحقق - فوركس يمني', html)
}

export async function sendPasswordResetEmail(to: string, otp: string): Promise<boolean> {
  const html = buildOtpEmail(
    'إعادة تعيين كلمة المرور',
    'أدخل الرمز أدناه لإعادة تعيين كلمة المرور الخاصة بحسابك في محفظة فوركس يمني.',
    otp,
    '#ef4444',
    'إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذه الرسالة وتأمين حسابك فوراً.'
  )
  return sendEmailViaScript(to, 'إعادة تعيين كلمة المرور - فوركس يمني', html)
}

export async function sendPhoneVerificationEmail(to: string, phone: string, otp: string): Promise<boolean> {
  const html = buildOtpEmail(
    'التحقق من رقم الهاتف',
    'أدخل الرمز أدناه للتحقق من رقم الهاتف المرتبط بحسابك في محفظة فوركس يمني.<br><strong style="color:#3b82f6;direction:ltr;display:inline-block;margin-top:8px;">' + phone + '</strong>',
    otp,
    '#3b82f6',
    'إذا لم تطلب هذا التحقق، يرجى تجاهل هذه الرسالة. لا تشارك هذا الرمز مع أي شخص.'
  )
  return sendEmailViaScript(to, 'رمز التحقق من رقم الهاتف - فوركس يمني', html)
}

// ===================== ADMIN EMAIL NOTIFICATIONS =====================

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
  const feeInfo = fee > 0 ? `${fee.toFixed(2)}&nbsp;USDT` : 'لا يوجد'
  const html = buildNotificationEmail(
    '&#128176;',
    'طلب إيداع جديد',
    'تلقيت طلب إيداع جديد من المستخدم <strong>' + userName + '</strong> بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong>.<br>يرجى مراجعة الطلب والموافقة عليه أو رفضه من لوحة الإدارة.',
    '#3b82f6',
    'طلب جديد بانتظار المراجعة',
    'info',
    [
      { label: 'المستخدم', value: userName + ' (' + userEmail + ')' },
      { label: 'المبلغ المطلوب', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'الرسوم', value: feeInfo },
      { label: 'الصافي', value: netAmount.toFixed(2) + '&nbsp;USDT' },
      { label: 'الشبكة', value: network },
      { label: 'رقم الطلب', value: depositId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(adminEmail, '[طلب جديد] إيداع - ' + userName, html)
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
    '&#128228;',
    'طلب سحب جديد',
    'تلقيت طلب سحب جديد من المستخدم <strong>' + userName + '</strong> بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong> (الصافي: ' + netAmount.toFixed(2) + '&nbsp;USDT).<br>يرجى مراجعة الطلب وتنفيذه من لوحة الإدارة.',
    '#f59e0b',
    'طلب جديد بانتظار المراجعة',
    'warning',
    [
      { label: 'المستخدم', value: userName + ' (' + userEmail + ')' },
      { label: 'المبلغ المطلوب', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'الرسوم', value: fee.toFixed(2) + '&nbsp;USDT' },
      { label: 'الصافي المرسل', value: netAmount.toFixed(2) + '&nbsp;USDT' },
      { label: 'الشبكة', value: network },
      { label: 'العنوان', value: toAddress.substring(0, 20) + '...' },
      { label: 'رقم الطلب', value: withdrawalId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(adminEmail, '[طلب جديد] سحب - ' + userName, html)
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
    '&#128100;',
    'طلب توثيق حساب جديد',
    'قام المستخدم <strong>' + userName + '</strong> برفع مستند توثيق جديد (<strong>' + typeLabel + '</strong>).<br>يرجى مراجعة المستند والموافقة أو الرفض من لوحة الإدارة.',
    '#8b5cf6',
    'طلب توثيق بانتظار المراجعة',
    'info',
    [
      { label: 'المستخدم', value: userName + ' (' + userEmail + ')' },
      { label: 'نوع المستند', value: typeLabel },
      { label: 'رقم المستخدم', value: userId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(adminEmail, '[طلب جديد] توثيق - ' + userName, html)
}

// ===================== USER EMAIL NOTIFICATIONS =====================

export async function sendUserDepositConfirmedEmail(
  userEmail: string,
  userName: string,
  amount: number,
  fee: number,
  creditAmount: number,
  depositId: string
): Promise<boolean> {
  const feeInfo = fee > 0 ? `تم خصم رسوم قدرها <strong>${fee.toFixed(2)}&nbsp;USDT</strong>` : 'بدون رسوم إضافية'
  const html = buildNotificationEmail(
    '&#9989;',
    'تم تأكيد إيداعك بنجاح',
    'تمت مراجعة وإيداعك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong> بنجاح.<br>' + feeInfo + '.<br>تم إضافة مبلغ <strong>' + creditAmount.toFixed(2) + '&nbsp;USDT</strong> إلى رصيدك في المحفظة.',
    '#22c55e',
    'تمت الموافقة',
    'success',
    [
      { label: 'المبلغ المطلوب', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'الرسوم', value: fee > 0 ? fee.toFixed(2) + '&nbsp;USDT' : 'لا يوجد' },
      { label: 'المبلغ المضاف للرصيد', value: creditAmount.toFixed(2) + '&nbsp;USDT' },
      { label: 'رقم العملية', value: depositId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, 'تم تأكيد إيداعك بنجاح - فوركس يمني', html)
}

export async function sendUserDepositRejectedEmail(
  userEmail: string,
  userName: string,
  amount: number,
  reason: string,
  depositId: string
): Promise<boolean> {
  const reasonText = reason ? '<br>السبب المحدد: <strong>' + reason + '</strong>' : ''
  const html = buildNotificationEmail(
    '&#10060;',
    'تم رفض طلب الإيداع',
    'نأسف، تم رفض طلب إيداعك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong>.' + reasonText + '<br>يمكنك تقديم طلب إيداع جديد أو التواصل مع فريق الدعم الفني للمساعدة.',
    '#ef4444',
    'تم الرفض',
    'error',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'سبب الرفض', value: reason || 'غير محدد' },
      { label: 'رقم العملية', value: depositId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, 'تم رفض طلب الإيداع - فوركس يمني', html)
}

export async function sendUserDepositReviewingEmail(
  userEmail: string,
  userName: string,
  amount: number,
  depositId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#128269;',
    'طلب إيداعك قيد المراجعة',
    'تم بدء مراجعة طلب إيداعك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong> من قبل فريق الإدارة.<br>سيتم إشعارك بالنتيجة فور اكتمال المراجعة.',
    '#f59e0b',
    'قيد المراجعة',
    'warning',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'رقم العملية', value: depositId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, 'طلب إيداعك قيد المراجعة - فوركس يمني', html)
}

export async function sendUserWithdrawalApprovedEmail(
  userEmail: string,
  userName: string,
  amount: number,
  netAmount: number,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#9989;',
    'تم قبول طلب السحب',
    'تم قبول طلب سحبك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong> (الصافي: ' + netAmount.toFixed(2) + '&nbsp;USDT).<br>جاري معالجة تحويل الأموال إلى عنوانك المسجل وسيتم إشعارك فور التنفيذ.',
    '#22c55e',
    'تمت الموافقة',
    'success',
    [
      { label: 'المبلغ المطلوب', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'الصافي المرسل', value: netAmount.toFixed(2) + '&nbsp;USDT' },
      { label: 'رقم العملية', value: withdrawalId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, 'تم قبول طلب السحب - فوركس يمني', html)
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
    '&#128176;',
    'تم تنفيذ السحب بنجاح',
    'تم تحويل مبلغ <strong>' + netAmount.toFixed(2) + '&nbsp;USDT</strong> بنجاح إلى العنوان المحفوظ لدينا.<br>يرجى تأكيد الاستلام من خلال التطبيق.',
    '#22c55e',
    'تم التنفيذ بنجاح',
    'success',
    [
      { label: 'المبلغ المرسل', value: netAmount.toFixed(2) + '&nbsp;USDT' },
      { label: 'إلى العنوان', value: toAddress.substring(0, 24) + '...' },
      { label: 'رقم العملية', value: withdrawalId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, 'تم تنفيذ السحب بنجاح - فوركس يمني', html)
}

export async function sendUserWithdrawalRejectedEmail(
  userEmail: string,
  userName: string,
  amount: number,
  reason: string,
  withdrawalId: string
): Promise<boolean> {
  const reasonText = reason ? '<br>السبب المحدد: <strong>' + reason + '</strong>' : ''
  const html = buildNotificationEmail(
    '&#10060;',
    'تم رفض طلب السحب',
    'نأسف، تم رفض طلب سحبك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong>.' + reasonText + '<br>تم إعادة المبلغ بالكامل إلى رصيدك المتاح في المحفظة.',
    '#ef4444',
    'تم الرفض',
    'error',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'سبب الرفض', value: reason || 'غير محدد' },
      { label: 'رقم العملية', value: withdrawalId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(userEmail, 'تم رفض طلب السحب - فوركس يمني', html)
}

export async function sendUserKycApprovedEmail(
  userEmail: string,
  userName: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#127942;',
    'تم توثيق حسابك بنجاح',
    'تهانينا! تم قبول جميع مستندات التحقق الخاصة بك بنجاح.<br>حسابك الآن موثق بالكامل ويمكنك الاستفادة من جميع الميزات والخدمات المتقدمة في المحفظة.',
    '#22c55e',
    'حساب موثق',
    'success',
    []
  )
  return sendEmailViaScript(userEmail, 'تم توثيق حسابك بنجاح - فوركس يمني', html)
}

export async function sendUserKycRejectedEmail(
  userEmail: string,
  userName: string,
  reason: string
): Promise<boolean> {
  const reasonText = reason ? '<br>السبب المحدد: <strong>' + reason + '</strong>' : ''
  const html = buildNotificationEmail(
    '&#10060;',
    'تم رفض طلب التوثيق',
    'نأسف، تم رفض أحد مستندات التحقق الخاصة بك.' + reasonText + '<br>يرجى إعادة رفع المستندات المطلوبة بجودة أعلى من خلال التطبيق.',
    '#ef4444',
    'تم الرفض',
    'error',
    [
      { label: 'سبب الرفض', value: reason || 'غير محدد' },
    ]
  )
  return sendEmailViaScript(userEmail, 'تم رفض طلب التوثيق - فوركس يمني', html)
}

// ===================== MERCHANT EMAIL NOTIFICATIONS =====================

export async function sendMerchantNewOrderEmail(
  merchantEmail: string,
  merchantName: string,
  userName: string,
  amount: number,
  currency: string,
  orderId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#128230;',
    'طلب تداول P2P جديد',
    'لديك طلب تداول جديد من المستخدم <strong>' + userName + '</strong> بقيمة <strong>' + amount.toFixed(2) + '&nbsp;' + currency + '</strong>.<br>يرجى مراجعة الطلب والموافقة عليه أو رفضه من لوحة تحكم التاجر.',
    '#3b82f6',
    'طلب جديد',
    'info',
    [
      { label: 'المستخدم', value: userName },
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;' + currency },
      { label: 'رقم الطلب', value: orderId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, 'طلب تداول P2P جديد - فوركس يمني', html)
}

export async function sendMerchantOrderCompletedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  currency: string,
  orderId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#9989;',
    'تم اكتمال الصفقة بنجاح',
    'تمت الموافقة على الصفقة <strong>#' + orderId.substring(0, 8) + '</strong> بنجاح بقيمة <strong>' + amount.toFixed(2) + '&nbsp;' + currency + '</strong>.<br>تم تحديث رصيدك وفقاً لتفاصيل الصفقة.',
    '#22c55e',
    'صفقة مكتملة',
    'success',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;' + currency },
      { label: 'رقم الصفقة', value: orderId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, 'اكتمال الصفقة - فوركس يمني', html)
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
    '&#10060;',
    'تم إلغاء الصفقة',
    'تم إلغاء الصفقة <strong>#' + orderId.substring(0, 8) + '</strong> بقيمة <strong>' + amount.toFixed(2) + '&nbsp;' + currency + '</strong>.<br>السبب: ' + (reason || 'غير محدد'),
    '#ef4444',
    'صفقة ملغية',
    'error',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;' + currency },
      { label: 'السبب', value: reason || 'غير محدد' },
      { label: 'رقم الصفقة', value: orderId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, 'إلغاء الصفقة - فوركس يمني', html)
}

export async function sendMerchantDepositConfirmedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  creditAmount: number,
  depositId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#9989;',
    'تم تأكيد إيداعك بنجاح',
    'تم تأكيد إيداعك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong> بنجاح.<br>تم إضافة مبلغ <strong>' + creditAmount.toFixed(2) + '&nbsp;USDT</strong> إلى رصيدك كتاجر.',
    '#22c55e',
    'تمت الموافقة',
    'success',
    [
      { label: 'المبلغ المطلوب', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'المبلغ المضاف', value: creditAmount.toFixed(2) + '&nbsp;USDT' },
      { label: 'رقم العملية', value: depositId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, 'تم تأكيد إيداعك - فوركس يمني', html)
}

export async function sendMerchantDepositRejectedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  reason: string,
  depositId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#10060;',
    'تم رفض طلب الإيداع',
    'نأسف، تم رفض طلب إيداعك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong>.<br>السبب: ' + (reason || 'غير محدد'),
    '#ef4444',
    'تم الرفض',
    'error',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'السبب', value: reason || 'غير محدد' },
      { label: 'رقم العملية', value: depositId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, 'تم رفض طلب الإيداع - فوركس يمني', html)
}

export async function sendMerchantWithdrawalApprovedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  netAmount: number,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#9989;',
    'تم قبول طلب السحب',
    'تم قبول طلب سحبك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong> (الصافي: ' + netAmount.toFixed(2) + '&nbsp;USDT).<br>جاري معالجة التحويل.',
    '#22c55e',
    'تمت الموافقة',
    'success',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'الصافي', value: netAmount.toFixed(2) + '&nbsp;USDT' },
      { label: 'رقم العملية', value: withdrawalId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, 'تم قبول طلب السحب - فوركس يمني', html)
}

export async function sendMerchantWithdrawalProcessingEmail(
  merchantEmail: string,
  merchantName: string,
  netAmount: number,
  toAddress: string,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#128176;',
    'تم تنفيذ السحب بنجاح',
    'تم تحويل مبلغ <strong>' + netAmount.toFixed(2) + '&nbsp;USDT</strong> بنجاح إلى العنوان المحفوظ.',
    '#22c55e',
    'تم التنفيذ بنجاح',
    'success',
    [
      { label: 'المبلغ المرسل', value: netAmount.toFixed(2) + '&nbsp;USDT' },
      { label: 'إلى العنوان', value: toAddress.substring(0, 24) + '...' },
      { label: 'رقم العملية', value: withdrawalId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, 'تم تنفيذ السحب - فوركس يمني', html)
}

export async function sendMerchantWithdrawalRejectedEmail(
  merchantEmail: string,
  merchantName: string,
  amount: number,
  reason: string,
  withdrawalId: string
): Promise<boolean> {
  const html = buildNotificationEmail(
    '&#10060;',
    'تم رفض طلب السحب',
    'نأسف، تم رفض طلب سحبك بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong>.<br>تم إعادة المبلغ بالكامل إلى رصيدك. السبب: ' + (reason || 'غير محدد'),
    '#ef4444',
    'تم الرفض',
    'error',
    [
      { label: 'المبلغ', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'السبب', value: reason || 'غير محدد' },
      { label: 'رقم العملية', value: withdrawalId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(merchantEmail, 'تم رفض طلب السحب - فوركس يمني', html)
}

// ===================== 2FA EMAIL FUNCTIONS =====================

export async function sendChangeEmailCodeEmail(to: string, code: string): Promise<boolean> {
  const html = buildOtpEmail(
    'تغيير البريد الإلكتروني',
    'أدخل الرمز أدناه لتأكيد تغيير البريد الإلكتروني المرتبط بحسابك في محفظة فوركس يمني.',
    code,
    '#d4af37',
    'إذا لم تطلب هذا التغيير، يرجى تجاهل هذه الرسالة وتأمين حسابك فوراً.'
  )
  return sendEmailViaScript(to, 'تغيير البريد الإلكتروني - فوركس يمني', html)
}

export async function send2FACodeEmail(to: string, code: string): Promise<boolean> {
  const html = buildOtpEmail(
    'رمز المصادقة الثنائية',
    'أدخل الرمز أدناه لإكمال تسجيل الدخول إلى حسابك في محفظة فوركس يمني.',
    code,
    '#d4af37',
    'هذا الرمز صالح لمدة 5 دقائق فقط. لا تشاركه مع أي شخص.'
  )
  return sendEmailViaScript(to, 'رمز المصادقة الثنائية - فوركس يمني', html)
}

export async function send2FASetupEmail(to: string, code: string): Promise<boolean> {
  const html = buildOtpEmail(
    'تفعيل المصادقة الثنائية',
    'أدخل الرمز أدناه لتفعيل المصادقة الثنائية على حسابك في محفظة فوركس يمني.',
    code,
    '#22c55e',
    'هذا الرمز صالح لمدة 5 دقائق فقط. لا تشاركه مع أي شخص.'
  )
  return sendEmailViaScript(to, 'تفعيل المصادقة الثنائية - فوركس يمني', html)
}

// ===================== TRANSFER EMAIL NOTIFICATIONS =====================

export async function sendTransferSenderEmail(
  senderEmail: string,
  senderName: string,
  amount: number,
  receiverName: string,
  receiverAccountNumber: number | null,
  newBalance: number,
  transferId: string
): Promise<boolean> {
  const receiverInfo = receiverName + (receiverAccountNumber ? ' (' + receiverAccountNumber + ')' : '')
  const html = buildNotificationEmail(
    '&#128228;',
    'تم خصم مبلغ من حسابك',
    'تم تحويل مبلغ <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong> من حسابك بنجاح إلى المستخدم <strong>' + receiverInfo + '</strong>.',
    '#f59e0b',
    'تم خصم المبلغ',
    'warning',
    [
      { label: 'المبلغ المُحوّل', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'المستلم', value: receiverInfo },
      { label: 'رصيدك بعد التحويل', value: newBalance.toFixed(2) + '&nbsp;USDT' },
      { label: 'رقم العملية', value: transferId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(senderEmail, 'تم تحويل مبلغ من حسابك - فوركس يمني', html)
}

export async function sendTransferReceiverEmail(
  receiverEmail: string,
  receiverName: string,
  amount: number,
  senderName: string,
  senderAccountNumber: number | null,
  newBalance: number,
  transferId: string
): Promise<boolean> {
  const senderInfo = senderName + (senderAccountNumber ? ' (' + senderAccountNumber + ')' : '')
  const html = buildNotificationEmail(
    '&#128176;',
    'تحويل وارد إلى حسابك',
    'تم استلام تحويل بقيمة <strong>' + amount.toFixed(2) + '&nbsp;USDT</strong> في حسابك من المستخدم <strong>' + senderInfo + '</strong>.',
    '#22c55e',
    'تم الاستلام بنجاح',
    'success',
    [
      { label: 'المبلغ المستلم', value: amount.toFixed(2) + '&nbsp;USDT' },
      { label: 'المرسل', value: senderInfo },
      { label: 'رصيدك الجديد', value: newBalance.toFixed(2) + '&nbsp;USDT' },
      { label: 'رقم العملية', value: transferId.substring(0, 16) + '...' },
    ]
  )
  return sendEmailViaScript(receiverEmail, 'تم استلام تحويل - فوركس يمني', html)
}

// ===================== PIN RECOVERY EMAIL =====================

export async function sendPinRecoveryEmail(
  userEmail: string,
  userName: string,
  pin: string
): Promise<boolean> {
  const html = buildOtpEmail(
    'رمز PIN مؤقت لاستعادة الحساب',
    'تم إنشاء رمز PIN مؤقت لحسابك من قبل فريق الإدارة.<br>استخدم هذا الرمز لتسجيل الدخول بدلاً من كلمة المرور.<br>بعد تسجيل الدخول بنجاح، سيُطلب منك تغيير كلمة المرور فوراً.',
    pin,
    '#d4af37',
    'هذا الرمز صالح لمدة 30 دقيقة فقط ويُستخدم لمرة واحدة. إذا لم تطلب هذا الرمز، تواصل مع الإدارة فوراً.'
  )
  return sendEmailViaScript(userEmail, 'رمز PIN مؤقت - فوركس يمني', html)
}
