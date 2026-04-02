// Secure Balance Validation API
// Returns REAL server-side balance - browser cannot fake this
const { withSession, getUsers, getSetting } = require('./_lib/session');

module.exports = withSession(async function(req, res) {
    var user = req.sessionUser;
    var allUsers = req.allUsers;

    // Find the LATEST user data from Firestore (not cached browser data)
    var realUser = null;
    for (var i = 0; i < allUsers.length; i++) {
        if (allUsers[i].id === user.id) { realUser = allUsers[i]; break; }
    }

    if (!realUser) {
        return res.json({ success: false, error: 'المستخدم غير موجود' });
    }

    // Return real balance and settings
    var exchangeRate = parseFloat(await getSetting('exchange_rate')) || 535;
    var exchangeRateSar = parseFloat(await getSetting('exchange_rate_sar')) || 137.50;
    var exchangeFee = parseFloat(await getSetting('exchange_fee')) || 0;
    var depositFee = parseFloat(await getSetting('admin_deposit_fee')) || 0;

    // Check KYC status
    var kycStatus = realUser.kycStatus || 'NOT_SUBMITTED';

    return res.json({
        success: true,
        balance: {
            usdtBalance: realUser.usdtBalance || 0,
            localBalance: realUser.localBalance || 0,
            affiliateBalance: realUser.affiliateBalance || 0
        },
        rates: {
            exchangeRate: exchangeRate,
            exchangeRateSar: exchangeRateSar,
            exchangeFee: exchangeFee,
            depositFee: depositFee
        },
        kycStatus: kycStatus,
        isBlocked: realUser.isBlocked || false,
        merchantStatus: realUser.merchantStatus || 'NONE',
        timestamp: new Date().toISOString()
    });
});
