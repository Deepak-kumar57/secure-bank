// backend/src/controllers/staffController.js

const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');
const { appendHash } = require('../utils/hashChain');
const { runFraudChecks, hasHighRisk } = require('../utils/fraudEngine');

// ---------- GET /api/staff/accounts ----------
// Tellers see accounts at their branch; admin/manager see everything.
async function listAccounts(req, res) {
    try {
        const { role, branch_id } = req.auth;
        let rows;
        if (role === 'admin' || role === 'manager') {
            rows = (await query(
                `SELECT a.account_id, a.account_type, a.balance, a.status, a.created_at,
                        u.user_id, u.full_name, u.email,
                        b.branch_id, b.name AS branch_name
                   FROM account a
                   JOIN users u ON u.user_id = a.user_id
                   JOIN branch b ON b.branch_id = a.branch_id
                  ORDER BY a.account_id DESC`
            )).rows;
        } else {
            rows = (await query(
                `SELECT a.account_id, a.account_type, a.balance, a.status, a.created_at,
                        u.user_id, u.full_name, u.email,
                        b.branch_id, b.name AS branch_name
                   FROM account a
                   JOIN users u ON u.user_id = a.user_id
                   JOIN branch b ON b.branch_id = a.branch_id
                  WHERE a.branch_id = $1
                  ORDER BY a.account_id DESC`,
                [branch_id]
            )).rows;
        }
        return res.json(rows);
    } catch (err) {
        console.error('listAccounts:', err);
        return res.status(500).json({ error: 'Failed to list accounts' });
    }
}

