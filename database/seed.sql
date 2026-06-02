-- =====================================================================
-- SecureBank — Seed Data
-- CS232: Database Management Systems
-- =====================================================================
-- Run AFTER schema.sql:  psql -d securebank -f database/seed.sql
--
-- NOTE: This script uses pgcrypto's crypt() with bf salt to generate
-- real bcrypt hashes that are compatible with the Node bcryptjs library
-- used by the backend. No external scripts needed.
-- =====================================================================

-- Required for crypt() / gen_salt('bf')
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wipe existing data (preserves schema). Order matters due to FKs.
TRUNCATE TABLE
    transaction_log,
    fraud_alert,
    transaction_hash,
    transactions,
    device_session,
    account,
    bank_staff,
    branch,
    users,
    fraud_rules
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------
INSERT INTO branch (name, location) VALUES
    ('SecureBank — Main Branch',     'Islamabad, Pakistan'),
    ('SecureBank — Topi Branch',     'Topi, Khyber Pakhtunkhwa'),
    ('SecureBank — Lahore Branch',   'Lahore, Punjab');

-- ---------------------------------------------------------------------
-- Bank staff (one of each role)
-- Passwords:
--   admin@securebank.local    -> Admin@123
--   teller@securebank.local   -> Teller@123
--   analyst@securebank.local  -> Analyst@123
--   manager@securebank.local  -> Manager@123
-- ---------------------------------------------------------------------
INSERT INTO bank_staff (full_name, email, phone_number, password_hash, role, branch_id, access_level, status) VALUES
    ('System Administrator', 'admin@securebank.local',   '+92-300-0000001',
        crypt('Admin@123',   gen_salt('bf', 10)), 'admin',   1, 3, 'active'),
    ('Tariq Mahmood',        'teller@securebank.local',  '+92-300-0000002',
        crypt('Teller@123',  gen_salt('bf', 10)), 'teller',  1, 1, 'active'),
    ('Sana Ahmed',           'analyst@securebank.local', '+92-300-0000003',
        crypt('Analyst@123', gen_salt('bf', 10)), 'analyst', 1, 2, 'active'),
    ('Imran Khan',           'manager@securebank.local', '+92-300-0000004',
        crypt('Manager@123', gen_salt('bf', 10)), 'manager', 1, 2, 'active'),
    ('Fatima Ali',           'teller2@securebank.local', '+92-300-0000005',
        crypt('Teller@123',  gen_salt('bf', 10)), 'teller',  2, 1, 'active');

-- ---------------------------------------------------------------------
-- Customers
-- Passwords:
--   alice@example.com    -> Alice@123
--   bob@example.com      -> Bob@123
--   charlie@example.com  -> Charlie@123
--   diana@example.com    -> Diana@123
--   ethan@example.com    -> Ethan@123
-- ---------------------------------------------------------------------
INSERT INTO users (full_name, email, phone, password_hash) VALUES
    ('Alice Hassan',   'alice@example.com',   '+92-301-1111111', crypt('Alice@123',   gen_salt('bf', 10))),
    ('Bob Siddiqui',   'bob@example.com',     '+92-301-2222222', crypt('Bob@123',     gen_salt('bf', 10))),
    ('Charlie Raza',   'charlie@example.com', '+92-301-3333333', crypt('Charlie@123', gen_salt('bf', 10))),
    ('Diana Sheikh',   'diana@example.com',   '+92-301-4444444', crypt('Diana@123',   gen_salt('bf', 10))),
    ('Ethan Mirza',    'ethan@example.com',   '+92-301-5555555', crypt('Ethan@123',   gen_salt('bf', 10)));

-- ---------------------------------------------------------------------
-- Accounts (8 total across 5 customers)
-- ---------------------------------------------------------------------
INSERT INTO account (user_id, branch_id, account_type, balance, status) VALUES
    (1, 1, 'savings',  50000.00, 'active'),   -- account_id 1, Alice
    (1, 1, 'current',  15000.00, 'active'),   -- account_id 2, Alice
    (2, 1, 'savings',  30000.00, 'active'),   -- account_id 3, Bob
    (3, 2, 'savings',  75000.00, 'active'),   -- account_id 4, Charlie
    (3, 2, 'current',   8000.00, 'active'),   -- account_id 5, Charlie
    (4, 2, 'savings',  20000.00, 'active'),   -- account_id 6, Diana
    (5, 3, 'savings',  12000.00, 'active'),   -- account_id 7, Ethan
    (5, 3, 'current',   5000.00, 'frozen');   -- account_id 8, Ethan (frozen)

