// backend/src/controllers/fraudController.js

const { pool, query } = require('../config/db');

const FRAUD_ROLES = ['analyst', 'admin', 'manager'];

function requireFraudRole(req, res) {
    if (!FRAUD_ROLES.includes(req.auth.role)) {
        res.status(403).json({ error: 'Requires analyst, manager, or admin' });
        return false;
    }
    return true;
}

// ---------- GET /api/fraud/alerts ----------
async function listAlerts(req, res) {
    if (!requireFraudRole(req, res)) return;
    try {
        const r = await query(`
            SELECT fa.*,
                   t.amount, t.transaction_type, t.from_account_id, t.to_account_id, t.timestamp AS tx_timestamp,
                   bs.full_name AS reviewer_name
              FROM fraud_alert fa
              JOIN transactions t ON t.transaction_id = fa.transaction_id
              LEFT JOIN bank_staff bs ON bs.staff_id = fa.reviewed_by
             ORDER BY fa.created_at DESC
             LIMIT 200
        `);
        return res.json(r.rows);
    } catch (err) {
        console.error('listAlerts:', err);
        return res.status(500).json({ error: 'Failed to load alerts' });
    }
}

// ---------- GET /api/fraud/alerts/pending ----------
async function listPendingAlerts(req, res) {
    if (!requireFraudRole(req, res)) return;
    try {
        const r = await query(`
            SELECT fa.*,
                   t.amount, t.transaction_type, t.from_account_id, t.to_account_id, t.timestamp AS tx_timestamp
              FROM fraud_alert fa
              JOIN transactions t ON t.transaction_id = fa.transaction_id
             WHERE fa.status = 'pending'
             ORDER BY
                CASE fa.risk_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                fa.created_at DESC
        `);
        return res.json(r.rows);
    } catch (err) {
        console.error('listPendingAlerts:', err);
        return res.status(500).json({ error: 'Failed to load pending alerts' });
    }
}

// ---------- PATCH /api/fraud/alerts/:id/resolve ----------
async function resolveAlert(req, res) {
    if (!requireFraudRole(req, res)) return;
    const { notes } = req.body || {};
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(`SELECT * FROM fraud_alert WHERE alert_id = $1 FOR UPDATE`, [req.params.id]);
        const alert = r.rows[0];
        if (!alert) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Alert not found' }); }
        if (alert.status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Alert already reviewed' }); }

        await client.query(
            `UPDATE fraud_alert SET status = 'resolved', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2
             WHERE alert_id = $3`,
            [req.auth.staff_id, notes || null, alert.alert_id]
        );
        await client.query(
            `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
             VALUES ($1, 'alert_resolved', $2, $3)`,
            [alert.transaction_id, req.auth.staff_id,
             `Fraud alert ${alert.alert_id} resolved by ${req.auth.email}.`]
        );
        await client.query('COMMIT');
        return res.json({ message: 'Alert resolved' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('resolveAlert:', err);
        return res.status(500).json({ error: 'Failed to resolve alert' });
    } finally {
        client.release();
    }
}

// ---------- PATCH /api/fraud/alerts/:id/reject ----------
async function rejectAlert(req, res) {
    if (!requireFraudRole(req, res)) return;
    const { notes } = req.body || {};
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(`SELECT * FROM fraud_alert WHERE alert_id = $1 FOR UPDATE`, [req.params.id]);
        const alert = r.rows[0];
        if (!alert) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Alert not found' }); }
        if (alert.status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Alert already reviewed' }); }

        await client.query(
            `UPDATE fraud_alert SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2
             WHERE alert_id = $3`,
            [req.auth.staff_id, notes || null, alert.alert_id]
        );
        await client.query(
            `INSERT INTO transaction_log (transaction_id, action, performed_by_staff_id, description)
             VALUES ($1, 'alert_rejected', $2, $3)`,
            [alert.transaction_id, req.auth.staff_id,
             `Fraud alert ${alert.alert_id} rejected by ${req.auth.email}.`]
        );
        await client.query('COMMIT');
        return res.json({ message: 'Alert rejected' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('rejectAlert:', err);
        return res.status(500).json({ error: 'Failed to reject alert' });
    } finally {
        client.release();
    }
}

module.exports = { listAlerts, listPendingAlerts, resolveAlert, rejectAlert };
