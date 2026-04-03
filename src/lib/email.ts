import { Resend } from 'resend'

let resendInstance: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}

export async function sendVerificationEmail(to: string, otp: string): Promise<boolean> {
  try {
    const resend = getResend()
    if (!resend) {
      console.log('[EMAIL] Skipped - No RESEND_API_KEY. OTP for ' + to + ': ' + otp)
      return false
    }

    const htmlContent = [
      '<div dir="rtl" style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">',
      '  <div style="text-align: center; margin-bottom: 24px;">',
      '    <h1 style="color: #d4af37; font-size: 24px; margin-bottom: 8px;">فوركس يمني</h1>',
      '    <p style="color: #888; font-size: 14px;">محفظة USDT الرقمية</p>',
      '  </div>',
      '  <div style="background: #1a1a2e; border-radius: 16px; padding: 24px; border: 1px solid rgba(212,175,55,0.2);">',
      '    <h2 style="color: #fff; font-size: 18px; margin-bottom: 16px; text-align: center;">رمز التحقق</h2>',
      '    <p style="color: #aaa; font-size: 14px; text-align: center; margin-bottom: 20px;">أدخل هذا الرمز لتفعيل بريدك الإلكتروني</p>',
      '    <div style="text-align: center; margin: 24px 0;">',
      '      <span style="background: rgba(212,175,55,0.15); color: #d4af37; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 12px; border: 2px solid rgba(212,175,55,0.3); font-family: monospace;">' + otp + '</span>',
      '    </div>',
      '    <p style="color: #666; font-size: 12px; text-align: center;">هذا الرمز صالح لمدة 10 دقائق فقط</p>',
      '  </div>',
      '  <div style="margin-top: 24px; text-align: center;">',
      '    <p style="color: #555; font-size: 12px;">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة</p>',
      '    <p style="color: #444; font-size: 11px; margin-top: 8px;">© ' + new Date().getFullYear() + ' فوركس يمني - جميع الحقوق محفوظة</p>',
      '  </div>',
      '</div>'
    ].join('\n')

    await resend.emails.send({
      from: 'ForexYemeni Wallet <onboarding@resend.dev>',
      to,
      subject: 'رمز التحقق - فوركس يمني',
      html: htmlContent,
    })

    console.log('[EMAIL] Verification OTP sent to ' + to)
    return true
  } catch (error) {
    console.error('[EMAIL] Failed to send:', error)
    return false
  }
}

export async function sendPasswordResetEmail(to: string, otp: string): Promise<boolean> {
  try {
    const resend = getResend()
    if (!resend) {
      console.log('[EMAIL] Skipped - No RESEND_API_KEY. OTP for ' + to + ': ' + otp)
      return false
    }

    const htmlContent = [
      '<div dir="rtl" style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">',
      '  <div style="text-align: center; margin-bottom: 24px;">',
      '    <h1 style="color: #d4af37; font-size: 24px; margin-bottom: 8px;">فوركس يمني</h1>',
      '    <p style="color: #888; font-size: 14px;">محفظة USDT الرقمية</p>',
      '  </div>',
      '  <div style="background: #1a1a2e; border-radius: 16px; padding: 24px; border: 1px solid rgba(239,68,68,0.2);">',
      '    <h2 style="color: #fff; font-size: 18px; margin-bottom: 16px; text-align: center;">إعادة تعيين كلمة المرور</h2>',
      '    <p style="color: #aaa; font-size: 14px; text-align: center; margin-bottom: 20px;">أدخل هذا الرمز لإعادة تعيين كلمة المرور</p>',
      '    <div style="text-align: center; margin: 24px 0;">',
      '      <span style="background: rgba(239,68,68,0.15); color: #ef4444; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 12px; border: 2px solid rgba(239,68,68,0.3); font-family: monospace;">' + otp + '</span>',
      '    </div>',
      '    <p style="color: #666; font-size: 12px; text-align: center;">هذا الرمز صالح لمدة 10 دقائق فقط</p>',
      '  </div>',
      '  <div style="margin-top: 24px; text-align: center;">',
      '    <p style="color: #555; font-size: 12px;">إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة</p>',
      '    <p style="color: #444; font-size: 11px; margin-top: 8px;">© ' + new Date().getFullYear() + ' فوركس يمني - جميع الحقوق محفوظة</p>',
      '  </div>',
      '</div>'
    ].join('\n')

    await resend.emails.send({
      from: 'ForexYemeni Wallet <onboarding@resend.dev>',
      to,
      subject: 'إعادة تعيين كلمة المرور - فوركس يمني',
      html: htmlContent,
    })

    console.log('[EMAIL] Password reset OTP sent to ' + to)
    return true
  } catch (error) {
    console.error('[EMAIL] Failed to send:', error)
    return false
  }
}

export async function sendPhoneVerificationEmail(to: string, phone: string, otp: string): Promise<boolean> {
  try {
    const resend = getResend()
    if (!resend) {
      console.log('[EMAIL] Skipped - No RESEND_API_KEY. Phone OTP for ' + to + ': ' + otp)
      return false
    }

    const htmlContent = [
      '<div dir="rtl" style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">',
      '  <div style="text-align: center; margin-bottom: 24px;">',
      '    <h1 style="color: #d4af37; font-size: 24px; margin-bottom: 8px;">فوركس يمني</h1>',
      '    <p style="color: #888; font-size: 14px;">محفظة USDT الرقمية</p>',
      '  </div>',
      '  <div style="background: #1a1a2e; border-radius: 16px; padding: 24px; border: 1px solid rgba(59,130,246,0.2);">',
      '    <h2 style="color: #fff; font-size: 18px; margin-bottom: 16px; text-align: center;">التحقق من رقم الهاتف</h2>',
      '    <p style="color: #aaa; font-size: 14px; text-align: center; margin-bottom: 8px;">طلب التحقق من الرقم:</p>',
      '    <p style="color: #3b82f6; font-size: 16px; text-align: center; font-weight: bold; margin-bottom: 20px; direction: ltr;">' + phone + '</p>',
      '    <div style="text-align: center; margin: 24px 0;">',
      '      <span style="background: rgba(59,130,246,0.15); color: #3b82f6; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 12px; border: 2px solid rgba(59,130,246,0.3); font-family: monospace;">' + otp + '</span>',
      '    </div>',
      '    <p style="color: #666; font-size: 12px; text-align: center;">هذا الرمز صالح لمدة 10 دقائق فقط</p>',
      '  </div>',
      '  <div style="margin-top: 24px; text-align: center;">',
      '    <p style="color: #555; font-size: 12px;">إذا لم تطلب هذا التحقق، تجاهل هذه الرسالة</p>',
      '    <p style="color: #444; font-size: 11px; margin-top: 8px;">© ' + new Date().getFullYear() + ' فوركس يمني - جميع الحقوق محفوظة</p>',
      '  </div>',
      '</div>'
    ].join('\n')

    await resend.emails.send({
      from: 'ForexYemeni Wallet <onboarding@resend.dev>',
      to,
      subject: 'رمز التحقق من رقم الهاتف - فوركس يمني',
      html: htmlContent,
    })

    console.log('[EMAIL] Phone verification OTP sent to ' + to + ' for phone ' + phone)
    return true
  } catch (error) {
    console.error('[EMAIL] Failed to send:', error)
    return false
  }
}