-- ---------------------------------------------------------------------
-- Fraud rules (configurable thresholds)
-- ---------------------------------------------------------------------
INSERT INTO fraud_rules (rule_name, threshold_value, time_window_minutes, risk_level, is_active) VALUES
    ('HIGH_AMOUNT',       100000.00, NULL, 'high',   TRUE),  -- > 100k flagged as HIGH
    ('VELOCITY',               3.00,   10, 'medium', TRUE),  -- 3+ tx in 10 min
    ('NEW_DEVICE',             1.00, NULL, 'low',    TRUE),  -- untrusted login
    ('RAPID_TRANSFER',         3.00,   15, 'medium', TRUE);  -- 3+ distinct destinations in 15 min

-- ---------------------------------------------------------------------
-- Sample transactions (with manually computed hash chain for seed only)
-- The backend computes hashes for all NEW transactions; these are a
-- pre-populated chain so the dashboard isn't empty on first load.
-- ---------------------------------------------------------------------

-- TX 1: Admin deposits 10,000 into Alice's savings (account 1)
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type,
                          initiated_by_user_id, initiated_by_staff_id, status, timestamp)
VALUES (NULL, 1, 10000.00, 'deposit', NULL, 1, 'success', CURRENT_TIMESTAMP - INTERVAL '7 days');

-- TX 2: Admin deposits 5,000 into Bob's savings (account 3)
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type,
                          initiated_by_user_id, initiated_by_staff_id, status, timestamp)
VALUES (NULL, 3, 5000.00, 'deposit', NULL, 1, 'success', CURRENT_TIMESTAMP - INTERVAL '6 days');

-- TX 3: Alice transfers 2,000 to Bob
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type,
                          initiated_by_user_id, initiated_by_staff_id, status, timestamp)
VALUES (1, 3, 2000.00, 'transfer', 1, NULL, 'success', CURRENT_TIMESTAMP - INTERVAL '5 days');

-- TX 4: Teller deposits 25,000 into Charlie's savings
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type,
                          initiated_by_user_id, initiated_by_staff_id, status, timestamp)
VALUES (NULL, 4, 25000.00, 'deposit', NULL, 2, 'success', CURRENT_TIMESTAMP - INTERVAL '4 days');

-- TX 5: Charlie transfers 1,500 to Diana
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type,
                          initiated_by_user_id, initiated_by_staff_id, status, timestamp)
VALUES (4, 6, 1500.00, 'transfer', 3, NULL, 'success', CURRENT_TIMESTAMP - INTERVAL '3 days');

-- TX 6: HIGH AMOUNT transfer (will be flagged) — Bob -> Charlie 150,000
-- We seed it as "flagged" status to demonstrate the fraud workflow.
-- (This amount exceeds Bob's balance in real flow; here we just show the alert.)
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type,
                          initiated_by_user_id, initiated_by_staff_id, status, timestamp)
VALUES (3, 4, 150000.00, 'transfer', 2, NULL, 'flagged', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- TX 7: Withdrawal processed by teller for Diana, 500
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type,
                          initiated_by_user_id, initiated_by_staff_id, status, timestamp)
VALUES (6, NULL, 500.00, 'withdrawal', NULL, 2, 'success', CURRENT_TIMESTAMP - INTERVAL '1 day');

-- TX 8: Deposit into Ethan's savings 3,000
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type,
                          initiated_by_user_id, initiated_by_staff_id, status, timestamp)
VALUES (NULL, 7, 3000.00, 'deposit', NULL, 5, 'success', CURRENT_TIMESTAMP - INTERVAL '6 hours');

-- ---------------------------------------------------------------------
-- Hash chain for seed transactions
-- These hashes are CORRECTLY computed using the same formula the backend
-- uses (SHA-256 of: tx_id|amount|timestamp|from_acct|to_acct|prev_hash).
-- They will not match exact recomputation here because timestamp varies,
-- so we let the backend recompute and store on the seed-bootstrap step.
-- For now we insert placeholder hashes that follow the chain structure;
-- run "GET /api/admin/integrity/verify" or the rebuild script to refresh.
--
-- Implementation: we use pgcrypto's digest() to compute SHA-256 inline.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    rec        RECORD;
    prev_hash  TEXT := 'GENESIS';
    payload    TEXT;
    cur_hash   TEXT;
