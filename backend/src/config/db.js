// backend/src/config/db.js
// PostgreSQL connection pool. All queries go through this.

const { Pool, types } = require('pg');

// IMPORTANT: by default pg returns TIMESTAMP/TIMESTAMPTZ as JS Date,
// which complicates deterministic hashing across the seed (PL/pgSQL)
// and the backend (Node). We override the parsers to return ISO strings
// in the form "YYYY-MM-DDTHH:MM:SS" so the hash payload bytes are
// identical on both sides.
const TIMESTAMP_OID   = 1114; // 'timestamp without time zone'
const TIMESTAMPTZ_OID = 1184; // 'timestamp with time zone'

function toIsoSeconds(value) {
    if (value == null) return null;
    // value is the raw text from Postgres, e.g. "2026-04-15 12:34:56"
    // or with fractional seconds. We strip fractional seconds, replace
    // the space with 'T', and drop any timezone offset.
    const cleaned = String(value)
        .replace(/\.\d+/, '')
        .replace(/[+-]\d{2}(:?\d{2})?$/, '')
        .replace(' ', 'T')
        .trim();
    return cleaned;
}

types.setTypeParser(TIMESTAMP_OID,   toIsoSeconds);
types.setTypeParser(TIMESTAMPTZ_OID, toIsoSeconds);

const pool = new Pool({
    host:     process.env.PGHOST     || 'localhost',
    port:     parseInt(process.env.PGPORT || '5432', 10),
    user:     process.env.PGUSER     || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'securebank',
    max: 10,
    idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
    console.error('Unexpected PG pool error:', err);
});

// Convenience query helper
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
