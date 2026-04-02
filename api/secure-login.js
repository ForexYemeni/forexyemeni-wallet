// Secure Login API - Server-side authentication with brute-force protection
// ALL credential validation happens HERE - browser cannot bypass
const crypto = require('crypto');
const { getUsers, saveUsers, getCollection, saveCollection } = require('./_lib/session');

// ==================== CONSTANTS ====================
var ADMIN_PHONE = '+967773178684';
var MAX_ATTEMPTS = 5;
var LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ==================== HELPERS ====================

/**
 * SHA-256 hash with salt for password comparison
 */
function hashPassword(pass) {
    return crypto.createHash('sha256').update('fy_salt_' + pass).digest('hex');
}

/**
 * Match a phone number by full match OR last 9 digits
 */
function phoneMatch(inputPhone, storedPhone) {
    if (!inputPhone || !storedPhone) return false;
    // Normalize: remove spaces, dashes
    var a = inputPhone.replace(/[\s\-]/g, '');
    var b = storedPhone.replace(/[\s\-]/g, '');
    // Full match
    if (a === b) return true;
    // Last 9 digits match
    if (a.length >= 9 && b.length >= 9) {
        var lastA = a.slice(-9);
        var lastB = b.slice(-9);
        if (lastA === lastB) return true;
    }
    return false;
}

/**
 * Generate a session ID
 */
function createSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

