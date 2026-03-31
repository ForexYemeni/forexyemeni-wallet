// ==================== Firebase Cloud Functions ====================
// This sends push notifications when events happen in the app
// Deploy with: firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// ========================================
// Trigger: New push notification queued
// ========================================
exports.sendPushNotification = functions.firestore
    .document('pushQueue/{pushId}')
    .onCreate(async (snap, context) => {
        const pushData = snap.data();
        
        if (!pushData || !pushData.userId || !pushData.title) {
            console.log('Invalid push data, deleting...');
            return snap.ref.delete();
        }

        // Don't send if already processed
        if (pushData.processed) {
            return null;
        }

        try {
            // Get user's FCM tokens
            const userDoc = await db.collection('fcmTokens').doc(pushData.userId).get();
            
            if (!userDoc.exists) {
                console.log('No FCM tokens for user:', pushData.userId);
                return snap.ref.delete();
            }

            const tokens = userDoc.data().tokens || [];
            
            if (tokens.length === 0) {
                console.log('Empty tokens array for user:', pushData.userId);
                return snap.ref.delete();
            }

            // Filter out invalid tokens
            const validTokens = tokens.filter(t => t && typeof t === 'string' && t.length > 10);
            
            if (validTokens.length === 0) {
                console.log('No valid tokens for user:', pushData.userId);
                return snap.ref.delete();
            }

            // Build message
            const message = {
                notification: {
                    title: pushData.title,
                    body: pushData.body || pushData.message || '',
                },
                data: {
                    title: pushData.title,
                    body: pushData.body || pushData.message || '',
                    type: pushData.type || 'INFO',
                    userId: pushData.userId,
                    clickAction: pushData.clickAction || '/forexyemeni-wallet.html',
                    tag: 'fy-notif-' + Date.now(),
                },
                webpush: {
                    notification: {
                        icon: '/icon.png',
                        badge: '/icon.png',
                        dir: 'rtl',
                        lang: 'ar',
                        requireInteraction: true,
                        vibrate: [200, 100, 200, 100, 200, 100, 200],
                    },
                    fcm_options: {
                        link: pushData.clickAction || '/forexyemeni-wallet.html'
                    }
                },
                tokens: validTokens
            };

            // Send multicast
            const response = await admin.messaging().sendMulticast(message);
            console.log('Push sent: ' + response.successCount + ' success, ' + response.failureCount + ' failures');

            // Clean up invalid tokens
            if (response.failureCount > 0) {
                const invalidTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error) {
                        const errCode = resp.error.code;
                        if (errCode === 'messaging/invalid-registration-token' || 
                            errCode === 'messaging/registration-token-not-registered') {
                            invalidTokens.push(validTokens[idx]);
                        }
                    }
                });

                if (invalidTokens.length > 0) {
                    const updatedTokens = tokens.filter(t => !invalidTokens.includes(t));
                    await db.collection('fcmTokens').doc(pushData.userId).set({
                        tokens: updatedTokens,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('Cleaned ' + invalidTokens.length + ' invalid tokens');
                }
            }

            // Mark as processed and delete
            await snap.ref.update({ processed: true });
            await snap.ref.delete();

        } catch (error) {
            console.error('Error sending push notification:', error);
            // Mark as processed to avoid retry loop
            await snap.ref.update({ processed: true, error: error.message });
            await snap.ref.delete();
        }
    });

// ========================================
// Trigger: Delete old notifications (cleanup)
// Runs daily at 3 AM UTC
// ========================================
exports.cleanupOldNotifications = functions.pubsub
    .schedule('0 3 * * *')
    .timeZone('Asia/Aden')
    .onRun(async (context) => {
        try {
            // Clean push queue items older than 1 hour
            const queueSnap = await db.collection('pushQueue').get();
            const batch = db.batch();
            let count = 0;
            queueSnap.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt ? data.createdAt.toDate() : new Date(0);
                const oneHourAgo = new Date(Date.now() - 3600000);
                if (createdAt < oneHourAgo || data.processed) {
                    batch.delete(doc.ref);
                    count++;
                }
            });
            if (count > 0) await batch.commit();
            console.log('Cleaned ' + count + ' old push queue items');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });
