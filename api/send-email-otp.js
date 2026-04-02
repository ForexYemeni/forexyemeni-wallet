// Vercel Serverless Function - Send Email via Gmail (OTP or Notification)
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { to, code, subject, message } = req.body;

        if (!to) {
            return res.status(400).json({ success: false, error: 'البريد الإلكتروني مطلوب' });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return res.status(400).json({ success: false, error: 'بريد إلكتروني غير صحيح' });
        }

        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'mshay2024m@gmail.com',
                pass: 'jcblznryzgbobxqs'
            }
        });

        // Determine if this is an OTP email or a notification email
        const isOtp = code && code.length > 0;
        const emailSubject = subject || 'رمز التحقق - ForexYemeni Wallet';
        const emailMessage = message || '';

        let htmlContent;
        if (isOtp) {
            htmlContent = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f9f9f9;font-family:system-ui,sans-serif;">
<div style="max-width:500px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
<div style="background:#0B0E11;color:white;padding:20px;text-align:center;">
<h1 style="margin:0;color:#F0B90B;font-size:20px;">🔐 رمز التحقق</h1>
<p style="margin:8px 0 0 0;color:#ccc;font-size:14px;">ForexYemeni Wallet</p></div>
<div style="padding:25px;text-align:center;">
<p style="font-size:15px;color:#333;margin-bottom:15px;">رمز التحقق الخاص بك:</p>
<div style="font-size:36px;font-weight:bold;color:#0B0E11;background:#F0B90B20;padding:15px 25px;border-radius:8px;letter-spacing:8px;">${code}</div>
<p style="color:#cc0000;font-size:13px;margin-top:15px;">⚠️ لا تشارك هذا الرمز مع أحد</p>
<p style="color:#999;font-size:12px;margin-top:10px;">هذا الرمز صالح لمدة 5 دقائق</p></div>
</div></body></html>`;
        } else {
            htmlContent = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f9f9f9;font-family:system-ui,sans-serif;">
<div style="max-width:500px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
<div style="background:#0B0E11;color:white;padding:20px;text-align:center;">
<h1 style="margin:0;color:#F0B90B;font-size:20px;">ForexYemeni Wallet</h1>
<p style="margin:8px 0 0 0;color:#ccc;font-size:14px;">محفظة العملات الرقمية الاحترافية</p></div>
<div style="padding:25px;text-align:center;">
<p style="font-size:15px;color:#333;margin-bottom:15px;">${emailMessage}</p>
<div style="margin-top:20px;padding-top:15px;border-top:1px solid #eee;">
<p style="color:#999;font-size:12px;">تم إرسال هذه الرسالة من ForexYemeni Wallet</p>
<p style="color:#999;font-size:11px;">إذا لم تقم بهذا الإجراء، تواصل مع الإدارة فوراً</p></div>
</div></div></body></html>`;
        }

        await transporter.sendMail({
            from: 'ForexYemeni Wallet <mshay2024m@gmail.com>',
            to: to,
            subject: emailSubject,
            html: htmlContent
        });

        console.log('Email sent to:', to, isOtp ? '(OTP)' : '(Notification)');
        return res.status(200).json({ success: true, type: isOtp ? 'otp' : 'notification', provider: 'gmail' });

    } catch (error) {
        console.error('Email Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