/**
 * Extract client IP from Vercel request
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.socket.remoteAddress ||
           'unknown';
}

// ==================== MAIN HANDLER ====================

module.exports = async function handler(req, res) {
    // Only POST allowed
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    }

    var body = req.body || {};
    var inputVal = (body.inputVal || '').trim();
    var pass = (body.pass || '').trim();

    // ==================== INPUT VALIDATION ====================
    if (!inputVal) {
        return res.status(400).json({ success: false, error: 'أدخل رقم الهاتف أو البريد الإلكتروني', code: 'MISSING_INPUT' });
    }
    if (!pass) {
        return res.status(400).json({ success: false, error: 'أدخل كلمة المرور', code: 'MISSING_PASSWORD' });
    }

    // Rate limit: block very long inputs early
    if (inputVal.length > 100 || pass.length > 100) {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة', code: 'INVALID_INPUT' });
    }

    var clientIp = getClientIp(req);
    var now = Date.now();

    // ==================== BRUTE FORCE PROTECTION ====================
    try {
        var attempts = await getCollection('loginAttempts');
        if (!Array.isArray(attempts)) attempts = [];

        // Filter attempts for this inputVal within the lockout window
        var relevantAttempts = [];
        for (var i = 0; i < attempts.length; i++) {
            var att = attempts[i];
            if (att.inputVal === inputVal && (now - att.timestamp) < LOCKOUT_MS) {
                relevantAttempts.push(att);
            }
        }

        // Count recent failed attempts
        var failedCount = 0;
        for (var j = 0; j < relevantAttempts.length; j++) {
            if (relevantAttempts[j].success === false) {
                failedCount++;
            }
        }

        // Check if locked out
        if (failedCount >= MAX_ATTEMPTS) {
            // Find the latest failed attempt to calculate remaining time
            var latestFailed = 0;
            for (var k = 0; k < relevantAttempts.length; k++) {
                if (relevantAttempts[k].success === false && relevantAttempts[k].timestamp > latestFailed) {
                    latestFailed = relevantAttempts[k].timestamp;
                }
            }
            var remaining = Math.ceil((LOCKOUT_MS - (now - latestFailed)) / 1000);
            if (remaining < 0) remaining = 0;

            return res.status(429).json({
                success: false,
                error: 'تم قفل الحساب بسبب محاولات فاشلة متعددة. حاول مرة أخرى بعد ' + remaining + ' ثانية',
                code: 'LOCKED',
                remaining: remaining
            });
        }
    } catch (err) {
        console.error('[Login] Brute force check error:', err.message);
        // Continue with login even if tracking fails (fail-open for availability)
        var attempts = [];
    }

    // ==================== LOAD USERS ====================
    var users;
    try {
        users = await getUsers();
    } catch (err) {
        console.error('[Login] Firestore error:', err.message);
        return res.status(500).json({ success: false, error: 'خطأ في الاتصال بالخادم', code: 'SERVER_ERROR' });
    }

    if (!Array.isArray(users) || users.length === 0) {
        // Log failed attempt
        await logAttempt(attempts, inputVal, false, null, clientIp);
        return res.status(401).json({ success: false, error: 'رقم الهاتف أو البريد الإلكتروني أو كلمة المرور غير صحيحة', code: 'INVALID_CREDENTIALS' });
    }

    // ==================== FIND USER ====================
    var matchedUser = null;
    var inputIsEmail = inputVal.includes('@');

    for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (inputIsEmail) {
            // Match by email (case-insensitive)
            if (u.email && u.email.toLowerCase() === inputVal.toLowerCase()) {
                matchedUser = u;
                break;
            }
        } else {
            // Match by phone (full or last 9 digits)
            if (phoneMatch(inputVal, u.phone)) {
                matchedUser = u;
                break;
            }
            // Also try matching by email in case user typed email without @
            if (u.email && u.email.toLowerCase() === inputVal.toLowerCase()) {
                matchedUser = u;
                break;
            }
        }
    }

    if (!matchedUser) {
        await logAttempt(attempts, inputVal, false, null, clientIp);
        return res.status(401).json({ success: false, error: 'رقم الهاتف أو البريد الإلكتروني أو كلمة المرور غير صحيحة', code: 'INVALID_CREDENTIALS' });
    }

    // ==================== CHECK BLOCKED ====================
    if (matchedUser.isBlocked) {
        var blockReason = matchedUser.blockReason || 'تم حظر هذا الحساب';
        return res.status(403).json({ success: false, error: blockReason, code: 'ACCOUNT_BLOCKED' });
    }

    // ==================== PASSWORD CHECK ====================
    var storedPass = matchedUser.password || '';
    var inputHash = hashPassword(pass);
    var passwordValid = false;

    // Method 1: Hashed comparison (stored password looks like a SHA-256 hex hash)
    if (storedPass.length === 64 && /^[a-f0-9]+$/.test(storedPass)) {
        // Stored password appears to be a hash - compare hashes
        passwordValid = (inputHash === storedPass);
    }

    // Method 2: Plain text fallback
    if (!passwordValid && !storedPass.includes('fy_salt_')) {
        // Stored password does NOT contain 'fy_salt' - compare directly
        passwordValid = (pass === storedPass);
    }

    // Method 3: Direct hash comparison regardless
    if (!passwordValid) {
        passwordValid = (inputHash === storedPass);
    }

    if (!passwordValid) {
        await logAttempt(attempts, inputVal, false, matchedUser, clientIp);
        return res.status(401).json({ success: false, error: 'رقم الهاتف أو البريد الإلكتروني أو كلمة المرور غير صحيحة', code: 'INVALID_CREDENTIALS' });
    }

    // ==================== LOGIN SUCCESSFUL ====================

    // Clear failed attempts for this inputVal
    try {
        var cleanedAttempts = [];
        for (var c = 0; c < attempts.length; c++) {
            if (attempts[c].inputVal !== inputVal) {
                cleanedAttempts.push(attempts[c]);
            }
        }
        await saveCollection('loginAttempts', cleanedAttempts);
    } catch (err) {
        console.error('[Login] Clear attempts error:', err.message);
    }

    // Create session
    var sessionId = createSessionId();

    // Update user with session in Firestore
    try {
        var userIndex = -1;
        for (var i = 0; i < users.length; i++) {
            if (users[i].id === matchedUser.id) { userIndex = i; break; }
        }
        if (userIndex >= 0) {
            users[userIndex].sessionId = sessionId;
            users[userIndex].lastLogin = new Date().toISOString();
            users[userIndex].lastLoginIp = clientIp;
            await saveUsers(users);
        }
    } catch (err) {
        console.error('[Login] Save session error:', err.message);
        return res.status(500).json({ success: false, error: 'خطأ في حفظ الجلسة', code: 'SESSION_SAVE_ERROR' });
    }

    // Save to audit log
    try {
        var auditLog = await getCollection('auditLog');
        if (!Array.isArray(auditLog)) auditLog = [];
        auditLog.unshift({
            action: 'LOGIN',
            userId: matchedUser.id,
            userName: matchedUser.name || '',
            userRole: matchedUser.role || 'USER',
            userPhone: matchedUser.phone || '',
            ip: clientIp,
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            status: 'SUCCESS'
        });
        // Keep audit log trimmed (max 1000 entries)
        if (auditLog.length > 1000) auditLog = auditLog.slice(0, 1000);
        await saveCollection('auditLog', auditLog);
    } catch (err) {
        console.error('[Login] Audit log error:', err.message);
        // Don't fail the login if audit log fails
    }

    // ==================== RETURN SUCCESS ====================
    return res.json({
        success: true,
        user: {
            id: matchedUser.id,
            name: matchedUser.name || '',
            role: matchedUser.role || 'USER',
            sessionId: sessionId,
            passwordMustChange: matchedUser.passwordMustChange || false,
            merchantStatus: matchedUser.merchantStatus || 'NONE',
            kycStatus: matchedUser.kycStatus || 'NOT_SUBMITTED'
        }
    });
};

// ==================== UTILITY: Log attempt ====================
async function logAttempt(attempts, inputVal, success, user, ip) {
    try {
        if (!Array.isArray(attempts)) attempts = [];
        var entry = {
            inputVal: inputVal,
            success: success,
            timestamp: Date.now(),
            ip: ip,
            userId: user ? user.id : null,
            timestampISO: new Date().toISOString()
        };
        attempts.push(entry);

        // Keep only last 100 attempts total (prevent unbounded growth)
        if (attempts.length > 100) {
            attempts = attempts.slice(-100);
        }
        await saveCollection('loginAttempts', attempts);

        // Also log failed attempt to audit log
        if (!success) {
            var auditLog = await getCollection('auditLog');
            if (!Array.isArray(auditLog)) auditLog = [];
            auditLog.unshift({
                action: 'LOGIN_FAILED',
                inputVal: inputVal,
                userId: user ? user.id : null,
                ip: ip,
                timestamp: new Date().toISOString(),
                status: 'FAILED'
            });
            if (auditLog.length > 1000) auditLog = auditLog.slice(0, 1000);
            await saveCollection('auditLog', auditLog);
        }
    } catch (err) {
        console.error('[Login] Log attempt error:', err.message);
    }
}
