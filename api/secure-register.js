// Secure Register API - Server-side user registration with role protection
// SECURITY: This endpoint NEVER accepts a role parameter. Role is ALWAYS forced to 'USER'.
// Prevents admin account creation, role escalation, and duplicate accounts.
const crypto = require('crypto');
const { getUsers, saveUsers, saveCollection, getCollection, uid } = require('./_lib/session');

// ==================== CONSTANTS ====================
var ALLOWED_ROLES = ['USER']; // ONLY role allowed from this endpoint

// ==================== HELPERS ====================

/**
 * SHA-256 hash with salt for password storage
 */
function hashPassword(pass) {
    return crypto.createHash('sha256').update('fy_salt_' + pass).digest('hex');
}

/**
 * Basic email format validation
 */
function isValidEmail(email) {
    if (!email) return true; // optional field
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

/**
 * Normalize phone: strip spaces, dashes, leading +
 */
function normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[\s\-+]/g, '');
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

    // ==================== EXTRACT INPUTS ====================
    var name = (body.name || '').trim();
    var pass = (body.pass || '').trim();
    var email = (body.email || '').trim();
    var phone = (body.phone || '').trim();
    var countryCode = (body.countryCode || '').trim();
    var refCode = (body.refCode || '').trim();
    var regMethod = (body.regMethod || '').trim();

    // ==================== SECURITY: Explicitly strip any role parameter ====================
    // NEVER accept role from client. Always force 'USER'.
    // This prevents role escalation attacks even if client sends role: 'ADMIN'
    var forcedRole = 'USER';
    delete body.role; // Remove if present (no-op on plain object, but makes intent clear)

    // ==================== INPUT VALIDATION ====================

    // Name validation: at least 3 characters
    if (!name || name.length < 3) {
        return res.status(400).json({ success: false, error: 'الاسم مطلوب (3 أحرف على الأقل)', code: 'INVALID_NAME' });
    }

    // Password validation: at least 6 characters
    if (!pass || pass.length < 6) {
        return res.status(400).json({ success: false, error: 'كلمة المرور مطلوبة (6 أحرف على الأقل)', code: 'INVALID_PASSWORD' });
    }

    // Email validation: valid format if provided
    if (email && !isValidEmail(email)) {
        return res.status(400).json({ success: false, error: 'صيغة البريد الإلكتروني غير صالحة', code: 'INVALID_EMAIL' });
    }

    // Registration method validation
    if (regMethod !== 'email' && regMethod !== 'phone') {
        return res.status(400).json({ success: false, error: 'طريقة التسجيل غير صالحة', code: 'INVALID_REG_METHOD' });
    }

    // Phone validation: required if regMethod is 'phone'
    if (regMethod === 'phone' && !phone) {
        return res.status(400).json({ success: false, error: 'رقم الهاتف مطلوب لتسجيل الهاتف', code: 'MISSING_PHONE' });
    }

    // Input length limits to prevent abuse
    if (name.length > 100 || pass.length > 100 || (email && email.length > 200) || (phone && phone.length > 20)) {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة', code: 'INVALID_INPUT_LENGTH' });
    }

    var clientIp = getClientIp(req);

    // ==================== LOAD USERS ====================
    var users;
    try {
        users = await getUsers();
    } catch (err) {
        console.error('[Register] Firestore error:', err.message);
        return res.status(500).json({ success: false, error: 'خطأ في الاتصال بالخادم', code: 'SERVER_ERROR' });
    }

    if (!Array.isArray(users)) {
        users = [];
    }

    // ==================== DUPLICATE CHECKS ====================

    // Check duplicate email (case-insensitive)
    if (email) {
        var emailLower = email.toLowerCase();
        for (var i = 0; i < users.length; i++) {
            var u = users[i];
            if (u.email && u.email.toLowerCase() === emailLower) {
                return res.status(409).json({ success: false, error: 'هذا البريد الإلكتروني مسجل بالفعل', code: 'EMAIL_EXISTS' });
            }
        }
    }

    // Check duplicate phone (match with and without country code)
    if (phone) {
        var normalizedPhone = normalizePhone(phone);
        var normalizedPhoneCC = normalizePhone(countryCode + phone);
        for (var j = 0; j < users.length; j++) {
            var u2 = users[j];
            if (!u2.phone) continue;
            var storedPhone = normalizePhone(u2.phone);
            var storedPhoneCC = normalizePhone((u2.countryCode || '') + u2.phone);

            // Full match
            if (normalizedPhone === storedPhone || normalizedPhone === storedPhoneCC) {
                return res.status(409).json({ success: false, error: 'رقم الهاتف مسجل بالفعل', code: 'PHONE_EXISTS' });
            }
            // Match with country code prepended
            if (normalizedPhoneCC && storedPhone && normalizedPhoneCC === storedPhone) {
                return res.status(409).json({ success: false, error: 'رقم الهاتف مسجل بالفعل', code: 'PHONE_EXISTS' });
            }
            if (normalizedPhoneCC && storedPhoneCC && normalizedPhoneCC === storedPhoneCC) {
                return res.status(409).json({ success: false, error: 'رقم الهاتف مسجل بالفعل', code: 'PHONE_EXISTS' });
            }
            // Last 9 digits match
            if (normalizedPhone.length >= 9 && storedPhone.length >= 9) {
                if (normalizedPhone.slice(-9) === storedPhone.slice(-9)) {
                    return res.status(409).json({ success: false, error: 'رقم الهاتف مسجل بالفعل', code: 'PHONE_EXISTS' });
                }
            }
        }
    }

    // ==================== REFERRAL CODE VALIDATION ====================
    var referredBy = null;
    if (refCode) {
        var refFound = false;
        for (var k = 0; k < users.length; k++) {
            var refUser = users[k];
            if (refUser.affiliateCode && refUser.affiliateCode === refCode && refUser.affiliateStatus === 'APPROVED') {
                referredBy = refUser.id;
                refFound = true;
                break;
            }
        }
        if (!refFound) {
            return res.status(400).json({ success: false, error: 'كود الإحالة غير صالح', code: 'INVALID_REF_CODE' });
        }
    }

    // ==================== CREATE USER ====================

    var hashedPass = hashPassword(pass);
    var userEmail = email || null;
    var userPhone = phone || null;
    var userCC = countryCode || null;

    var newUser = {
        id: uid(),
        email: userEmail,
        name: name,
        password: hashedPass,
        phone: userPhone,
        countryCode: userCC,
        role: forcedRole, // ALWAYS 'USER' - role escalation is impossible
        usdtBalance: 0,
        localBalance: 0,
        affiliateBalance: 0,
        isBlocked: false,
        kycStatus: 'NOT_SUBMITTED',
        affiliateStatus: 'NONE',
        affiliateCode: null,
        referredBy: referredBy,
        pendingEmail: null,
        merchantStatus: 'NONE',
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // ==================== SAVE TO FIRESTORE ====================
    try {
        await saveUsers(users);
    } catch (err) {
        console.error('[Register] Save error:', err.message);
        return res.status(500).json({ success: false, error: 'خطأ في حفظ البيانات', code: 'SAVE_ERROR' });
    }

    // ==================== AUDIT LOG ====================
    try {
        var auditLog = await getCollection('auditLog');
        if (!Array.isArray(auditLog)) auditLog = [];

        auditLog.unshift({
            action: 'REGISTER',
            userId: newUser.id,
            userName: newUser.name,
            userRole: newUser.role,
            userEmail: newUser.email || '',
            userPhone: newUser.phone || '',
            countryCode: newUser.countryCode || '',
            regMethod: regMethod,
            referredBy: referredBy || null,
            ip: clientIp,
            timestamp: new Date().toISOString(),
            status: 'SUCCESS'
        });

        // Keep audit log trimmed (max 1000 entries)
        if (auditLog.length > 1000) auditLog = auditLog.slice(0, 1000);
        await saveCollection('auditLog', auditLog);
    } catch (err) {
        console.error('[Register] Audit log error:', err.message);
        // Don't fail registration if audit log fails
    }

    // ==================== RETURN SUCCESS ====================
    return res.status(201).json({
        success: true,
        user: {
            id: newUser.id,
            name: newUser.name,
            role: newUser.role
        }
    });
};
