// backend/src/controllers/adminController.js

const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');
const { verifyChain } = require('../utils/hashChain');

// ---------- POST /api/admin/staff ----------
async function createStaff(req, res) {
    if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { full_name, email, phone_number, password, role, branch_id, access_level } = req.body || {};
    if (!full_name || !email || !password || !role) {
        return res.status(400).json({ error: 'full_name, email, password, role are required' });
    }
    if (!['admin', 'teller', 'analyst', 'manager'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    try {
        const dup = await query(`SELECT 1 FROM bank_staff WHERE email = $1`, [email]);
        if (dup.rowCount > 0) return res.status(409).json({ error: 'Email already used' });

        const hash = await bcrypt.hash(password, 10);
        const r = await query(
            `INSERT INTO bank_staff (full_name, email, phone_number, password_hash, role, branch_id, access_level, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
             RETURNING staff_id, full_name, email, role, branch_id, access_level, status, created_at`,
            [full_name, email, phone_number || null, hash, role, branch_id || null, access_level || 1]
        );
        return res.status(201).json(r.rows[0]);
    } catch (err) {
        console.error('createStaff:', err);
        return res.status(500).json({ error: 'Failed to create staff' });
    }
}

// ---------- POST /api/admin/branches ----------
async function createBranch(req, res) {
    if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { name, location } = req.body || {};
    if (!name || !location) return res.status(400).json({ error: 'name and location are required' });
    try {
        const r = await query(
            `INSERT INTO branch (name, location) VALUES ($1, $2) RETURNING *`,
            [name, location]
        );
        return res.status(201).json(r.rows[0]);
    } catch (err) {
        console.error('createBranch:', err);
        return res.status(500).json({ error: 'Failed to create branch' });
    }
}

// ---------- GET /api/admin/branches ----------
async function listBranches(req, res) {
    try {
        const r = await query(`SELECT * FROM branch ORDER BY branch_id`);
        return res.json(r.rows);
    } catch (err) {
        console.error('listBranches:', err);
        return res.status(500).json({ error: 'Failed to load branches' });
    }
}

// ---------- GET /api/admin/dashboard ----------
async function dashboard(req, res) {
    try {
        const [
            customers, accounts, balance, transactions, pendingAlerts, highRisk, recentTx, recentLogs
        ] = await Promise.all([
            query(`SELECT COUNT(*)::int AS c FROM users`),
            query(`SELECT COUNT(*)::int AS c FROM account`),
            query(`SELECT COALESCE(SUM(balance), 0)::numeric AS s FROM account WHERE status = 'active'`),
            query(`SELECT COUNT(*)::int AS c FROM transactions`),
            query(`SELECT COUNT(*)::int AS c FROM fraud_alert WHERE status = 'pending'`),
            query(`SELECT COUNT(*)::int AS c FROM fraud_alert WHERE risk_level = 'high' AND status = 'pending'`),
            query(`SELECT transaction_id, amount, transaction_type, status, timestamp,
                          from_account_id, to_account_id
                     FROM transactions ORDER BY timestamp DESC LIMIT 10`),
            query(`SELECT log_id, transaction_id, action, timestamp, description
                     FROM transaction_log ORDER BY timestamp DESC LIMIT 10`),
        ]);

        // Light integrity check: just hash count vs success+flagged tx count.
        const counts = await query(`
            SELECT
                (SELECT COUNT(*) FROM transactions WHERE status IN ('success', 'flagged'))::int AS expected,
                (SELECT COUNT(*) FROM transaction_hash)::int AS actual
        `);

        return res.json({
            counts: {
                customers:      customers.rows[0].c,
                accounts:       accounts.rows[0].c,
                total_balance:  Number(balance.rows[0].s),
                transactions:   transactions.rows[0].c,
                pending_alerts: pendingAlerts.rows[0].c,
                high_risk_alerts: highRisk.rows[0].c,
            },
            chain_summary: {
                expected_hashed: counts.rows[0].expected,
                actual_hashed:   counts.rows[0].actual,
                aligned:         counts.rows[0].expected === counts.rows[0].actual,
            },
            recent_transactions: recentTx.rows,
            recent_logs:         recentLogs.rows,
        });
    } catch (err) {
        console.error('dashboard:', err);
        return res.status(500).json({ error: 'Failed to load dashboard' });
    }
}

// ---------- GET /api/admin/logs ----------
async function listLogs(req, res) {
    try {
        const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
        const r = await query(
            `SELECT l.log_id, l.transaction_id, l.action, l.timestamp, l.description,
                    u.full_name  AS user_name,
                    bs.full_name AS staff_name
               FROM transaction_log l
               LEFT JOIN users      u  ON u.user_id   = l.performed_by_user_id
               LEFT JOIN bank_staff bs ON bs.staff_id = l.performed_by_staff_id
              ORDER BY l.timestamp DESC
              LIMIT $1`,
            [limit]
        );
        return res.json(r.rows);
    } catch (err) {
        console.error('listLogs:', err);
        return res.status(500).json({ error: 'Failed to load logs' });
    }
}

// ---------- GET /api/admin/integrity/verify ----------
async function integrityVerify(req, res) {
    try {
        const result = await verifyChain(pool);
        return res.json(result);
    } catch (err) {
        console.error('integrityVerify:', err);
        return res.status(500).json({ error: 'Verification failed' });
    }
}

// ---------- GET /api/admin/reports/summary ----------
async function reportsSummary(req, res) {
    try {
        const txByDay = await query(`
            SELECT DATE(timestamp) AS day,
                   COUNT(*)::int AS count,
                   COALESCE(SUM(amount), 0)::numeric AS total_amount
              FROM transactions
              WHERE timestamp >= NOW() - INTERVAL '30 days'
              GROUP BY DATE(timestamp)
              ORDER BY day DESC
        `);
        const txByType = await query(`
            SELECT transaction_type, status, COUNT(*)::int AS count
              FROM transactions
              GROUP BY transaction_type, status
              ORDER BY transaction_type
        `);
        const alertsByRisk = await query(`
            SELECT risk_level, status, COUNT(*)::int AS count
              FROM fraud_alert
              GROUP BY risk_level, status
              ORDER BY risk_level
        `);
        const balanceByBranch = await query(`
            SELECT b.branch_id, b.name,
                   COUNT(a.account_id)::int AS account_count,
                   COALESCE(SUM(a.balance), 0)::numeric AS total_balance
              FROM branch b
              LEFT JOIN account a ON a.branch_id = b.branch_id
              GROUP BY b.branch_id, b.name
              ORDER BY b.branch_id
        `);
        return res.json({
            transactions_by_day:   txByDay.rows,
            transactions_by_type:  txByType.rows,
            alerts_by_risk:        alertsByRisk.rows,
            balance_by_branch:     balanceByBranch.rows,
        });
    } catch (err) {
        console.error('reportsSummary:', err);
        return res.status(500).json({ error: 'Failed to build report' });
    }
}

// ---------- GET /api/admin/fraud-rules ----------
async function listFraudRules(req, res) {
    try {
        const r = await query(`SELECT * FROM fraud_rules ORDER BY rule_id`);
        return res.json(r.rows);
    } catch (err) {
        console.error('listFraudRules:', err);
        return res.status(500).json({ error: 'Failed to load rules' });
    }
}

// ---------- PATCH /api/admin/fraud-rules/:id ----------
async function updateFraudRule(req, res) {
    if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { threshold_value, time_window_minutes, risk_level, is_active } = req.body || {};
    try {
        const r = await query(
            `UPDATE fraud_rules
                SET threshold_value     = COALESCE($1, threshold_value),
                    time_window_minutes = COALESCE($2, time_window_minutes),
                    risk_level          = COALESCE($3, risk_level),
                    is_active           = COALESCE($4, is_active)
              WHERE rule_id = $5
              RETURNING *`,
            [threshold_value, time_window_minutes, risk_level, is_active, req.params.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Rule not found' });
        return res.json(r.rows[0]);
    } catch (err) {
        console.error('updateFraudRule:', err);
        return res.status(500).json({ error: 'Failed to update rule' });
    }
}

// ---------- GET /api/admin/users ----------
async function listUsers(req, res) {
    try {
        const r = await query(
            `SELECT user_id, full_name, email, phone, created_at FROM users ORDER BY user_id`
        );
        return res.json(r.rows);
    } catch (err) {
        console.error('listUsers:', err);
        return res.status(500).json({ error: 'Failed to load users' });
    }
}

module.exports = {
    createStaff,
    createBranch,
    listBranches,
    dashboard,
    listLogs,
    integrityVerify,
    reportsSummary,
    listFraudRules,
    updateFraudRule,
    listUsers,
};
