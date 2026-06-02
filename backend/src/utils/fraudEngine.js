// backend/src/utils/fraudEngine.js
// Rule-based fraud detection engine.
//
// Runs after a transaction has been INSERTed (inside the same DB transaction).
// Inserts fraud_alert rows when rules fire.
// Returns an array of triggered alerts so the caller can decide whether
// to mark the transaction as 'flagged' (HIGH risk).

/**
 * Look up an active fraud rule by name.
 */
async function getRule(client, ruleName) {
    const r = await client.query(
        `SELECT * FROM fraud_rules WHERE rule_name = $1 AND is_active = TRUE`,
        [ruleName]
    );
    return r.rows[0] || null;
}

async function insertAlert(client, { transactionId, alertType, riskLevel, description }) {
    const r = await client.query(
        `INSERT INTO fraud_alert (transaction_id, alert_type, risk_level, description, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [transactionId, alertType, riskLevel, description]
    );
    return r.rows[0];
}

/**
 * HIGH AMOUNT rule.
 * Fires when amount > threshold; risk level taken from the rule (default high).
 */
async function checkHighAmount(client, tx) {
    const rule = await getRule(client, 'HIGH_AMOUNT');
    if (!rule) return null;
    if (Number(tx.amount) > Number(rule.threshold_value)) {
        return await insertAlert(client, {
            transactionId: tx.transaction_id,
            alertType:    'HIGH_AMOUNT',
            riskLevel:    rule.risk_level,
            description:  `Transaction amount ${tx.amount} exceeds threshold ${rule.threshold_value}.`,
        });
    }
    return null;
}

/**
 * VELOCITY rule.
 * Fires when the same source account has performed (threshold) or more
 * transactions within (time_window_minutes) minutes, including this one.
 */
async function checkVelocity(client, tx) {
    if (!tx.from_account_id) return null;
    const rule = await getRule(client, 'VELOCITY');
    if (!rule) return null;

    const windowMin = rule.time_window_minutes || 10;
    const threshold = Number(rule.threshold_value);

    const r = await client.query(
        `SELECT COUNT(*)::int AS cnt
           FROM transactions
          WHERE from_account_id = $1
            AND timestamp >= (NOW() - ($2::int || ' minutes')::interval)`,
        [tx.from_account_id, windowMin]
    );

    if (r.rows[0].cnt >= threshold) {
        return await insertAlert(client, {
            transactionId: tx.transaction_id,
            alertType:    'VELOCITY',
            riskLevel:    rule.risk_level,
            description:  `Account ${tx.from_account_id} performed ${r.rows[0].cnt} transactions in last ${windowMin} minutes (threshold ${threshold}).`,
        });
    }
    return null;
}

/**
 * RAPID TRANSFER rule.
 * Fires when one account has sent transfers to (threshold) or more
 * DISTINCT destination accounts within (time_window_minutes) minutes.
 */
async function checkRapidTransfer(client, tx) {
    if (tx.transaction_type !== 'transfer' || !tx.from_account_id) return null;
    const rule = await getRule(client, 'RAPID_TRANSFER');
    if (!rule) return null;

    const windowMin = rule.time_window_minutes || 15;
    const threshold = Number(rule.threshold_value);

    const r = await client.query(
        `SELECT COUNT(DISTINCT to_account_id)::int AS cnt
           FROM transactions
          WHERE from_account_id = $1
            AND transaction_type = 'transfer'
            AND timestamp >= (NOW() - ($2::int || ' minutes')::interval)`,
        [tx.from_account_id, windowMin]
    );

    if (r.rows[0].cnt >= threshold) {
        return await insertAlert(client, {
            transactionId: tx.transaction_id,
            alertType:    'RAPID_TRANSFER',
            riskLevel:    rule.risk_level,
            description:  `Account ${tx.from_account_id} sent transfers to ${r.rows[0].cnt} distinct accounts in last ${windowMin} minutes.`,
        });
    }
    return null;
}

/**
 * Main entry point. Runs all transactional rules against tx and returns
 * an array of triggered alert rows.
 */
async function runFraudChecks(client, tx) {
    const triggered = [];
    const a = await checkHighAmount(client, tx);
    if (a) triggered.push(a);
    const b = await checkVelocity(client, tx);
    if (b) triggered.push(b);
    const c = await checkRapidTransfer(client, tx);
    if (c) triggered.push(c);
    return triggered;
}

/**
 * Helper: any HIGH risk alert in the list means the transaction
 * should be marked as 'flagged' instead of completing normally.
 */
function hasHighRisk(alerts) {
    return alerts.some((a) => a && a.risk_level === 'high');
}

/**
 * NEW DEVICE rule (called separately from login flow, not a transaction).
 * Returns true when the IP/device is not previously trusted for that user.
 */
async function isUntrustedDevice(client, userId, ipAddress, deviceType) {
    const r = await client.query(
        `SELECT 1
           FROM device_session
          WHERE user_id = $1
            AND ip_address = $2
            AND device_type = $3
            AND is_trusted = TRUE
          LIMIT 1`,
        [userId, ipAddress, deviceType]
    );
    return r.rowCount === 0;
}

module.exports = {
    runFraudChecks,
    hasHighRisk,
    isUntrustedDevice,
};
