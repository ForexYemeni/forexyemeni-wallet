// Secure Withdraw API - Server-side validation
// ALL balance checks happen on the server - user CANNOT bypass
const { withSession, getSetting, getCollection, saveCollection, saveUsers, uid } = require('./_lib/session');

module.exports = withSession(async function(req, res) {
    var user = req.sessionUser;
    var body = req.body;
    var allUsers = req.allUsers;

    var methodId = body.methodId;
    var amountInput = parseFloat(body.amount);
    var wdCurrency = body.currency || 'USDT';
    var notes = (body.notes || '').trim();
    var merchantId = body.merchantId || '';

    // ==================== SERVER-SIDE VALIDATION ====================

    // 1. Validate required fields
    if (!methodId) return res.json({ success: false, error: 'اختر طريقة السحب' });
    if (!amountInput || amountInput <= 0 || isNaN(amountInput)) return res.json({ success: false, error: 'أدخل مبلغاً صحيحاً' });

    // 2. SERVER-SIDE rate calculation (user CANNOT change this)
    var fee = parseFloat(await getSetting('exchange_fee')) || 0;
    var rate = parseFloat(await getSetting('exchange_rate')) || 535;
    var rateSar = parseFloat(await getSetting('exchange_rate_sar')) || 137.50;

    // 3. Convert to USDT (server-side calculation)
    var usdtAmount = amountInput;
    if (wdCurrency === 'YER') usdtAmount = amountInput / rate;
    else if (wdCurrency === 'SAR') usdtAmount = amountInput * rateSar / rate;

    if (usdtAmount <= 0) return res.json({ success: false, error: 'المبلغ غير صالح' });

    // 4. Calculate fees (server-side - CANNOT be tampered)
    var feeAmount = usdtAmount * fee / 100;
    var netUsdt = usdtAmount - feeAmount;
    if (netUsdt <= 0) return res.json({ success: false, error: 'المبلغ بعد الرسوم صفر أو أقل' });

    // 5. CRITICAL: Check user balance from SERVER (real balance, not what browser sends)
    // Get fresh user data from the allUsers array (read from Firestore in session middleware)
    var realUser = null;
    for (var i = 0; i < allUsers.length; i++) {
        if (allUsers[i].id === user.id) { realUser = allUsers[i]; break; }
    }
    if (!realUser) return res.json({ success: false, error: 'خطأ في بيانات المستخدم' });

    var realBalance = realUser.usdtBalance || 0;
    if (usdtAmount > realBalance) {
        return res.json({
            success: false,
            error: 'رصيدك غير كافٍ! رصيدك الفعلي: ' + realBalance.toFixed(2) + ' USDT والمطلوب: ' + usdtAmount.toFixed(2) + ' USDT',
            code: 'INSUFFICIENT_BALANCE',
            realBalance: realBalance
        });
    }

    // 6. Check withdrawal method exists and belongs to this user
    var userWms = await getCollection('userWithdrawalMethods');
    var method = null;
    for (var i = 0; i < userWms.length; i++) {
        if (userWms[i].id === methodId) { method = userWms[i]; break; }
    }
    if (!method) return res.json({ success: false, error: 'طريقة السحب غير موجودة' });
    if (method.userId !== user.id) return res.json({ success: false, error: 'طريقة السحب لا تنتمي لحسابك' });

    // 7. Check merchant balance (server-side - real balance)
    if (merchantId) {
        var merchantUser = null;
        for (var i = 0; i < allUsers.length; i++) {
            if (allUsers[i].id === merchantId) { merchantUser = allUsers[i]; break; }
        }
        if (!merchantUser) return res.json({ success: false, error: 'التاجر غير موجود' });
        var merchantBal = merchantUser.usdtBalance || 0;
        if (merchantBal <= 0) return res.json({ success: false, error: 'رصيد التاجر فارغ حالياً' });
        if (netUsdt > merchantBal) {
            return res.json({ success: false, error: 'المبلغ أكبر من رصيد التاجر المتاح (' + merchantBal.toFixed(2) + ' USDT)' });
        }
    }

    // 8. Daily withdrawal limit (server-side - CANNOT bypass)
    var today = new Date().toISOString().split('T')[0];
    var withdrawals = await getCollection('withdrawals');
    var totalWdToday = 0;
    for (var i = 0; i < withdrawals.length; i++) {
        var w = withdrawals[i];
        if (w.userId === user.id && w.status !== 'REJECTED' && w.createdAt && w.createdAt.startsWith(today)) {
            totalWdToday += (w.net || 0);
        }
    }
    var dailyWdLimit = parseFloat(await getSetting('daily_withdrawal_limit')) || 5000;
    if (totalWdToday + netUsdt > dailyWdLimit) {
        return res.json({ success: false, error: 'لقد تجاوزت الحد اليومي للسحب: ' + dailyWdLimit + ' USDT' });
    }

    // 9. KYC check (server-side)
    var kycDocs = await getCollection('kycDocuments');
    var kycApproved = false;
    for (var i = 0; i < kycDocs.length; i++) {
        if (kycDocs[i].userId === user.id && kycDocs[i].status === 'APPROVED') {
            kycApproved = true; break;
        }
    }
    // Check if KYC is required for withdrawal
    var kycRequired = (await getSetting('kyc_required_for_withdraw')) === 'true';
    if (kycRequired && !kycApproved) {
        return res.json({ success: false, error: 'يجب توثيق الهوية أولاً قبل السحب', code: 'KYC_REQUIRED' });
    }

    // ==================== BUILD WITHDRAWAL RECORD ====================
    var localAmount = amountInput - (amountInput * fee / 100);
    if (wdCurrency === 'USDT') localAmount = netUsdt;

    var wdRecord = {
        id: uid(),
        userId: user.id,
        withdrawalMethodId: methodId,
        amount: usdtAmount,
        fee: feeAmount,
        net: netUsdt,
        currency: wdCurrency,
        localAmount: localAmount,
        notes: notes,
        status: 'PENDING',
        assignedMerchantId: merchantId || null,
        createdAt: new Date().toISOString()
    };

    // Save withdrawal record (server-side)
    withdrawals.unshift(wdRecord);
    await saveCollection('withdrawals', withdrawals);

    return res.json({
        success: true,
        withdrawal: {
            id: wdRecord.id,
            usdtAmount: usdtAmount,
            fee: feeAmount,
            net: netUsdt,
            localAmount: localAmount,
            currency: wdCurrency,
            rate: rate,
            realBalance: realBalance - 0 // Balance not deducted yet (pending approval)
        }
    });
});
