// Secure Deposit API - Server-side validation
// ALL balance and fee calculations happen here, NOT in the browser
const { withSession, getSetting, getCollection, saveCollection, saveUsers, uid } = require('./_lib/session');

module.exports = withSession(async function(req, res) {
    var user = req.sessionUser;
    var body = req.body;
    var allUsers = req.allUsers;

    var pmId = body.pmId;
    var merchantId = body.merchantId || '';
    var amount = parseFloat(body.amount);
    var txid = (body.txid || '').trim();
    var receipt = body.receipt || '';
    var notes = (body.notes || '').trim();
    var currencySel = body.currency || 'YER';
    var txidVerified = body.txidVerified || false;
    var txidVerifyData = body.txidVerifyData || null;

    // ==================== SERVER-SIDE VALIDATION ====================

    // 1. Validate required fields
    if (!pmId) return res.json({ success: false, error: 'اختر طريقة الإيداع' });
    if (!amount || amount <= 0 || isNaN(amount)) return res.json({ success: false, error: 'أدخل مبلغاً صحيحاً' });
    if (!receipt) return res.json({ success: false, error: 'يجب إرفاق صورة الإيصال' });

    // 2. Get payment methods
    var paymentMethods = await getCollection('paymentMethods');
    var pm = null;
    for (var i = 0; i < paymentMethods.length; i++) {
        if (paymentMethods[i].id === pmId) { pm = paymentMethods[i]; break; }
    }
    if (!pm) return res.json({ success: false, error: 'طريقة الإيداع غير موجودة' });

    var isCrypto = pm.type === 'CRYPTO';

    // 3. Check minimum deposit
    if (amount < (pm.minDeposit || 0)) {
        return res.json({ success: false, error: 'الحد الأدنى للإيداع: ' + pm.minDeposit });
    }

    // 4. TXID validation for crypto
    if (isCrypto && !txid) {
        return res.json({ success: false, error: 'يجب إدخال TXID لعمليات USDT' });
    }

    // 5. Duplicate TXID check (server-side - CANNOT be bypassed)
    if (txid) {
        var deposits = await getCollection('deposits');
        for (var d = 0; d < deposits.length; d++) {
            if (deposits[d].txid && deposits[d].txid.toLowerCase() === txid.toLowerCase() && deposits[d].userId !== user.id) {
                return res.json({ success: false, error: 'TXID مستخدم في إيداع سابق - لا يمكن استخدامه مرة أخرى' });
            }
        }
    }

    // 6. Check for existing pending deposit (server-side)
    if (deposits) {
        var pendingCount = 0;
        for (var d = 0; d < deposits.length; d++) {
            if (deposits[d].userId === user.id && deposits[d].status === 'PENDING') pendingCount++;
        }
        if (pendingCount > 0) {
            return res.json({ success: false, error: 'لديك إيداع معلق بالفعل، لا يمكنك إجراء إيداع آخر حتى يكتمل الأول' });
        }
    } else {
        deposits = [];
    }

    // 7. SERVER-SIDE rate and fee calculation (user CANNOT tamper with this)
    var rate;
    if (currencySel === 'SAR') {
        var yerRate = parseFloat(await getSetting('exchange_rate')) || 535;
        var sarCrossRate = parseFloat(await getSetting('exchange_rate_sar')) || 137.50;
        rate = yerRate / sarCrossRate;
    } else {
        rate = parseFloat(await getSetting('exchange_rate')) || 535;
    }

    var depFeePercent = parseFloat(await getSetting('admin_deposit_fee')) || 0;
    var merchantCommPercent = 0;

    // 8. Merchant commission (server-side read)
    if (merchantId) {
        var merchantPayData = await getCollection('merchantPaymentData');
        var mData = null;
        for (var m = 0; m < merchantPayData.length; m++) {
            if (merchantPayData[m].merchantId === merchantId) { mData = merchantPayData[m]; break; }
        }
        merchantCommPercent = mData ? (mData.commission || 0) : 0;
    }

    // 9. Calculate amounts (SERVER-SIDE - cannot be manipulated)
    var grossUsdt = isCrypto ? amount : amount / rate;
    var depositFeeUsdt = grossUsdt * (depFeePercent / 100);
    var merchantCommUsdt = grossUsdt * (merchantCommPercent / 100);
    var netUsdt = grossUsdt - depositFeeUsdt - merchantCommUsdt;

    if (netUsdt <= 0) {
        return res.json({ success: false, error: 'المبلغ الصافي صفر أو أقل بعد خصم الرسوم' });
    }

    // 10. Check merchant balance (server-side - REAL balance from Firestore)
    if (merchantId) {
        var merchantUser = null;
        for (var i = 0; i < allUsers.length; i++) {
            if (allUsers[i].id === merchantId) { merchantUser = allUsers[i]; break; }
        }
        if (!merchantUser) {
            return res.json({ success: false, error: 'التاجر غير موجود' });
        }
        var merchantBal = merchantUser.usdtBalance || 0;
        if (merchantBal <= 0) {
            return res.json({ success: false, error: 'رصيد التاجر فارغ حالياً، لا يمكن الإيداع عبر هذا التاجر' });
        }
        if (netUsdt > merchantBal) {
            return res.json({ success: false, error: 'المبلغ الصافي أكبر من رصيد التاجر المتاح (' + merchantBal.toFixed(2) + ' USDT)' });
        }
    }

    // 11. Daily deposit limit (server-side check)
    var today = new Date().toISOString().split('T')[0];
    var totalDepToday = 0;
    for (var d = 0; d < deposits.length; d++) {
        if (deposits[d].userId === user.id && deposits[d].status !== 'REJECTED' &&
            deposits[d].createdAt && deposits[d].createdAt.startsWith(today)) {
            totalDepToday += (deposits[d].usdtAmount || 0);
        }
    }
    var dailyDepLimit = parseFloat(await getSetting('daily_deposit_limit')) || 10000;
    if (totalDepToday + netUsdt > dailyDepLimit) {
        return res.json({ success: false, error: 'لقد تجاوزت الحد اليومي للايداع: ' + dailyDepLimit + ' USDT' });
    }

    // ==================== BUILD DEPOSIT RECORD ====================
    var currency = isCrypto ? 'USDT' : currencySel;
    var depRecord = {
        id: uid(),
        userId: user.id,
        paymentMethodId: pmId,
        currency: currency,
        amount: amount,
        usdtAmount: netUsdt,
        grossUsdt: grossUsdt,
        depositFee: depositFeeUsdt,
        merchantComm: merchantCommUsdt,
        localAmount: isCrypto ? amount * rate : amount,
        txid: txid,
        receipt: receipt,
        notes: notes,
        status: 'PENDING',
        assignedMerchantId: merchantId || null,
        txidVerified: !!txidVerified,
        txidVerifyData: txidVerifyData || null,
        createdAt: new Date().toISOString()
    };

    // 12. Auto-approve crypto if verified and enabled
    var autoApprove = isCrypto && txidVerified && (await getSetting('auto_approve_crypto')) === '1';
    if (autoApprove && txidVerifyData) {
        var verifyAmount = txidVerifyData.amount || 0;
        var tolerance = grossUsdt * 0.05;
        if (Math.abs(verifyAmount - grossUsdt) <= tolerance) {
            depRecord.status = 'APPROVED';
            // Update user balance SERVER-SIDE
            for (var i = 0; i < allUsers.length; i++) {
                if (allUsers[i].id === user.id) {
                    allUsers[i].usdtBalance = (allUsers[i].usdtBalance || 0) + netUsdt;
                    break;
                }
            }
            // Deduct from merchant balance SERVER-SIDE
            if (merchantId) {
                for (var i = 0; i < allUsers.length; i++) {
                    if (allUsers[i].id === merchantId) {
                        allUsers[i].usdtBalance = Math.max(0, (allUsers[i].usdtBalance || 0) - netUsdt);
                        break;
                    }
                }
            }
            await saveUsers(allUsers);
        }
    }

    // Save deposit record
    deposits.unshift(depRecord);
    await saveCollection('deposits', deposits);

    // Return server-calculated values (browser uses these, not its own)
    return res.json({
        success: true,
        deposit: {
            id: depRecord.id,
            usdtAmount: netUsdt,
            grossUsdt: grossUsdt,
            depositFee: depositFeeUsdt,
            merchantComm: merchantCommUsdt,
            status: depRecord.status,
            rate: rate
        }
    });
});
