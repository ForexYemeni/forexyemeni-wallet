// ForexYemeni Wallet Service Worker v2.0
// Handles background notifications, PWA install, and offline support

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
var _lastNotifIds = [];
var _lastMsgIds = [];

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
        silent: false,
        vibrate: [300, 100, 300, 100, 300, 100, 300, 100, 500],
        data: data || {},
        actions: [
            { action: 'open', title: 'فتح التطبيق' },
            { action: 'dismiss', title: 'إغلاق' }
        ]
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

        var newNotifs = [];
        for (var i = 0; i < notifications.length; i++) {
            var n = notifications[i];
            if (n && n.userId === userId && !n.isRead && _lastNotifIds.indexOf(n.id) === -1) {
                newNotifs.push(n);
            }
        }

        if (newNotifs.length > 0) {
            console.log('[SW] New notifications:', newNotifs.length);
            _lastNotifIds = [];
            for (var j = 0; j < notifications.length; j++) {
                if (notifications[j] && notifications[j].userId === userId) {
                    _lastNotifIds.push(notifications[j].id);
                }
            }
            var latest = newNotifs[0];
            showNotification(
                latest.title || '🔔 ForexYemeni',
                latest.message || 'لديك إشعار جديد',
                'fy-notif-' + (latest.id || Date.now()),
                { type: latest.type || 'INFO' }
            );
        }
    }, function(err) {
        console.warn('[SW] Notifications listener error:', err);
    });

    // Listen for new messages
    db.collection('appData').doc('messages').onSnapshot(function(doc) {
        if (!doc.exists || !doc.data() || !doc.data().data) return;
        var messages = doc.data().data;
        if (!Array.isArray(messages)) return;

        var newMsgs = [];
        for (var i = 0; i < messages.length; i++) {
            var m = messages[i];
            if (m && m.toId === userId && !m.isRead && _lastMsgIds.indexOf(m.id) === -1) {
                newMsgs.push(m);
            }
        }

        if (newMsgs.length > 0) {
            console.log('[SW] New messages:', newMsgs.length);
            _lastMsgIds = [];
            for (var j = 0; j < messages.length; j++) {
                if (messages[j] && messages[j].toId === userId) {
                    _lastMsgIds.push(messages[j].id);
                }
            }
            var latest = newMsgs[0];
            showNotification(
                '💬 رسالة جديدة',
                (latest.text || '').substring(0, 100),
                'fy-msg-' + (latest.id || Date.now()),
                { type: 'CHAT' }
            );
        }
    }, function(err) {
        console.warn('[SW] Messages listener error:', err);
    });
}

function stopFirestoreListeners() {
    _userId = null;
    _lastNotifIds = [];
    _lastMsgIds = [];
}

// ==================== MESSAGE FROM MAIN PAGE ====================
self.addEventListener('message', function(event) {
    if (!event.data || !event.data.type) return;

    if (event.data.type === 'LOGIN' && event.data.userId) {
        var uid = event.data.userId;
        Promise.all([
            db.collection('appData').doc('notifications').get(),
            db.collection('appData').doc('messages').get()
        ]).then(function(results) {
            if (results[0].exists && results[0].data() && results[0].data().data) {
                var notifs = results[0].data().data;
                _lastNotifIds = [];
                if (Array.isArray(notifs)) {
                    for (var i = 0; i < notifs.length; i++) {
                        if (notifs[i] && notifs[i].userId === uid) _lastNotifIds.push(notifs[i].id);
                    }
                }
            }
            if (results[1].exists && results[1].data() && results[1].data().data) {
                var msgs = results[1].data().data;
                _lastMsgIds = [];
                if (Array.isArray(msgs)) {
                    for (var j = 0; j < msgs.length; j++) {
                        if (msgs[j] && msgs[j].toId === uid) _lastMsgIds.push(msgs[j].id);
                    }
                }
            }
            startFirestoreListeners(uid);
        }).catch(function(err) {
            console.warn('[SW] Failed to load initial state:', err);
            startFirestoreListeners(uid);
        });
    }

    if (event.data.type === 'LOGOUT') {
        stopFirestoreListeners();
    }

    if (event.data.type === 'PING') {
        event.ports[0].postMessage({ type: 'PONG' });
    }
});

// ==================== FCM BACKGROUND MESSAGES ====================
try {
    messaging.onBackgroundMessage(function(payload) {
        console.log('[SW] FCM Background:', payload);
        var title = (payload.data && payload.data.title) ? payload.data.title : '🔔 ForexYemeni';
        var body = (payload.data && payload.data.body) ? payload.data.body : 'لديك إشعار جديد';
        showNotification(title, body, 'fy-fcm-' + Date.now(), {});
    });
} catch(e) {
    console.warn('[SW] FCM error:', e);
}

// ==================== WEB PUSH ====================
self.addEventListener('push', function(event) {
    var data = { title: '🔔 ForexYemeni', body: 'لديك إشعار جديد' };
    try {
        if (event.data) {
            try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
        }
    } catch(e) {}
    event.waitUntil(
        showNotification(data.title || '🔔 ForexYemeni', data.body || 'لديك إشعار جديد', 'fy-push-' + Date.now(), {})
    );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    if (event.action === 'dismiss') return;

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

// ==================== SW INSTALL & ACTIVATE ====================
self.addEventListener('install', function(event) {
    console.log('[SW] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    console.log('[SW] Activated');
    event.waitUntil(clients.claim());
    // Restore session from IndexedDB
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        if (clientList.length === 0) {
            restoreSession();
        }
    });
});

// ==================== SESSION RESTORE ====================
function restoreSession() {
    try {
        var request = indexedDB.open('fy-wallet-db', 1);
        request.onupgradeneeded = function(e) {
            var idb = e.target.result;
            if (!idb.objectStoreNames.contains('session')) idb.createObjectStore('session');
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
                        console.log('[SW] Restored session:', getReq.result);
                        startFirestoreListeners(getReq.result);
                    }
                };
            } catch(err) {}
        };
    } catch(e) {}
}
