// Session & data validation middleware for secure API routes
// Uses Firestore REST API - no firebase-admin SDK needed (FREE)
const { readDoc, writeDoc } = require('./firebase');

/**
 * Validate user session and return user data
 * Checks sessionId from request against sessionId stored in Firestore
 */
async function validateSession(userId, sessionId) {
    if (!userId || !sessionId) {
        return { valid: false, error: 'بيانات الجلسة مفقودة' };
    }

    try {
        var docData = await readDoc('appData', 'users');
        if (!docData || !docData.data) {
            return { valid: false, error: 'قاعدة البيانات غير متاحة' };
        }

        var users = docData.data;
        // Handle case where data might be nested
        if (!Array.isArray(users)) {
            users = Array.isArray(docData) ? docData : [];
        }

        var user = null;
        for (var i = 0; i < users.length; i++) {
            if (users[i].id === userId) { user = users[i]; break; }
        }

        if (!user) {
            return { valid: false, error: 'المستخدم غير موجود' };
        }

        if (user.isBlocked) {
            return { valid: false, error: 'هذا الحساب محظور' };
        }

        // ADMIN users: allow multiple sessions
        if (user.role === 'ADMIN') {
            return { valid: true, user: user, allUsers: users };
        }

        // Regular users: must match session
        if (!user.sessionId || user.sessionId !== sessionId) {
            return { valid: false, error: 'جلسة غير صالحة - تم تسجيل الدخول من جهاز آخر' };
        }

        return { valid: true, user: user, allUsers: users };
    } catch (error) {
        console.error('[Session] Validation error:', error.message);
        return { valid: false, error: 'خطأ في التحقق من الجلسة' };
    }
}

/**
 * Validate admin access
 */
async function validateAdmin(userId, sessionId) {
    var result = await validateSession(userId, sessionId);
    if (!result.valid) return result;
    if (result.user.role !== 'ADMIN') {
        return { valid: false, error: 'صلاحيات المدير مطلوبة' };
    }
    return result;
}

/**
 * Get setting from Firestore (server-side)
 */
async function getSetting(key) {
    try {
        var docData = await readDoc('appData', 'settings');
        if (!docData) return '';
        var settings = docData.data || {};
        return settings[key] || '';
    } catch (error) {
        console.error('[Settings] Error:', error.message);
        return '';
    }
}

/**
 * Get users array from Firestore (server-side)
 */
async function getUsers() {
    try {
        var docData = await readDoc('appData', 'users');
        if (!docData || !docData.data) return [];
        return docData.data;
    } catch (error) {
        console.error('[Users] Error:', error.message);
        return [];
    }
}

/**
 * Save users array to Firestore (server-side)
 */
async function saveUsers(users) {
    return await writeDoc('appData', 'users', { data: users });
}

/**
 * Get collection data from Firestore (server-side)
 */
async function getCollection(key) {
    try {
        var docData = await readDoc('appData', key);
        if (!docData || !docData.data) return [];
        return docData.data;
    } catch (error) {
        console.error('[GetCollection] Error:', key, error.message);
        return [];
    }
}

/**
 * Save collection data to Firestore (server-side)
 */
async function saveCollection(key, data) {
    return await writeDoc('appData', key, { data: data });
}

/**
 * Generate unique ID
 */
function uid() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Express-like middleware wrapper - validates session before handler
 */
function withSession(handler) {
    return async function(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        var body = req.body || {};
        var userId = body.userId;
        var sessionId = body.sessionId;

        var session = await validateSession(userId, sessionId);

        if (!session.valid) {
            return res.status(401).json({
                success: false,
                error: session.error,
                code: 'SESSION_INVALID'
            });
        }

        req.sessionUser = session.user;
        req.allUsers = session.allUsers;
        return handler(req, res);
    };
}

/**
 * Admin-only middleware wrapper
 */
function withAdmin(handler) {
    return async function(req, res) {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        var body = req.body || {};
        var userId = body.userId;
        var sessionId = body.sessionId;

        var session = await validateAdmin(userId, sessionId);

        if (!session.valid) {
            return res.status(403).json({
                success: false,
                error: session.error,
                code: 'ADMIN_REQUIRED'
            });
        }

        req.sessionUser = session.user;
        req.allUsers = session.allUsers;
        return handler(req, res);
    };
}

module.exports = {
    validateSession: validateSession,
    validateAdmin: validateAdmin,
    getSetting: getSetting,
    getUsers: getUsers,
    saveUsers: saveUsers,
    getCollection: getCollection,
    saveCollection: saveCollection,
    uid: uid,
    withSession: withSession,
    withAdmin: withAdmin
};