// ---------- POST /api/staff/accounts ----------
// Create a new account for an existing customer (admin/teller).
async function createAccount(req, res) {
    const { user_id, branch_id, account_type, initial_balance } = req.body || {};
    if (!user_id || !branch_id || !account_type) {
        return res.status(400).json({ error: 'user_id, branch_id, account_type are required' });
    }
    if (!['savings', 'current'].includes(account_type)) {
        return res.status(400).json({ error: "account_type must be 'savings' or 'current'" });
    }
    const balance = Number(initial_balance) || 0;
    if (balance < 0) return res.status(400).json({ error: 'initial_balance cannot be negative' });

    try {
        const u = await query(`SELECT 1 FROM users WHERE user_id = $1`, [user_id]);
        if (u.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        const b = await query(`SELECT 1 FROM branch WHERE branch_id = $1`, [branch_id]);
        if (b.rowCount === 0) return res.status(404).json({ error: 'Branch not found' });

        const r = await query(
            `INSERT INTO account (user_id, branch_id, account_type, balance, status)
             VALUES ($1, $2, $3, $4, 'active')
             RETURNING *`,
            [user_id, branch_id, account_type, balance]
        );
        return res.status(201).json(r.rows[0]);
    } catch (err) {
        console.error('createAccount:', err);
        return res.status(500).json({ error: 'Failed to create account' });
    }
}

// ---------- POST /api/staff/deposit ----------
// Admin or teller deposits cash into an account. Customers may NOT deposit.
async function deposit(req, res) {
    if (!['admin', 'teller'].includes(req.auth.role)) {
        return res.status(403).json({ error: 'Only admin or teller can deposit' });
    }
    const { to_account_id, amount } = req.body || {};
    const amt = Number(amount);
    if (!to_account_id || !amt) return res.status(400).json({ error: 'to_account_id and amount required' });
    if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const acctRes = await client.query(`SELECT * FROM account WHERE account_id = $1 FOR UPDATE`, [to_account_id]);
        const acct = acctRes.rows[0];
        if (!acct) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Account not found' });
        }
        if (acct.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Account is ${acct.status}` });
        }

        const txIns = await client.query(
            `INSERT INTO transactions (from_account_id, to_account_id, amount,
                                       transaction_type, initiated_by_staff_id, status)
             VALUES (NULL, $1, $2, 'deposit', $3, 'pending')
             RETURNING *`,
            [to_account_id, amt, req.auth.staff_id]
        );
        const tx = txIns.rows[0];

        const alerts = await runFraudChecks(client, tx);
        // Deposits don't get blocked even on HIGH; we still log alerts (HIGH_AMOUNT for big deposits).
        await client.query(`UPDATE account SET balance = balance + $1 WHERE account_id = $2`, [amt, to_account_id]);
        await client.query(`UPDATE transactions SET status = 'success' WHERE transaction_id = $1`, [tx.transaction_id]);

        const refreshed = await client.query(`SELECT * FROM transactions WHERE transaction_id = $1`, [tx.transaction_id]);
        const finalTx = refreshed.rows[0];
        await appendHash(client, finalTx);

        await client.query(
            `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
             VALUES ($1, 'created', $2, $3)`,
            [finalTx.transaction_id, req.auth.staff_id,
             `Staff ${req.auth.email} deposited ${amt} into acct ${to_account_id}.`]
        );

        await client.query('COMMIT');
        return res.status(201).json({ status: 'success', transaction: finalTx, alerts });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('deposit:', err);
        return res.status(500).json({ error: 'Deposit failed' });
    } finally {
        client.release();
    }
}

// ---------- POST /api/staff/withdraw ----------
// Approves/processes a withdrawal. Two modes:
//   1. With { transaction_id }   -> approve an existing pending request (deduct balance).
//   2. With { from_account_id, amount } -> create + complete in one shot (teller-walk-in).
async function withdraw(req, res) {
    if (!['admin', 'teller'].includes(req.auth.role)) {
        return res.status(403).json({ error: 'Only admin or teller can process withdrawals' });
    }
    const { transaction_id, from_account_id, amount } = req.body || {};

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let tx;
        if (transaction_id) {
            // Mode 1: approve existing pending request.
            const r = await client.query(
                `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
                [transaction_id]
            );
            tx = r.rows[0];
            if (!tx) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Transaction not found' });
            }
            if (tx.transaction_type !== 'withdrawal' || tx.status !== 'pending') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Not a pending withdrawal' });
            }
        } else {
            // Mode 2: create-and-complete.
            const amt = Number(amount);
            if (!from_account_id || !amt || amt <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'from_account_id and positive amount required' });
            }
            const ins = await client.query(
                `INSERT INTO transactions (from_account_id, to_account_id, amount,
                                           transaction_type, initiated_by_staff_id, status)
                 VALUES ($1, NULL, $2, 'withdrawal', $3, 'pending')
                 RETURNING *`,
                [from_account_id, amt, req.auth.staff_id]
            );
            tx = ins.rows[0];
        }

        // Lock and validate the account.
        const acctRes = await client.query(
            `SELECT * FROM account WHERE account_id = $1 FOR UPDATE`,
            [tx.from_account_id]
        );
        const acct = acctRes.rows[0];
        if (!acct) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Account not found' });
        }
        if (acct.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Account is ${acct.status}` });
        }
        if (Number(acct.balance) < Number(tx.amount)) {
            // Mark as failed.
            await client.query(`UPDATE transactions SET status = 'failed' WHERE transaction_id = $1`, [tx.transaction_id]);
            await client.query(
                `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
                 VALUES ($1, 'failed', $2, 'Insufficient balance')`,
                [tx.transaction_id, req.auth.staff_id]
            );
            await client.query('COMMIT');
            return res.status(400).json({ error: 'Insufficient balance', transaction: { ...tx, status: 'failed' } });
        }

        // Run fraud checks now (they apply to staff-processed withdrawals too).
        const alerts = await runFraudChecks(client, tx);
        if (hasHighRisk(alerts)) {
            await client.query(`UPDATE transactions SET status = 'flagged' WHERE transaction_id = $1`, [tx.transaction_id]);
            await client.query(
                `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
                 VALUES ($1, 'flagged', $2, 'Withdrawal flagged by fraud engine')`,
                [tx.transaction_id, req.auth.staff_id]
            );
            const refreshed = await client.query(`SELECT * FROM transactions WHERE transaction_id = $1`, [tx.transaction_id]);
            await appendHash(client, refreshed.rows[0]);
            await client.query('COMMIT');
            return res.status(202).json({
                status: 'flagged',
                message: 'Withdrawal flagged; awaiting fraud review.',
                transaction: refreshed.rows[0],
                alerts,
            });
        }

        // Deduct & complete.
        await client.query(`UPDATE account SET balance = balance - $1 WHERE account_id = $2`, [tx.amount, tx.from_account_id]);
        await client.query(`UPDATE transactions SET status = 'success' WHERE transaction_id = $1`, [tx.transaction_id]);

        const refreshed = await client.query(`SELECT * FROM transactions WHERE transaction_id = $1`, [tx.transaction_id]);
        const finalTx = refreshed.rows[0];
        await appendHash(client, finalTx);

        await client.query(
            `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
             VALUES ($1, 'approved', $2, $3)`,
            [finalTx.transaction_id, req.auth.staff_id,
             `Staff ${req.auth.email} processed withdrawal of ${tx.amount} from acct ${tx.from_account_id}.`]
        );

        await client.query('COMMIT');
        return res.json({ status: 'success', transaction: finalTx, alerts });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('withdraw:', err);
        return res.status(500).json({ error: 'Withdrawal failed' });
    } finally {
        client.release();
    }
}

// ---------- GET /api/staff/withdrawals/pending ----------
async function listPendingWithdrawals(req, res) {
    try {
        const { role, branch_id } = req.auth;
        const baseSql = `
            SELECT t.transaction_id, t.from_account_id, t.amount, t.timestamp, t.status,
                   u.full_name AS customer_name, u.email AS customer_email,
                   a.branch_id
              FROM transactions t
              JOIN account a ON a.account_id = t.from_account_id
              JOIN users   u ON u.user_id    = a.user_id
             WHERE t.transaction_type = 'withdrawal' AND t.status = 'pending'
        `;
        const rows = (role === 'admin' || role === 'manager')
            ? (await query(baseSql + ` ORDER BY t.timestamp ASC`)).rows
            : (await query(baseSql + ` AND a.branch_id = $1 ORDER BY t.timestamp ASC`, [branch_id])).rows;
        return res.json(rows);
    } catch (err) {
        console.error('listPendingWithdrawals:', err);
        return res.status(500).json({ error: 'Failed to list pending withdrawals' });
    }
}

// ---------- POST /api/staff/transfer ----------
// Staff-initiated transfer (e.g. handling in-branch customer requests).
async function staffTransfer(req, res) {
    const { from_account_id, to_account_id, amount } = req.body || {};
    const amt = Number(amount);
    if (!from_account_id || !to_account_id || !amt) {
        return res.status(400).json({ error: 'from_account_id, to_account_id, amount required' });
    }
    if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    if (Number(from_account_id) === Number(to_account_id)) {
        return res.status(400).json({ error: 'Cannot transfer to the same account' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const fromRes = await client.query(`SELECT * FROM account WHERE account_id = $1 FOR UPDATE`, [from_account_id]);
        const toRes   = await client.query(`SELECT * FROM account WHERE account_id = $1 FOR UPDATE`, [to_account_id]);
        const from = fromRes.rows[0];
        const to   = toRes.rows[0];
        if (!from || !to) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Account not found' }); }
        if (from.status !== 'active') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Source account is ${from.status}` }); }
        if (to.status   !== 'active') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Destination account is ${to.status}` }); }
        if (Number(from.balance) < amt) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }

        const ins = await client.query(
            `INSERT INTO transactions (from_account_id, to_account_id, amount,
                                       transaction_type, initiated_by_staff_id, status)
             VALUES ($1, $2, $3, 'transfer', $4, 'pending')
             RETURNING *`,
            [from_account_id, to_account_id, amt, req.auth.staff_id]
        );
        const tx = ins.rows[0];
        const alerts = await runFraudChecks(client, tx);

        if (hasHighRisk(alerts)) {
            await client.query(`UPDATE transactions SET status = 'flagged' WHERE transaction_id = $1`, [tx.transaction_id]);
            const refreshed = await client.query(`SELECT * FROM transactions WHERE transaction_id = $1`, [tx.transaction_id]);
            await appendHash(client, refreshed.rows[0]);
            await client.query(
                `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
                 VALUES ($1, 'flagged', $2, 'Staff transfer flagged by fraud engine')`,
                [tx.transaction_id, req.auth.staff_id]
            );
            await client.query('COMMIT');
            return res.status(202).json({ status: 'flagged', transaction: refreshed.rows[0], alerts });
        }

        await client.query(`UPDATE account SET balance = balance - $1 WHERE account_id = $2`, [amt, from_account_id]);
        await client.query(`UPDATE account SET balance = balance + $1 WHERE account_id = $2`, [amt, to_account_id]);
        await client.query(`UPDATE transactions SET status = 'success' WHERE transaction_id = $1`, [tx.transaction_id]);

        const refreshed = await client.query(`SELECT * FROM transactions WHERE transaction_id = $1`, [tx.transaction_id]);
        const finalTx = refreshed.rows[0];
        await appendHash(client, finalTx);

        await client.query(
            `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
             VALUES ($1, 'created', $2, $3)`,
            [finalTx.transaction_id, req.auth.staff_id,
             `Staff transfer of ${amt} from acct ${from_account_id} to acct ${to_account_id}.`]
        );

        await client.query('COMMIT');
        return res.status(201).json({ status: 'success', transaction: finalTx, alerts });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('staffTransfer:', err);
        return res.status(500).json({ error: 'Transfer failed' });
    } finally {
        client.release();
    }
}

// ---------- Account state changes ----------
async function setAccountStatus(accountId, newStatus, allowedFrom, staffId, action) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(`SELECT * FROM account WHERE account_id = $1 FOR UPDATE`, [accountId]);
        const acct = r.rows[0];
        if (!acct) { await client.query('ROLLBACK'); return { error: 'Account not found', status: 404 }; }
        if (!allowedFrom.includes(acct.status)) {
            await client.query('ROLLBACK');
            return { error: `Cannot transition from ${acct.status} to ${newStatus}`, status: 400 };
        }
        await client.query(`UPDATE account SET status = $1 WHERE account_id = $2`, [newStatus, accountId]);
        await client.query(
            `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
             VALUES (NULL, $1, $2, $3)`,
            [action, staffId, `Account ${accountId} status changed: ${acct.status} -> ${newStatus}`]
        );
        await client.query('COMMIT');
        return { ok: true };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('setAccountStatus:', err);
        return { error: 'Status change failed', status: 500 };
    } finally {
        client.release();
    }
}

async function freezeAccount(req, res) {
    if (!['admin', 'manager'].includes(req.auth.role)) return res.status(403).json({ error: 'Forbidden' });
    const r = await setAccountStatus(req.params.id, 'frozen', ['active'], req.auth.staff_id, 'account_frozen');
    if (r.error) return res.status(r.status).json({ error: r.error });
    return res.json({ message: 'Account frozen' });
}

async function unfreezeAccount(req, res) {
    if (!['admin', 'manager'].includes(req.auth.role)) return res.status(403).json({ error: 'Forbidden' });
    const r = await setAccountStatus(req.params.id, 'active', ['frozen'], req.auth.staff_id, 'account_unfrozen');
    if (r.error) return res.status(r.status).json({ error: r.error });
    return res.json({ message: 'Account unfrozen' });
}

async function closeAccount(req, res) {
    if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Only admin can close accounts' });
    const r = await setAccountStatus(req.params.id, 'closed', ['active', 'frozen'], req.auth.staff_id, 'account_closed');
    if (r.error) return res.status(r.status).json({ error: r.error });
    return res.json({ message: 'Account closed' });
}

module.exports = {
    listAccounts,
    createAccount,
    deposit,
    withdraw,
    listPendingWithdrawals,
    staffTransfer,
    freezeAccount,
    unfreezeAccount,
    closeAccount,
};
