// =====================================================================
// SECURE ADMIN API - Critical security gateway
// ALL admin operations: deposits, withdrawals, balances, user management
// Protected by withAdmin middleware - only ADMIN role can access
// ALL balance reads are from Firestore (never trust client data)
// =====================================================================
const { withAdmin, getCollection, saveCollection, saveUsers, getUsers, uid } = require('./_lib/session');

module.exports = withAdmin(async function(req, res) {
    var admin = req.sessionUser;
    var body = req.body;
    var action = body.action;

    if (!action) {
        return res.status(400).json({ success: false, error: 'Action is required' });
    }

    // =================================================================
    // Helper: find item in array by id
    // =================================================================
    function findById(arr, id) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id === id) return arr[i];
        }
        return null;
    }

    // =================================================================
    // Helper: find user in array by id (fresh Firestore data)
    // =================================================================
    function findUser(users, userId) {
        for (var i = 0; i < users.length; i++) {
            if (users[i].id === userId) return { user: users[i], index: i };
        }
        return null;
    }

    // =================================================================
    // Helper: save audit log entry
    // =================================================================
    async function saveAuditLog(entry) {
        try {
            var auditLogs = await getCollection('auditLogs');
            auditLogs.unshift({
                id: uid(),
                adminId: admin.id,
                adminName: admin.name || admin.phone || admin.id,
                timestamp: new Date().toISOString(),
                ...entry
            });
            // Keep last 500 entries max
            if (auditLogs.length > 500) auditLogs.length = 500;
            await saveCollection('auditLogs', auditLogs);
        } catch (err) {
            console.error('[AdminAudit] Failed to save log:', err.message);
        }
    }

    try {
        // =================================================================
        // ACTION 1: approve_deposit
        // =================================================================
        if (action === 'approve_deposit') {
            var depositId = body.depositId;
            if (!depositId) {
                return res.json({ success: false, error: 'Deposit ID is required' });
            }

            // Read FRESH data from Firestore (never trust client)
            var deposits = await getCollection('deposits');
            var allUsers = await getUsers();
            var deposit = findById(deposits, depositId);

            if (!deposit) {
                return res.json({ success: false, error: 'Deposit not found' });
            }
            if (deposit.status !== 'PENDING') {
                return res.json({ success: false, error: 'Deposit is not in PENDING status (current: ' + deposit.status + ')' });
            }

            // Find the deposit user with FRESH data
            var userResult = findUser(allUsers, deposit.userId);
            if (!userResult) {
                return res.json({ success: false, error: 'Deposit user not found' });
            }
            var depUser = userResult.user;
            var usdtAmount = deposit.usdtAmount || 0;

            // SERVER-SIDE: Add usdtAmount to user's REAL balance
            depUser.usdtBalance = (depUser.usdtBalance || 0) + usdtAmount;

            // If assigned to merchant: deduct from merchant balance
            if (deposit.assignedMerchantId) {
                var merchantResult = findUser(allUsers, deposit.assignedMerchantId);
                if (!merchantResult) {
                    return res.json({ success: false, error: 'Assigned merchant not found' });
                }
                var merchantUser = merchantResult.user;
                var merchantBal = merchantUser.usdtBalance || 0;

                if (merchantBal < usdtAmount) {
                    return res.json({
                        success: false,
                        error: 'Merchant balance insufficient. Merchant has: ' + merchantBal.toFixed(2) + ' USDT, needed: ' + usdtAmount.toFixed(2) + ' USDT'
                    });
                }

                // SERVER-SIDE: Deduct from merchant
                merchantUser.usdtBalance = merchantBal - usdtAmount;
            }

            // Update deposit status
            deposit.status = 'APPROVED';
            deposit.processedBy = admin.id;
            deposit.processedAt = new Date().toISOString();

            // Save everything to Firestore
            await saveUsers(allUsers);
            await saveCollection('deposits', deposits);

            await saveAuditLog({
                action: 'approve_deposit',
                depositId: depositId,
                userId: deposit.userId,
                amount: usdtAmount,
                merchantId: deposit.assignedMerchantId || null
            });

            return res.json({
                success: true,
                message: 'Deposit approved successfully',
                deposit: {
                    id: depositId,
                    status: 'APPROVED',
                    usdtAmount: usdtAmount,
                    newBalance: depUser.usdtBalance
                }
            });
        }

        // =================================================================
        // ACTION 2: reject_deposit
        // =================================================================
        if (action === 'reject_deposit') {
            var depositId = body.depositId;
            var reason = (body.reason || '').trim();
            if (!depositId) {
                return res.json({ success: false, error: 'Deposit ID is required' });
            }

            // Read FRESH data from Firestore
            var deposits = await getCollection('deposits');
            var deposit = findById(deposits, depositId);

            if (!deposit) {
                return res.json({ success: false, error: 'Deposit not found' });
            }
            if (deposit.status !== 'PENDING') {
                return res.json({ success: false, error: 'Deposit is not in PENDING status (current: ' + deposit.status + ')' });
            }

            // Set status - NO balance change
            deposit.status = 'REJECTED';
            deposit.rejectReason = reason;
            deposit.processedBy = admin.id;
            deposit.processedAt = new Date().toISOString();

            await saveCollection('deposits', deposits);

            await saveAuditLog({
                action: 'reject_deposit',
                depositId: depositId,
                userId: deposit.userId,
                reason: reason
            });

            return res.json({
                success: true,
                message: 'Deposit rejected',
                deposit: { id: depositId, status: 'REJECTED' }
            });
        }

        // =================================================================
        // ACTION 3: receive_withdrawal
        // =================================================================
        if (action === 'receive_withdrawal') {
            var withdrawalId = body.withdrawalId;
            if (!withdrawalId) {
                return res.json({ success: false, error: 'Withdrawal ID is required' });
            }

            // Read FRESH data from Firestore
            var withdrawals = await getCollection('withdrawals');
            var withdrawal = findById(withdrawals, withdrawalId);

            if (!withdrawal) {
                return res.json({ success: false, error: 'Withdrawal not found' });
            }
            if (withdrawal.status !== 'PENDING') {
                return res.json({ success: false, error: 'Withdrawal is not in PENDING status (current: ' + withdrawal.status + ')' });
            }

            // Set status - NO balance change yet
            withdrawal.status = 'RECEIVED';
            withdrawal.receivedBy = admin.id;
            withdrawal.receivedAt = new Date().toISOString();

            await saveCollection('withdrawals', withdrawals);

            await saveAuditLog({
                action: 'receive_withdrawal',
                withdrawalId: withdrawalId,
                userId: withdrawal.userId
            });

            return res.json({
                success: true,
                message: 'Withdrawal marked as received',
                withdrawal: { id: withdrawalId, status: 'RECEIVED' }
            });
        }

        // =================================================================
        // ACTION 4: start_processing_withdrawal
        // =================================================================
        if (action === 'start_processing_withdrawal') {
            var withdrawalId = body.withdrawalId;
            if (!withdrawalId) {
                return res.json({ success: false, error: 'Withdrawal ID is required' });
            }

            // Read FRESH data from Firestore
            var withdrawals = await getCollection('withdrawals');
            var allUsers = await getUsers();
            var withdrawal = findById(withdrawals, withdrawalId);

            if (!withdrawal) {
                return res.json({ success: false, error: 'Withdrawal not found' });
            }
            if (withdrawal.status !== 'RECEIVED' && withdrawal.status !== 'PENDING') {
                return res.json({ success: false, error: 'Withdrawal must be in RECEIVED or PENDING status (current: ' + withdrawal.status + ')' });
            }

            // Find the withdrawal user with FRESH data
            var userResult = findUser(allUsers, withdrawal.userId);
            if (!userResult) {
                return res.json({ success: false, error: 'Withdrawal user not found' });
            }
            var wdUser = userResult.user;
            var wdAmount = withdrawal.net || withdrawal.amount || 0;

            // SERVER-SIDE: Read REAL balance and deduct
            var realBalance = wdUser.usdtBalance || 0;
            if (realBalance < wdAmount) {
                return res.json({
                    success: false,
                    error: 'User balance insufficient for withdrawal. Balance: ' + realBalance.toFixed(2) + ' USDT, withdrawal: ' + wdAmount.toFixed(2) + ' USDT'
                });
            }

            wdUser.usdtBalance = realBalance - wdAmount;

            // Update withdrawal status
            withdrawal.status = 'PROCESSING';
            withdrawal.processedBy = admin.id;
            withdrawal.processingStartedAt = new Date().toISOString();

            // Save to Firestore
            await saveUsers(allUsers);
            await saveCollection('withdrawals', withdrawals);

            await saveAuditLog({
                action: 'start_processing_withdrawal',
                withdrawalId: withdrawalId,
                userId: withdrawal.userId,
                amount: wdAmount,
                prevBalance: realBalance,
                newBalance: wdUser.usdtBalance
            });

            return res.json({
                success: true,
                message: 'Withdrawal processing started, balance deducted',
                withdrawal: {
                    id: withdrawalId,
                    status: 'PROCESSING',
                    deductedAmount: wdAmount,
                    newBalance: wdUser.usdtBalance
                }
            });
        }

        // =================================================================
        // ACTION 5: complete_withdrawal
        // =================================================================
        if (action === 'complete_withdrawal') {
            var withdrawalId = body.withdrawalId;
            var proofImage = body.proofImage || '';
            var txidVerifyData = body.txidVerifyData || null;

            if (!withdrawalId) {
                return res.json({ success: false, error: 'Withdrawal ID is required' });
            }

            // Read FRESH data from Firestore
            var withdrawals = await getCollection('withdrawals');
            var withdrawal = findById(withdrawals, withdrawalId);

            if (!withdrawal) {
                return res.json({ success: false, error: 'Withdrawal not found' });
            }
            if (withdrawal.status !== 'PROCESSING') {
                return res.json({ success: false, error: 'Withdrawal is not in PROCESSING status (current: ' + withdrawal.status + ')' });
            }

            // Set status - NO balance change (already deducted in step 4)
            withdrawal.status = 'APPROVED';
            withdrawal.completedBy = admin.id;
            withdrawal.completedAt = new Date().toISOString();

            // Save proof image and TXID data
            if (proofImage) {
                withdrawal.proofImage = proofImage;
            }
            if (txidVerifyData) {
                withdrawal.txidVerifyData = txidVerifyData;
            }

            await saveCollection('withdrawals', withdrawals);

            await saveAuditLog({
                action: 'complete_withdrawal',
                withdrawalId: withdrawalId,
                userId: withdrawal.userId,
                amount: withdrawal.net || withdrawal.amount
            });

            return res.json({
                success: true,
                message: 'Withdrawal completed successfully',
                withdrawal: { id: withdrawalId, status: 'APPROVED' }
            });
        }

        // =================================================================
        // ACTION 6: reject_withdrawal (refund balance)
        // =================================================================
        if (action === 'reject_withdrawal') {
            var withdrawalId = body.withdrawalId;
            var reason = (body.reason || '').trim();
            if (!withdrawalId) {
                return res.json({ success: false, error: 'Withdrawal ID is required' });
            }

            // Read FRESH data from Firestore
            var withdrawals = await getCollection('withdrawals');
            var allUsers = await getUsers();
            var withdrawal = findById(withdrawals, withdrawalId);

            if (!withdrawal) {
                return res.json({ success: false, error: 'Withdrawal not found' });
            }
            if (withdrawal.status !== 'PROCESSING' && withdrawal.status !== 'RECEIVED' && withdrawal.status !== 'PENDING') {
                return res.json({ success: false, error: 'Withdrawal cannot be rejected in current status: ' + withdrawal.status });
            }

            // Find user with FRESH data
            var userResult = findUser(allUsers, withdrawal.userId);
            if (!userResult) {
                return res.json({ success: false, error: 'Withdrawal user not found' });
            }
            var wdUser = userResult.user;

            // Determine refund amount:
            // If PROCESSING: balance was already deducted, refund the net amount
            // If RECEIVED or PENDING: balance was NOT deducted yet, no refund needed
            var refundAmount = 0;
            if (withdrawal.status === 'PROCESSING') {
                refundAmount = withdrawal.net || withdrawal.amount || 0;
                // SERVER-SIDE: Add withdrawal amount back to user's REAL balance
                wdUser.usdtBalance = (wdUser.usdtBalance || 0) + refundAmount;
            }

            // Update withdrawal status
            withdrawal.status = 'REJECTED';
            withdrawal.rejectReason = reason;
            withdrawal.rejectedBy = admin.id;
            withdrawal.rejectedAt = new Date().toISOString();
            if (refundAmount > 0) {
                withdrawal.refundAmount = refundAmount;
            }

            // Save to Firestore
            if (refundAmount > 0) {
                await saveUsers(allUsers);
            }
            await saveCollection('withdrawals', withdrawals);

            await saveAuditLog({
                action: 'reject_withdrawal',
                withdrawalId: withdrawalId,
                userId: withdrawal.userId,
                reason: reason,
                refundAmount: refundAmount
            });

            return res.json({
                success: true,
                message: 'Withdrawal rejected' + (refundAmount > 0 ? ', balance refunded: ' + refundAmount.toFixed(2) + ' USDT' : ''),
                withdrawal: {
                    id: withdrawalId,
                    status: 'REJECTED',
                    refundAmount: refundAmount,
                    newBalance: wdUser.usdtBalance
                }
            });
        }

        // =================================================================
        // ACTION 7: update_user_balance (manual admin adjustment)
        // =================================================================
        if (action === 'update_user_balance') {
            var userId = body.userId;
            var field = body.field;
            var amount = parseFloat(body.amount);

            if (!userId) {
                return res.json({ success: false, error: 'User ID is required' });
            }
            if (!field || ['usdtBalance', 'localBalance', 'affiliateBalance'].indexOf(field) === -1) {
                return res.json({ success: false, error: 'Invalid field. Must be: usdtBalance, localBalance, or affiliateBalance' });
            }
            if (isNaN(amount) || amount === 0) {
                return res.json({ success: false, error: 'Amount must be a non-zero number' });
            }

            // Read FRESH user data from Firestore
            var allUsers = await getUsers();
            var userResult = findUser(allUsers, userId);
            if (!userResult) {
                return res.json({ success: false, error: 'User not found' });
            }

            var targetUser = userResult.user;

            // SECURITY: Read REAL balance first, then adjust
            var prevBalance = targetUser[field] || 0;
            var newBalance = prevBalance + amount;

            // Prevent negative balance (safety check)
            if (newBalance < 0) {
                return res.json({
                    success: false,
                    error: 'Cannot set negative balance. Current: ' + prevBalance.toFixed(2) + ', adjustment: ' + amount.toFixed(2)
                });
            }

            // Apply adjustment
            targetUser[field] = newBalance;

            // Save to Firestore
            await saveUsers(allUsers);

            // Save audit log entry
            await saveAuditLog({
                action: 'update_user_balance',
                targetUserId: userId,
                targetUserName: targetUser.name || targetUser.phone || userId,
                field: field,
                adjustment: amount,
                prevBalance: prevBalance,
                newBalance: newBalance
            });

            return res.json({
                success: true,
                message: 'Balance updated successfully',
                balance: {
                    field: field,
                    prevBalance: prevBalance,
                    adjustment: amount,
                    newBalance: newBalance
                }
            });
        }

        // =================================================================
        // ACTION 8: block_user
        // =================================================================
        if (action === 'block_user') {
            var userId = body.userId;
            var isBlocked = body.isBlocked === true;

            if (!userId) {
                return res.json({ success: false, error: 'User ID is required' });
            }

            // Read FRESH data from Firestore
            var allUsers = await getUsers();
            var userResult = findUser(allUsers, userId);
            if (!userResult) {
                return res.json({ success: false, error: 'User not found' });
            }

            var targetUser = userResult.user;

            // Prevent blocking admins
            if (targetUser.role === 'ADMIN' && isBlocked) {
                return res.json({ success: false, error: 'Cannot block admin users' });
            }

            targetUser.isBlocked = isBlocked;

            // Save to Firestore
            await saveUsers(allUsers);

            await saveAuditLog({
                action: isBlocked ? 'block_user' : 'unblock_user',
                targetUserId: userId,
                targetUserName: targetUser.name || targetUser.phone || userId
            });

            return res.json({
                success: true,
                message: isBlocked ? 'User blocked successfully' : 'User unblocked successfully',
                userId: userId,
                isBlocked: isBlocked
            });
        }

        // =================================================================
        // ACTION 9: delete_user
        // =================================================================
        if (action === 'delete_user') {
            var userId = body.userId;
            if (!userId) {
                return res.json({ success: false, error: 'User ID is required' });
            }

            // Read FRESH data from Firestore
            var allUsers = await getUsers();
            var userResult = findUser(allUsers, userId);
            if (!userResult) {
                return res.json({ success: false, error: 'User not found' });
            }

            var targetUser = userResult.user;

            // SECURITY: Cannot delete admin users
            if (targetUser.role === 'ADMIN') {
                return res.json({ success: false, error: 'Cannot delete admin users' });
            }

            // Prevent self-deletion
            if (targetUser.id === admin.id) {
                return res.json({ success: false, error: 'Cannot delete your own account' });
            }

            // Remove user from users array
            allUsers.splice(userResult.index, 1);

            // Save to Firestore
            await saveUsers(allUsers);

            await saveAuditLog({
                action: 'delete_user',
                targetUserId: userId,
                targetUserName: targetUser.name || targetUser.phone || userId,
                deletedUserRole: targetUser.role || 'USER'
            });

            return res.json({
                success: true,
                message: 'User deleted successfully',
                deletedUserId: userId
            });
        }

        // =================================================================
        // UNKNOWN ACTION
        // =================================================================
        return res.status(400).json({ success: false, error: 'Unknown action: ' + action });

    } catch (err) {
        console.error('[SecureAdmin] Error:', err.message, err.stack);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
