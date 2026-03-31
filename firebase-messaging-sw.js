// Firebase Service Worker - handles background notifications via Firestore listener
// This works even when the app is closed!

importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyD-WgZiMm2tCcLSy6e265F_u4yahaWlCd0",
    authDomain: "forexyemeni-wallet.firebaseapp.com",
    projectId: "forexyemeni-wallet",
    storageBucket: "forexyemeni-wallet.firebasestorage.app",
    messagingSenderId: "52486252073",
    appId: "1:52486252073:web:0e8e590a77ba0b82399e38"
});

var db = firebase.firestore();
var messaging = firebase.messaging();
var _userId = null;
var _unsubscribeNotifs = null;
var _unsubscribeMessages = null;
var _lastNotifCount = 0;
var _lastMsgCount = 0;
var _lastNotifIds = [];
var _lastMsgIds = [];

// ==================== NOTIFICATION SOUND ====================
var _notifSound = null;
function getNotifSound() {
    if (!_notifSound) {
        try {
            _notifSound = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
            _notifSound.volume = 1;
        } catch(e) {}
    }
    return _notifSound;
}

function playSound() {
    try {
        var ctx = new (self.AudioContext || self.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    } catch(e) {
        // AudioContext not available in SW, try Web Audio alternative
        try { self.registration.showNotification('🔔', { silent: false, vibrate: [200,100,200,100,200] }); } catch(e2) {}
    }
}

// ==================== SHOW NOTIFICATION ====================
function showNotification(title, body, tag, data) {
    return self.registration.showNotification(title, {
        body: body || '',
        icon: 'icon.png',
        badge: 'icon.png',
        dir: 'rtl',
        lang: 'ar',
        tag: tag || 'fy-' + Date.now(),
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data: data || {}
    });
}

// ==================== FIRESTORE LISTENERS (BACKGROUND) ====================
function startFirestoreListeners(userId) {
    if (!userId || userId === _userId) return;
    stopFirestoreListeners();
    _userId = userId;
    console.log('[SW] Starting Firestore listeners for user:', userId);

    // Listen for new notifications
    db.collection('appData').doc('notifications').onSnapshot(function(doc) {
        if (!doc.exists || !doc.data() || !doc.data().data) return;
        var notifications = doc.data().data;
        if (!Array.isArray(notifications)) return;

        // Find new notifications for this user
        var newNotifs = [];
        for (var i = 0; i < notifications.length; i++) {
            var n = notifications[i];
            if (n && n.userId === userId && !n.isRead && _lastNotifIds.indexOf(n.id) === -1) {
                newNotifs.push(n);
            }
        }

        if (newNotifs.length > 0) {
            console.log('[SW] New notifications for user:', newNotifs.length);
            // Update last seen IDs
            _lastNotifIds = [];
            for (var j = 0; j < notifications.length; j++) {
                if (notifications[j] && notifications[j].userId === userId) {
                    _lastNotifIds.push(notifications[j].id);
                }
            }

            // Show the latest notification
            var latest = newNotifs[0];
            showNotification(
                latest.title || 'ForexYemeni Wallet',
                latest.message || 'لديك إشعار جديد',
                'fy-notif-' + (latest.id || Date.now()),
                { type: latest.type || 'INFO', clickAction: '' }
            );
            playSound();
        }
    }, function(err) {
        console.warn('[SW] Notifications listener error:', err);
    });

    // Listen for new messages
    db.collection('appData').doc('messages').onSnapshot(function(doc) {
        if (!doc.exists || !doc.data() || !doc.data().data) return;
        var messages = doc.data().data;
        if (!Array.isArray(messages)) return;

        // Find new messages for this user
        var newMsgs = [];
        for (var i = 0; i < messages.length; i++) {
            var m = messages[i];
            if (m && m.toId === userId && !m.isRead && _lastMsgIds.indexOf(m.id) === -1) {
                newMsgs.push(m);
            }
        }

        if (newMsgs.length > 0) {
            console.log('[SW] New messages for user:', newMsgs.length);
            // Update last seen IDs
            _lastMsgIds = [];
            for (var j = 0; j < messages.length; j++) {
                if (messages[j] && messages[j].toId === userId) {
                    _lastMsgIds.push(messages[j].id);
                }
            }

            // Show the latest message notification
            var latest = newMsgs[0];
            var senderName = 'مستخدم';
            showNotification(
                '💬 رسالة جديدة',
                'رسالة من ' + senderName + ': ' + (latest.text || latest.message || '').substring(0, 80),
                'fy-msg-' + (latest.id || Date.now()),
                { type: 'CHAT', clickAction: '' }
            );
            playSound();
        }
    }, function(err) {
        console.warn('[SW] Messages listener error:', err);
    });
}

function stopFirestoreListeners() {
    _userId = null;
    _lastNotifIds = [];
    _lastMsgIds = [];
    console.log('[SW] Firestore listeners stopped');
}

// ==================== MESSAGE FROM MAIN PAGE ====================
self.addEventListener('message', function(event) {
    console.log('[SW] Message received:', event.data);

    if (!event.data || !event.data.type) return;

    if (event.data.type === 'LOGIN' && event.data.userId) {
        // Load existing notification/message IDs first, then start listening
        var uid = event.data.userId;

        // Fetch current state to know which notifications/messages are already seen
        Promise.all([
            db.collection('appData').doc('notifications').get(),
            db.collection('appData').doc('messages').get()
        ]).then(function(results) {
            // Save current notification IDs
            if (results[0].exists && results[0].data() && results[0].data().data) {
                var notifs = results[0].data().data;
                _lastNotifIds = [];
                if (Array.isArray(notifs)) {
                    for (var i = 0; i < notifs.length; i++) {
                        if (notifs[i] && notifs[i].userId === uid) {
                            _lastNotifIds.push(notifs[i].id);
                        }
                    }
                }
            }
            // Save current message IDs
            if (results[1].exists && results[1].data() && results[1].data().data) {
                var msgs = results[1].data().data;
                _lastMsgIds = [];
                if (Array.isArray(msgs)) {
                    for (var j = 0; j < msgs.length; j++) {
                        if (msgs[j] && msgs[j].toId === uid) {
                            _lastMsgIds.push(msgs[j].id);
                        }
                    }
                }
            }
            // Now start real-time listeners
            startFirestoreListeners(uid);
        }).catch(function(err) {
            console.warn('[SW] Failed to load initial state:', err);
            startFirestoreListeners(uid);
        });
    }

    if (event.data.type === 'LOGOUT') {
        stopFirestoreListeners();
    }

    // Keep-alive: respond to ping
    if (event.data.type === 'PING') {
        event.ports[0].postMessage({ type: 'PONG' });
    }
});

// ==================== FCM BACKGROUND MESSAGES ====================
try {
    messaging.onBackgroundMessage(function(payload) {
        console.log('[SW] FCM Background message:', payload);
        var title = payload.data && payload.data.title ? payload.data.title : 'ForexYemeni Wallet';
        var body = payload.data && payload.data.body ? payload.data.body : 'لديك إشعار جديد';
        showNotification(title, body, 'fy-fcm-' + Date.now(), {
            clickAction: payload.data && payload.data.clickAction ? payload.data.clickAction : ''
        });
        playSound();
    });
} catch(e) {
    console.warn('[SW] FCM onBackgroundMessage error:', e);
}

// ==================== WEB PUSH MESSAGES ====================
self.addEventListener('push', function(event) {
    console.log('[SW] Push event received');
    var data = { title: 'ForexYemeni Wallet', body: 'لديك إشعار جديد' };
    try {
        if (event.data) {
            try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
        }
    } catch(e) {}

    event.waitUntil(
        showNotification(data.title || 'ForexYemeni Wallet', data.body || 'لديك إشعار جديد', 'fy-push-' + Date.now(), { clickAction: data.clickAction || '' })
    );
    playSound();
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', function(event) {
    console.log('[SW] Notification clicked');
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url.indexOf('forexyemeni') !== -1 && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/forexyemeni-wallet.html');
            }
        })
    );
});

// ==================== AUTO-RESTORE SESSION ====================
// When SW wakes up, check if there's a saved session to restore listeners
self.addEventListener('activate', function(event) {
    console.log('[SW] Activated');
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // If there are open windows, the main page will send LOGIN message
            // Otherwise try to restore from IndexedDB
            if (clientList.length === 0) {
                restoreSession();
            }
        })
    );
});

function restoreSession() {
    try {
        // Try to read user ID from IndexedDB
        var request = indexedDB.open('fy-wallet-db', 1);
        request.onupgradeneeded = function(e) {
            var idb = e.target.result;
            if (!idb.objectStoreNames.contains('session')) {
                idb.createObjectStore('session');
            }
        };
        request.onsuccess = function(e) {
            var idb = e.target.result;
            if (!idb.objectStoreNames.contains('session')) return;
            try {
                var tx = idb.transaction('session', 'readonly');
                var store = tx.objectStore('session');
                var getReq = store.get('userId');
                getReq.onsuccess = function() {
                    if (getReq.result) {
                        console.log('[SW] Restored session for user:', getReq.result);
                        startFirestoreListeners(getReq.result);
                    }
                };
            } catch(err) {}
        };
    } catch(e) {}
}
