// Vercel Serverless Function - Send OTP SMS via Vonage (Nexmo)
// Runs on Vercel server - NO reCAPTCHA needed - 100% FREE during trial

const https = require('https');

function sendSMSVonage(to, code) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.VONAGE_API_KEY || 'NOT_SET';
        const apiSecret = process.env.VONAGE_API_SECRET || 'NOT_SET';
        const from = 'ForexYemeni';

        const postData = JSON.stringify({
            from: from,
            text: 'رمز التحقق الخاص بك في ForexYemeni Wallet: ' + code + '\n\nلا تشارك هذا الرمز مع أحد.',
            to: to,
            api_key: apiKey,
            api_secret: apiSecret
        });

        const options = {
            hostname: 'rest.nexmo.com',
            path: '/sms/json',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.messages && parsed.messages[0] && parsed.messages[0].status === '0') {
                        resolve({ success: true, provider: 'vonage' });
                    } else {
                        const errMsg = parsed.messages ? parsed.messages[0]['error-text'] : 'فشل إرسال SMS عبر Vonage';
                        reject(new Error(errMsg));
                    }
                } catch (e) {
                    reject(new Error('خطأ في تحليل استجابة Vonage: ' + data.substring(0, 200)));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

function sendSMSGmail(phone, code) {
    return new Promise((resolve, reject) => {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'mshay2024m@gmail.com',
                pass: 'jcblznryzgbobxqs'
            }
        });

        // Send notification to admin email with the code for manual forwarding
        transporter.sendMail({
            from: 'ForexYemeni Wallet <mshay2024m@gmail.com>',
            to: 'mshay2024m@gmail.com',
            subject: 'رمز SMS تحقق - ' + phone,
            html: `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f9f9f9;font-family:system-ui,sans-serif;">
<div style="max-width:500px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
<div style="background:#0B0E11;color:white;padding:20px;text-align:center;">
<h1 style="margin:0;color:#F0B90B;font-size:20px;">📱 طلب SMS تحقق</h1>
</div>
<div style="padding:25px;">
<p style="font-size:15px;color:#333;">تم طلب رمز تحقق للرقم:</p>
<p style="font-size:20px;font-weight:bold;color:#0B0E11;background:#f0f0f0;padding:15px;border-radius:8px;text-align:center;">${phone}</p>
<p style="font-size:15px;color:#333;margin-top:15px;">الرمز:</p>
<div style="font-size:36px;font-weight:bold;color:#0B0E11;background:#F0B90B20;padding:15px 25px;border-radius:8px;text-align:center;letter-spacing:8px;">${code}</div>
<p style="color:#cc0000;font-size:13px;margin-top:15px;">⚠️ أرسل هذا الرمز إلى العميل عبر SMS أو WhatsApp يدوياً</p>
</div>
</div>
</body></html>`
        }).then((info) => {
            resolve({ success: true, provider: 'gmail-fallback', note: 'تم إرسال الرمز لبريدك - أرسله للعميل يدوياً' });
        }).catch(reject);
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { to, code } = req.body;

        if (!to || !code) {
            return res.status(400).json({ success: false, error: 'رقم الهاتف ورمز التحقق مطلوبان' });
        }

        // Validate phone number format (accept 7-15 digits)
        const cleanPhone = String(to).replace(/[^0-9+]/g, '');
        if (!/^[\+]?[0-9]{7,15}$/.test(cleanPhone)) {
            return res.status(400).json({ success: false, error: 'رقم هاتف غير صحيح' });
        }

        // Strategy 1: Try Vonage (if API keys are set)
        const vonageKey = process.env.VONAGE_API_KEY;
        if (vonageKey && vonageKey !== 'NOT_SET') {
            try {
                const result = await sendSMSVonage(cleanPhone, code);
                console.log('SMS sent via Vonage to:', cleanPhone);
                return res.status(200).json({ success: true, ...result });
            } catch (vonageErr) {
                console.error('Vonage failed:', vonageErr.message);
                // Fall through to Gmail fallback
            }
        }

        // Strategy 2: Gmail fallback - send code to admin email for manual forwarding
        try {
            const result = await sendSMSGmail(cleanPhone, code);
            console.log('SMS fallback via Gmail for:', cleanPhone);
            return res.status(200).json({ success: true, ...result });
        } catch (gmailErr) {
            console.error('Gmail fallback failed:', gmailErr.message);
            return res.status(500).json({ success: false, error: 'فشل إرسال SMS: ' + gmailErr.message });
        }

    } catch (error) {
        console.error('SMS OTP Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
