// backend/src/controllers/customerController.js

const { pool, query } = require('../config/db');
const { appendHash } = require('../utils/hashChain');
const { runFraudChecks, hasHighRisk } = require('../utils/fraudEngine');

// ---------- GET /api/customer/me ----------
async function getMe(req, res) {
    try {
        const r = await query(
            `SELECT user_id, full_name, email, phone, created_at
               FROM users WHERE user_id = $1`,
            [req.auth.user_id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        return res.json(r.rows[0]);
    } catch (err) {
        console.error('getMe:', err);
        return res.status(500).json({ error: 'Failed to load profile' });
    }
}

// ---------- GET /api/customer/accounts ----------
async function getMyAccounts(req, res) {
    try {
        const r = await query(
            `SELECT a.account_id, a.account_type, a.balance, a.status, a.created_at,
                    b.branch_id, b.name AS branch_name
               FROM account a
               JOIN branch b ON b.branch_id = a.branch_id
              WHERE a.user_id = $1
              ORDER BY a.account_id`,
            [req.auth.user_id]
        );
        return res.json(r.rows);
    } catch (err) {
        console.error('getMyAccounts:', err);
        return res.status(500).json({ error: 'Failed to load accounts' });
    }
}

// ---------- GET /api/customer/transactions ----------
async function getMyTransactions(req, res) {
    try {
        // Find all transactions touching any of this customer's accounts.
        const r = await query(
            `SELECT t.transaction_id, t.from_account_id, t.to_account_id, t.amount,
                    t.transaction_type, t.status, t.timestamp,
                    fa.user_id AS from_user_id,
                    ta.user_id AS to_user_id
               FROM transactions t
               LEFT JOIN account fa ON fa.account_id = t.from_account_id
               LEFT JOIN account ta ON ta.account_id = t.to_account_id
              WHERE fa.user_id = $1 OR ta.user_id = $1
              ORDER BY t.timestamp DESC, t.transaction_id DESC
              LIMIT 200`,
            [req.auth.user_id]
        );
        return res.json(r.rows);
    } catch (err) {
        console.error('getMyTransactions:', err);
        return res.status(500).json({ error: 'Failed to load transactions' });
    }
}

// ---------- POST /api/customer/transfer ----------
// Customer transfers from one of their own accounts to any active account.
async function customerTransfer(req, res) {
    const { from_account_id, to_account_id, amount } = req.body || {};
    const amt = Number(amount);

    if (!from_account_id || !to_account_id || !amt) {
        return res.status(400).json({ error: 'from_account_id, to_account_id, amount are required' });
    }
    if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    if (Number(from_account_id) === Number(to_account_id)) {
        return res.status(400).json({ error: 'Cannot transfer to the same account' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lock the source account; verify ownership and state.
        const fromRes = await client.query(
            `SELECT * FROM account WHERE account_id = $1 FOR UPDATE`,
            [from_account_id]
        );
        const fromAcct = fromRes.rows[0];
        if (!fromAcct) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Source account not found' });
        }
        if (fromAcct.user_id !== req.auth.user_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'You do not own the source account' });
        }
        if (fromAcct.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Source account is ${fromAcct.status}` });
        }
        if (Number(fromAcct.balance) < amt) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Lock destination too (prevents concurrent close).
        const toRes = await client.query(
            `SELECT * FROM account WHERE account_id = $1 FOR UPDATE`,
            [to_account_id]
        );
        const toAcct = toRes.rows[0];
        if (!toAcct) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Destination account not found' });
        }
        if (toAcct.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Destination account is ${toAcct.status}` });
        }

        // Insert the transaction in 'pending' state.
        const txIns = await client.query(
            `INSERT INTO transactions (from_account_id, to_account_id, amount,
                                       transaction_type, initiated_by_user_id, status)
             VALUES ($1, $2, $3, 'transfer', $4, 'pending')
             RETURNING *`,
            [from_account_id, to_account_id, amt, req.auth.user_id]
        );
        const tx = txIns.rows[0];

        // Run fraud checks. If HIGH risk fires, mark flagged and DO NOT move money.
        const alerts = await runFraudChecks(client, tx);
        const highRisk = hasHighRisk(alerts);

        if (highRisk) {
            await client.query(
                `UPDATE transactions SET status = 'flagged' WHERE transaction_id = $1`,
                [tx.transaction_id]
            );
            await client.query(
                `INSERT INTO transaction_log (transaction_id, action, performed_by_user_id, description)
                 VALUES ($1, 'flagged', $2, $3)`,
                [tx.transaction_id, req.auth.user_id, `Customer transfer flagged by fraud engine.`]
            );
            // Hash the flagged transaction too — it's still part of the immutable record.
            tx.status = 'flagged';
            await appendHash(client, tx);
            await client.query('COMMIT');
            return res.status(202).json({
                status: 'flagged',
                message: 'Transfer flagged for review by fraud team.',
                transaction: { ...tx, status: 'flagged' },
                alerts,
            });
        }

        // Move money atomically.
        await client.query(
            `UPDATE account SET balance = balance - $1 WHERE account_id = $2`,
            [amt, from_account_id]
        );
        await client.query(
            `UPDATE account SET balance = balance + $1 WHERE account_id = $2`,
            [amt, to_account_id]
        );
        await client.query(
            `UPDATE transactions SET status = 'success' WHERE transaction_id = $1`,
            [tx.transaction_id]
        );

        // Refresh tx for hashing
        const refreshed = await client.query(
            `SELECT * FROM transactions WHERE transaction_id = $1`, [tx.transaction_id]);
        const finalTx = refreshed.rows[0];

        await appendHash(client, finalTx);

        await client.query(
            `INSERT INTO transaction_log (transaction_id, action, performed_by_user_id, description)
             VALUES ($1, 'created', $2, $3)`,
            [finalTx.transaction_id, req.auth.user_id,
             `Customer transferred ${amt} from acct ${from_account_id} to acct ${to_account_id}.`]
        );

        await client.query('COMMIT');
        return res.status(201).json({
            status: 'success',
            transaction: finalTx,
            alerts,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('customerTransfer:', err);
        return res.status(500).json({ error: 'Transfer failed' });
    } finally {
        client.release();
    }
}

// ---------- POST /api/customer/withdrawal-request ----------
// Two-step withdrawal: customer creates a 'pending' withdrawal; staff approves.
async function customerWithdrawalRequest(req, res) {
    const { from_account_id, amount } = req.body || {};
    const amt = Number(amount);
    if (!from_account_id || !amt) {
        return res.status(400).json({ error: 'from_account_id and amount are required' });
    }
    if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const acctRes = await client.query(
            `SELECT * FROM account WHERE account_id = $1 FOR UPDATE`,
            [from_account_id]
        );
        const acct = acctRes.rows[0];
        if (!acct) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Account not found' });
        }
        if (acct.user_id !== req.auth.user_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'You do not own this account' });
        }
        if (acct.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Account is ${acct.status}` });
        }
        if (Number(acct.balance) < amt) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance for this request' });
        }

        const txIns = await client.query(
            `INSERT INTO transactions (from_account_id, to_account_id, amount,
                                       transaction_type, initiated_by_user_id, status)
             VALUES ($1, NULL, $2, 'withdrawal', $3, 'pending')
             RETURNING *`,
            [from_account_id, amt, req.auth.user_id]
        );
        const tx = txIns.rows[0];

        await client.query(
            `INSERT INTO transaction_log (transaction_id, action, performed_by_user_id, description)
             VALUES ($1, 'requested', $2, $3)`,
            [tx.transaction_id, req.auth.user_id,
             `Customer requested withdrawal of ${amt} from acct ${from_account_id}.`]
        );

        await client.query('COMMIT');
        return res.status(201).json({
            message: 'Withdrawal request submitted; awaiting staff approval.',
            transaction: tx,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('customerWithdrawalRequest:', err);
        return res.status(500).json({ error: 'Withdrawal request failed' });
    } finally {
        client.release();
    }
}

module.exports = {
    getMe,
    getMyAccounts,
    getMyTransactions,
    customerTransfer,
    customerWithdrawalRequest,
};
