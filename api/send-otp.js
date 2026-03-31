// Vercel Serverless Function - Send OTP Email via Gmail SMTP
// This runs on Vercel server (no CORS, no domain restrictions, 100% FREE)

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mshay2024m@gmail.com',
        pass: 'jcblznryzgbobxqs'
    }
});

module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { to, code } = req.body;

        if (!to || !code) {
            return res.status(400).json({ success: false, error: 'البريد ورمز التحقق مطلوبان' });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return res.status(400).json({ success: false, error: 'بريد إلكتروني غير صحيح' });
        }

        await transporter.verify();

        const info = await transporter.sendMail({
            from: 'ForexYemeni Wallet <mshay2024m@gmail.com>',
            to: to,
            subject: 'رمز التحقق - ForexYemeni Wallet',
            html: `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f9f9f9;font-family:system-ui,sans-serif;">
<div style="max-width:500px;margin:20px auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
<div style="background:#0B0E11;color:white;padding:25px;text-align:center;">
<h1 style="margin:0;color:#F0B90B;font-size:24px;">🔐 ForexYemeni Wallet</h1>
<p style="margin:8px 0 0;color:#aaa;font-size:14px;">رمز التحقق</p>
</div>
<div style="background:white;padding:35px 25px;text-align:center;">
<p style="font-size:16px;color:#333;margin-bottom:5px;">مرحباً،</p>
<p style="font-size:16px;color:#333;margin-bottom:20px;">رمز التحقق الخاص بك هو:</p>
<div style="font-size:40px;font-weight:bold;color:#0B0E11;background:#f0f0f0;padding:20px 35px;border-radius:12px;letter-spacing:10px;display:inline-block;border:2px dashed #F0B90B;">${code}</div>
<p style="color:#888;margin-top:25px;font-size:14px;">هذا الرمز صالح لمدة 5 دقائق</p>
<p style="color:#cc0000;font-size:13px;margin-top:15px;">⚠️ إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة</p>
</div>
<div style="background:#f9f9f9;padding:15px 25px;text-align:center;border-top:1px solid #eee;">
<p style="color:#aaa;font-size:12px;margin:0;">ForexYemeni Wallet &copy; ${new Date().getFullYear()}</p>
</div>
</div>
</body></html>`
        });

        console.log('OTP sent:', info.messageId);
        return res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('OTP Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
