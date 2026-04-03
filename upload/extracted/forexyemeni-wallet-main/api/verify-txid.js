// Vercel Serverless Function - Verify TRC20 USDT TXID on TronGrid
// Supports both DEPOSIT (to admin wallet) and WITHDRAWAL (from admin wallet)
const TRON_GRID_API = 'https://api.trongrid.io';
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        var body = req.body;
        var txid = body.txid;
        var adminWallet = body.adminWallet;
        var direction = body.direction || 'deposit'; // 'deposit' or 'withdrawal'
        var userWallet = body.userWallet || ''; // Required for withdrawal: the user's destination wallet

        if (!txid || !adminWallet) {
            return res.status(400).json({ success: false, error: 'TXID وعنوان المحفظة مطلوبان' });
        }

        // For withdrawal, user wallet is required
        if (direction === 'withdrawal' && !userWallet) {
            return res.status(400).json({ success: false, error: 'عنوان محفظة المستخدم مطلوب للسحب' });
        }

        // Validate TXID format (64 hex chars)
        if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
            return res.json({ success: false, error: 'صيغة TXID غير صحيحة (يجب 64 حرف)' });
        }

        // Fetch transaction from TronGrid
        var response = await fetch(
            TRON_GRID_API + '/v1/transactions/' + txid + '?only_confirmed=true',
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 429) {
            return res.json({ success: false, error: 'تم تجاوز حد الطلبات، حاول بعد 30 ثانية', rate_limited: true });
        }

        if (!response.ok) {
            return res.json({ success: false, error: 'فشل الاتصال بشبكة TRON' });
        }

        var data = await response.json();

        // Check if transaction exists
        if (!data || !data.txID || data.Error) {
            return res.json({ success: false, error: 'رقم العملية غير موجود في شبكة TRON' });
        }

        // Check if confirmed
        if (!data.ret || data.ret[0].contractRet !== 'SUCCESS') {
            return res.json({ success: false, error: 'العملية لم تُؤكد أو فشلت' });
        }

        // Check for TRC20 transfer info
        if (!data.trc20TransferInfo || data.trc20TransferInfo.length === 0) {
            return res.json({
                success: false,
                error: 'لم يتم العثور على تحويل TRC20 في هذه العملية'
            });
        }

        // Find USDT transfer
        var usdtTransfer = null;
        for (var i = 0; i < data.trc20TransferInfo.length; i++) {
            var t = data.trc20TransferInfo[i];
            if (t.token_info && (t.token_info.symbol === 'USDT' || t.token_info.address === USDT_CONTRACT)) {
                usdtTransfer = t;
                break;
            }
        }

        if (!usdtTransfer) {
            return res.json({ success: false, error: 'لم يتم العثور على تحويل USDT' });
        }

        var decimals = usdtTransfer.token_info.decimals || 6;
        var amount = usdtTransfer.amount / Math.pow(10, decimals);

        if (direction === 'deposit') {
            // DEPOSIT: Check that USDT was sent TO admin wallet
            if (usdtTransfer.to_address !== adminWallet) {
                return res.json({
                    success: false,
                    error: 'تم العثور على تحويل USDT لكنه لم يذهب لمحفظة الإدارة',
                    actualTo: usdtTransfer.to_address,
                    amount: amount
                });
            }
            console.log('[DEPOSIT] TXID Verified:', txid, 'Amount:', amount, 'USDT, From:', usdtTransfer.from_address, 'To:', adminWallet);
            return res.json({
                success: true,
                amount: amount,
                from: usdtTransfer.from_address,
                to: usdtTransfer.to_address,
                token: usdtTransfer.token_info.symbol,
                decimals: decimals,
                confirmed: true,
                block: data.blockNumber,
                timestamp: data.block_timestamp,
                direction: 'deposit'
            });

        } else if (direction === 'withdrawal') {
            // WITHDRAWAL: Check that USDT was sent FROM admin wallet TO user wallet
            var adminWalletLower = adminWallet.toLowerCase();
            var userWalletLower = userWallet.toLowerCase();
            var fromLower = usdtTransfer.from_address.toLowerCase();
            var toLower = usdtTransfer.to_address.toLowerCase();

            if (fromLower !== adminWalletLower) {
                return res.json({
                    success: false,
                    error: 'لم يتم العثور على تحويل من محفظة الإدارة',
                    actualFrom: usdtTransfer.from_address,
                    amount: amount
                });
            }

            if (toLower !== userWalletLower) {
                return res.json({
                    success: false,
                    error: 'المبلغ لم يُرسل لمحفظة المستخدم الصحيحة',
                    expectedTo: userWallet,
                    actualTo: usdtTransfer.to_address,
                    amount: amount
                });
            }

            console.log('[WITHDRAWAL] TXID Verified:', txid, 'Amount:', amount, 'USDT, From:', adminWallet, 'To:', userWallet);
            return res.json({
                success: true,
                amount: amount,
                from: usdtTransfer.from_address,
                to: usdtTransfer.to_address,
                token: usdtTransfer.token_info.symbol,
                decimals: decimals,
                confirmed: true,
                block: data.blockNumber,
                timestamp: data.block_timestamp,
                direction: 'withdrawal'
            });
        }

    } catch (error) {
        console.error('TXID Verify Error:', error);
        return res.status(500).json({ success: false, error: 'خطأ في التحقق: ' + error.message });
    }
};
