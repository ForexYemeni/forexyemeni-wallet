// Vercel Serverless Function - Verify TRC20 USDT TXID on TronGrid
const TRON_GRID_API = 'https://api.trongrid.io';
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { txid, adminWallet } = req.body;

        if (!txid || !adminWallet) {
            return res.status(400).json({ success: false, error: 'TXID وعنوان المحفظة مطلوبان' });
        }

        // Validate TXID format (64 hex chars)
        if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
            return res.json({ success: false, error: 'صيغة TXID غير صحيحة (يجب 64 حرف)' });
        }

        // Fetch transaction from TronGrid
        const response = await fetch(
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

        const data = await response.json();

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

        // Find USDT transfer to admin wallet
        const transfer = data.trc20TransferInfo.find(function(t) {
            return t.to_address === adminWallet &&
                t.token_info &&
                (t.token_info.symbol === 'USDT' || t.token_info.address === USDT_CONTRACT);
        });

        if (!transfer) {
            // Check if transfer exists but to different wallet
            const anyUsdt = data.trc20TransferInfo.find(function(t) {
                return t.token_info && (t.token_info.symbol === 'USDT' || t.token_info.address === USDT_CONTRACT);
            });
            if (anyUsdt) {
                return res.json({
                    success: false,
                    error: 'تم العثور على تحويل USDT لكنه لم يذهب لمحفظة الإدارة',
                    actualTo: anyUsdt.to_address,
                    amount: anyUsdt.amount / Math.pow(10, (anyUsdt.token_info.decimals || 6))
                });
            }
            return res.json({
                success: false,
                error: 'لم يتم العثور على تحويل USDT لمحفظة الإدارة'
            });
        }

        var decimals = transfer.token_info.decimals || 6;
        var amount = transfer.amount / Math.pow(10, decimals);

        console.log('TXID Verified:', txid, 'Amount:', amount, 'USDT, From:', transfer.from_address, 'To:', adminWallet);

        return res.json({
            success: true,
            amount: amount,
            from: transfer.from_address,
            to: transfer.to_address,
            token: transfer.token_info.symbol,
            decimals: decimals,
            confirmed: true,
            block: data.blockNumber,
            timestamp: data.block_timestamp
        });

    } catch (error) {
        console.error('TXID Verify Error:', error);
        return res.status(500).json({ success: false, error: 'خطأ في التحقق: ' + error.message });
    }
};