BEGIN
    FOR rec IN
        SELECT transaction_id, amount, timestamp, from_account_id, to_account_id
        FROM transactions
        WHERE status IN ('success', 'flagged')
        ORDER BY transaction_id
    LOOP
        -- Build the canonical payload exactly as the Node backend does:
        --   <id>|<amount-fixed-2-dp>|<YYYY-MM-DDTHH:MM:SS>|<from|null>|<to|null>|<prev_hash>
        payload := rec.transaction_id::text
                || '|' || to_char(rec.amount, 'FM999999999999990.00')
                || '|' || to_char(rec.timestamp, 'YYYY-MM-DD"T"HH24:MI:SS')
                || '|' || COALESCE(rec.from_account_id::text, 'null')
                || '|' || COALESCE(rec.to_account_id::text,   'null')
                || '|' || prev_hash;

        cur_hash := encode(digest(payload, 'sha256'), 'hex');

        INSERT INTO transaction_hash (transaction_id, previous_hash, current_hash)
        VALUES (rec.transaction_id, prev_hash, cur_hash);

        prev_hash := cur_hash;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Fraud alerts for the seeded transactions
-- ---------------------------------------------------------------------

-- Alert on TX 6 (the 150k transfer) — high amount, pending review
INSERT INTO fraud_alert (transaction_id, alert_type, risk_level, description, status, created_at)
VALUES (6, 'HIGH_AMOUNT', 'high',
        'Transaction amount 150000.00 exceeds threshold of 100000.00.',
        'pending', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- Alert on TX 4 — large deposit, low risk informational
INSERT INTO fraud_alert (transaction_id, alert_type, risk_level, description, status, created_at)
VALUES (4, 'LARGE_DEPOSIT', 'low',
        'Deposit of 25000.00 logged for review.',
        'resolved', CURRENT_TIMESTAMP - INTERVAL '4 days');

UPDATE fraud_alert SET reviewed_by = 3, reviewed_at = CURRENT_TIMESTAMP - INTERVAL '3 days',
                       review_notes = 'Verified with customer; legitimate.'
WHERE alert_id = 2;

-- ---------------------------------------------------------------------
-- Transaction log entries
-- ---------------------------------------------------------------------
INSERT INTO transaction_log (transaction_id, action, performed_by_user_id, performed_by_staff_id, description, timestamp) VALUES
    (1, 'created', NULL, 1, 'Admin deposited 10000.00 into account 1',           CURRENT_TIMESTAMP - INTERVAL '7 days'),
    (2, 'created', NULL, 1, 'Admin deposited 5000.00 into account 3',            CURRENT_TIMESTAMP - INTERVAL '6 days'),
    (3, 'created', 1,    NULL, 'Customer transfer of 2000.00 from acct 1 to 3',  CURRENT_TIMESTAMP - INTERVAL '5 days'),
    (4, 'created', NULL, 2, 'Teller deposited 25000.00 into account 4',          CURRENT_TIMESTAMP - INTERVAL '4 days'),
    (5, 'created', 3,    NULL, 'Customer transfer of 1500.00 from acct 4 to 6',  CURRENT_TIMESTAMP - INTERVAL '3 days'),
    (6, 'flagged', 2,    NULL, 'Transfer 150000.00 flagged as HIGH risk',        CURRENT_TIMESTAMP - INTERVAL '2 days'),
    (7, 'created', NULL, 2, 'Teller processed withdrawal of 500.00 from acct 6', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (8, 'created', NULL, 5, 'Teller deposited 3000.00 into account 7',           CURRENT_TIMESTAMP - INTERVAL '6 hours');

-- ---------------------------------------------------------------------
-- Device sessions
-- ---------------------------------------------------------------------
INSERT INTO device_session (user_id, ip_address, device_type, login_time, is_trusted) VALUES
    (1, '192.168.1.10', 'Chrome / Windows',  CURRENT_TIMESTAMP - INTERVAL '5 days', TRUE),
    (2, '192.168.1.20', 'Firefox / Linux',   CURRENT_TIMESTAMP - INTERVAL '3 days', TRUE),
    (3, '203.0.113.55', 'Mobile / Android',  CURRENT_TIMESTAMP - INTERVAL '1 day',  FALSE);

-- =====================================================================
-- End of seed
-- =====================================================================
