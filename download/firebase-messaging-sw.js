// Firebase Cloud Messaging Service Worker
// This file handles background push notifications (FCM + Web Push)

importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyD-WgZiMm2tCcLSy6e265F_u4yahaWlCd0",
    authDomain: "forexyemeni-wallet.firebaseapp.com",
    projectId: "forexyemeni-wallet",
    storageBucket: "forexyemeni-wallet.firebasestorage.app",
    messagingSenderId: "52486252073",
    appId: "1:52486252073:web:0e8e590a77ba0b82399e38"
});

const messaging = firebase.messaging();

// ==================== FCM BACKGROUND MESSAGES ====================
messaging.onBackgroundMessage(function(payload) {
    console.log('[Firebase SW] Background message received:', payload);

    var notificationTitle = payload.data && payload.data.title ? payload.data.title : 'ForexYemeni Wallet';
    var notificationOptions = {
        body: payload.data && payload.data.body ? payload.data.body : 'لديك إشعار جديد',
        icon: 'icon.png',
        badge: 'icon.png',
        dir: 'rtl',
        lang: 'ar',
        tag: payload.data && payload.data.tag ? payload.data.tag : 'fy-notif-' + Date.now(),
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200, 100, 200]
    };

    if (payload.data && payload.data.clickAction) {
        notificationOptions.data = { clickAction: payload.data.clickAction };
    }

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==================== WEB PUSH MESSAGES ====================
self.addEventListener('push', function(event) {
    console.log('[SW] Push event received');

    var data = { title: 'ForexYemeni Wallet', body: 'لديك إشعار جديد' };

    try {
        if (event.data) {
            try {
                data = event.data.json();
            } catch(e) {
                data.body = event.data.text();
            }
        }
    } catch(e) {
        console.warn('[SW] Push data parse error:', e);
    }

    var notificationOptions = {
        body: data.body || 'لديك إشعار جديد',
        icon: 'icon.png',
        badge: 'icon.png',
        dir: 'rtl',
        lang: 'ar',
        tag: data.tag || 'fy-push-' + Date.now(),
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data: { clickAction: data.clickAction || '' }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'ForexYemeni Wallet', notificationOptions)
    );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', function(event) {
    console.log('[SW] Notification clicked:', event);
    event.notification.close();

    var clickAction = '/forexyemeni-wallet.html';
    if (event.notification.data && event.notification.data.clickAction) {
        clickAction = event.notification.data.clickAction;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // If app is already open, focus it
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url.indexOf('forexyemeni') !== -1 && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            if (clients.openWindow) {
                return clients.openWindow(clickAction);
            }
        })
    );
});
