// backend/src/utils/hashChain.js
// SHA-256 hash chain over the transactions table.
//
// Formula:
//   current_hash = SHA-256(
//       transaction_id | amount | timestamp | from_account_id | to_account_id | previous_hash
//   )
// The previous_hash of the very first chained transaction is the literal "GENESIS".

const crypto = require('crypto');

const GENESIS = 'GENESIS';

/**
 * Canonicalize a timestamp to "YYYY-MM-DDTHH:MM:SS" (second-precision).
 * The pg type parser in config/db.js returns this format directly for
 * TIMESTAMP columns, and the seed SQL emits the same shape, so the
 * hash payload bytes match across both sides.
 */
function canonTimestamp(ts) {
    if (ts == null) return 'null';
    if (typeof ts === 'string') return ts;     // already canonical from pg parser
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toISOString().slice(0, 19);
}

/**
 * Canonicalize an amount as a fixed-point string with 2 decimals.
 * Postgres NUMERIC(15,2) returns "10000.00"; JS numbers may render as 10000.
 */
function canonAmount(value) {
    if (value == null) return 'null';
    return Number(value).toFixed(2);
}

/**
 * Build the canonical payload string for one transaction.
 * MUST be identical to the formula used by the seed SQL block,
 * otherwise verification will report mismatches.
 */
function buildPayload(tx, previousHash) {
    return [
        tx.transaction_id,
        canonAmount(tx.amount),
        canonTimestamp(tx.timestamp),
        tx.from_account_id == null ? 'null' : tx.from_account_id,
        tx.to_account_id   == null ? 'null' : tx.to_account_id,
        previousHash,
    ].join('|');
}

function sha256Hex(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Compute the SHA-256 hash for a single transaction given the
 * previous_hash. Returns { previous_hash, current_hash }.
 */
function generateTransactionHash(tx, previousHash) {
    const prev = previousHash || GENESIS;
    const payload = buildPayload(tx, prev);
    return {
        previous_hash: prev,
        current_hash:  sha256Hex(payload),
    };
}

/**
 * Insert a new hash chain row inside an open DB client (for use in
 * a transaction). Looks up the most recent stored hash and links to it.
 *
 * @param {object} client  pg client with an open BEGIN
 * @param {object} tx      the transaction row that was just inserted
 *                         (must include transaction_id, amount, timestamp,
 *                          from_account_id, to_account_id)
 * @returns {Promise<object>} the inserted hash row
 */
async function appendHash(client, tx) {
    // Find the most recent stored hash to chain from.
    const prev = await client.query(
        `SELECT current_hash
           FROM transaction_hash
          ORDER BY hash_id DESC
          LIMIT 1`
    );
    const previousHash = prev.rows[0] ? prev.rows[0].current_hash : GENESIS;

    // Normalize the timestamp to the same format Postgres returns
    // (ISO string from JS Date works because we store the row's actual timestamp).
    const { current_hash } = generateTransactionHash(tx, previousHash);

    const inserted = await client.query(
        `INSERT INTO transaction_hash (transaction_id, previous_hash, current_hash)
         VALUES ($1, $2, $3)
         RETURNING hash_id, transaction_id, previous_hash, current_hash, created_at`,
        [tx.transaction_id, previousHash, current_hash]
    );
    return inserted.rows[0];
}

/**
 * Verify the entire hash chain.
 * Returns { valid, checkedTransactions, brokenAt, message }.
 *
 * @param {object} pool  the pg pool
 */
async function verifyChain(pool) {
    // Pull every chained transaction along with its stored hash row,
    // ordered by the hash insertion sequence.
    const result = await pool.query(`
        SELECT  th.hash_id,
                th.transaction_id,
                th.previous_hash AS stored_prev,
                th.current_hash  AS stored_cur,
                t.amount,
                t.timestamp,
                t.from_account_id,
                t.to_account_id
          FROM transaction_hash th
          JOIN transactions t ON t.transaction_id = th.transaction_id
         ORDER BY th.hash_id ASC
    `);

    const rows = result.rows;
    let expectedPrev = GENESIS;
    let checked = 0;

    for (const row of rows) {
        // 1. Check that previous_hash matches expected linkage.
        if (row.stored_prev !== expectedPrev) {
            return {
                valid: false,
                checkedTransactions: checked,
                brokenAt: row.transaction_id,
                message:
                    `Chain link broken at transaction ${row.transaction_id}: ` +
                    `expected previous_hash "${expectedPrev}", found "${row.stored_prev}".`,
            };
        }

        // 2. Recompute current_hash from raw transaction fields.
        const recomputed = sha256Hex(
            buildPayload(
                {
                    transaction_id:  row.transaction_id,
                    amount:          row.amount,
                    timestamp:       row.timestamp,
                    from_account_id: row.from_account_id,
                    to_account_id:   row.to_account_id,
                },
                row.stored_prev
            )
        );

        if (recomputed !== row.stored_cur) {
            return {
                valid: false,
                checkedTransactions: checked,
                brokenAt: row.transaction_id,
                message:
                    `Hash mismatch at transaction ${row.transaction_id}: ` +
                    `the stored data does not match the stored hash. Tampering suspected.`,
            };
        }

        expectedPrev = row.stored_cur;
        checked += 1;
    }

    return {
        valid: true,
        checkedTransactions: checked,
        brokenAt: null,
        message:
            checked === 0
                ? 'No chained transactions yet.'
                : `All ${checked} transactions verified successfully.`,
    };
}

module.exports = {
    GENESIS,
    generateTransactionHash,
    appendHash,
    verifyChain,
};
