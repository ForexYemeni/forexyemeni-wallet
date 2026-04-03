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

// ===================== PUBLIC FUNCTIONS =====================

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
