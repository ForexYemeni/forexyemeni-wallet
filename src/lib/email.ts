// ===================== EMAIL SERVICE (Google Apps Script - FREE) =====================
// Sends emails via a free Google Apps Script web app (no API keys needed)

const SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || ''
const EMAIL_SECRET = process.env.EMAIL_SECRET || 'fxwallet2024'

async function sendEmailViaScript(to: string, subject: string, htmlContent: string): Promise<boolean> {
  if (!SCRIPT_URL) {
    console.log('[EMAIL] Skipped - No GOOGLE_APPS_SCRIPT_URL configured. OTP for ' + to + ': WILL NOT BE SENT')
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

    // Google Apps Script might return HTML wrapping the JSON
    const responseText = await response.text()

    // Try to extract JSON from the response
    let jsonStr = responseText
    // If response contains HTML tags, try to extract the JSON part
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    let result: { success?: boolean; error?: string; message?: string }
    try {
      result = JSON.parse(jsonStr)
    } catch {
      console.error('[EMAIL] Could not parse response:', responseText.substring(0, 200))
      return false
    }

    if (result.success) {
      console.log('[EMAIL] Email sent successfully to ' + to)
      return true
    } else {
      console.error('[EMAIL] Script returned error:', result.error || result.message)
      return false
    }
  } catch (error) {
    console.error('[EMAIL] Failed to send email via script:', error instanceof Error ? error.message : String(error))
    return false
  }
}

// ===================== HTML TEMPLATE BUILDER =====================

function buildEmailHtml(content: { accentColor: string; title: string; description: string; otp: string; footerNote: string }): string {
  const c = content
  const year = new Date().getFullYear()
  return [
    '<div dir="rtl" style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">',
    '  <div style="text-align: center; margin-bottom: 24px;">',
    '    <h1 style="color: #d4af37; font-size: 24px; margin-bottom: 8px;">فوركس يمني</h1>',
    '    <p style="color: #888; font-size: 14px;">محفظة USDT الرقمية</p>',
    '  </div>',
    '  <div style="background: #1a1a2e; border-radius: 16px; padding: 24px; border: 1px solid ' + c.accentColor + '22;">',
    '    <h2 style="color: #fff; font-size: 18px; margin-bottom: 16px; text-align: center;">' + c.title + '</h2>',
    '    <p style="color: #aaa; font-size: 14px; text-align: center; margin-bottom: 20px;">' + c.description + '</p>',
    '    <div style="text-align: center; margin: 24px 0;">',
    '      <span style="background: ' + c.accentColor + '15; color: ' + c.accentColor + '; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 12px; border: 2px solid ' + c.accentColor + '44; font-family: monospace;">' + c.otp + '</span>',
    '    </div>',
    '    <p style="color: #666; font-size: 12px; text-align: center;">هذا الرمز صالح لمدة 10 دقائق فقط</p>',
    '  </div>',
    '  <div style="margin-top: 24px; text-align: center;">',
    '    <p style="color: #555; font-size: 12px;">' + c.footerNote + '</p>',
    '    <p style="color: #444; font-size: 11px; margin-top: 8px;">© ' + year + ' فوركس يمني - جميع الحقوق محفوظة</p>',
    '  </div>',
    '</div>'
  ].join('\n')
}

// ===================== PUBLIC FUNCTIONS =====================

export async function sendVerificationEmail(to: string, otp: string): Promise<boolean> {
  const htmlContent = buildEmailHtml({
    accentColor: '#d4af37',
    title: 'رمز التحقق',
    description: 'أدخل هذا الرمز لتفعيل بريدك الإلكتروني',
    otp: otp,
    footerNote: 'إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة',
  })

  return sendEmailViaScript(to, 'رمز التحقق - فوركس يمني', htmlContent)
}

export async function sendPasswordResetEmail(to: string, otp: string): Promise<boolean> {
  const htmlContent = buildEmailHtml({
    accentColor: '#ef4444',
    title: 'إعادة تعيين كلمة المرور',
    description: 'أدخل هذا الرمز لإعادة تعيين كلمة المرور',
    otp: otp,
    footerNote: 'إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة',
  })

  return sendEmailViaScript(to, 'إعادة تعيين كلمة المرور - فوركس يمني', htmlContent)
}

export async function sendPhoneVerificationEmail(to: string, phone: string, otp: string): Promise<boolean> {
  const htmlContent = buildEmailHtml({
    accentColor: '#3b82f6',
    title: 'التحقق من رقم الهاتف',
    description: 'أدخل رمز التحقق للرقم: <span style="color:#3b82f6;direction:ltr;font-weight:bold;">' + phone + '</span>',
    otp: otp,
    footerNote: 'إذا لم تطلب هذا التحقق، تجاهل هذه الرسالة',
  })

  return sendEmailViaScript(to, 'رمز التحقق من رقم الهاتف - فوركس يمني', htmlContent)
}
