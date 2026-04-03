// Vercel Serverless Function - Send FCM Push Notifications
// This sends push notifications FROM THE SERVER so they work even when app is closed/swiped

const https = require('https');

function sendFCM(serverKey, tokens, title, body, data) {
    return new Promise((resolve, reject) => {
        if (!tokens || tokens.length === 0) {
            return resolve({ success: false, error: 'No FCM tokens' });
        }

        const message = {
            registration_ids: tokens.slice(0, 500), // FCM supports max 500 per request
            notification: {
                title: title,
                body: body,
                icon: 'icon.png',
                badge: 'icon.png',
                sound: 'default',
                vibration_pattern: [300, 100, 300, 100, 300],
                tag: 'fy-' + Date.now(),
                require_interaction: true,
                click_action: '/forexyemeni-wallet.html'
            },
            data: Object.assign({ click_action: '/forexyemeni-wallet.html' }, data || {}),
            priority: 'high',
            content_available: true,
            mutable_content: true,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channel_id: 'fy-notifications',
                    vibration_pattern: [300, 100, 300, 100, 300],
                    default_vibrate_timings: true
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        'content-available': 1,
                        'mutable-content': 1
                    }
                }
            }
        };

        const postData = JSON.stringify(message);
        const options = {
            hostname: 'fcm.googleapis.com',
            path: '/fcm/send',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': 'key=' + serverKey
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('FCM parse error: ' + data.substring(0, 200)));
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('FCM timeout')); });
        req.write(postData);
        req.end();
    });
}

module.exports = async (req, res) => {
    // Allow CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { userId, tokens, title, body, type, data } = req.body;

        if ((!userId && (!tokens || tokens.length === 0)) || !title || !body) {
            return res.status(400).json({ success: false, error: 'userId (or tokens), title, and body are required' });
        }

        const serverKey = process.env.FCM_SERVER_KEY;
        if (!serverKey) {
            console.log('⚠️ FCM_SERVER_KEY not set - push notification skipped');
            return res.status(200).json({ success: false, error: 'FCM_SERVER_KEY not configured' });
        }

        let targetTokens = tokens || [];

        // If userId provided but no tokens, we can't do anything here
        // (tokens should be fetched from Firestore on the client side)
        if (targetTokens.length === 0) {
            return res.status(200).json({ success: false, error: 'No tokens provided' });
        }

        const result = await sendFCM(serverKey, targetTokens, title, body, data || { type: type || 'INFO' });
        console.log('FCM result:', JSON.stringify(result).substring(0, 200));
        return res.status(200).json(result);

    } catch (error) {
        console.error('Push notification error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};
