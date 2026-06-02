-- =====================================================================
-- SecureBank — Schema (PostgreSQL)
-- CS232: Database Management Systems
-- =====================================================================
-- Run with:  psql -d securebank -f database/schema.sql
-- =====================================================================

-- Drop in dependency order for clean re-runs
DROP TABLE IF EXISTS transaction_log    CASCADE;
DROP TABLE IF EXISTS fraud_alert        CASCADE;
DROP TABLE IF EXISTS transaction_hash   CASCADE;
DROP TABLE IF EXISTS transactions       CASCADE;
DROP TABLE IF EXISTS device_session     CASCADE;
DROP TABLE IF EXISTS account            CASCADE;
DROP TABLE IF EXISTS bank_staff         CASCADE;
DROP TABLE IF EXISTS branch             CASCADE;
DROP TABLE IF EXISTS users              CASCADE;
DROP TABLE IF EXISTS fraud_rules        CASCADE;

-- ---------------------------------------------------------------------
-- 1. users  (customers)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        SERIAL       PRIMARY KEY,
    full_name      VARCHAR(120) NOT NULL,
    email          VARCHAR(160) NOT NULL UNIQUE,
    phone          VARCHAR(20),
    password_hash  VARCHAR(255) NOT NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2. branch
-- ---------------------------------------------------------------------
CREATE TABLE branch (
    branch_id  SERIAL       PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    location   VARCHAR(200) NOT NULL
);

-- ---------------------------------------------------------------------
-- 3. bank_staff
-- ---------------------------------------------------------------------
CREATE TABLE bank_staff (
    staff_id       SERIAL       PRIMARY KEY,
    full_name      VARCHAR(120) NOT NULL,
    email          VARCHAR(160) NOT NULL UNIQUE,
    phone_number   VARCHAR(20),
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(20)  NOT NULL
        CHECK (role IN ('admin', 'teller', 'analyst', 'manager')),
    branch_id      INT          REFERENCES branch(branch_id) ON DELETE SET NULL,
    access_level   INT          NOT NULL DEFAULT 1
        CHECK (access_level BETWEEN 1 AND 3),
    status         VARCHAR(15)  NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    last_login     TIMESTAMP,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 4. account
-- ---------------------------------------------------------------------
CREATE TABLE account (
    account_id    SERIAL        PRIMARY KEY,
    user_id       INT           NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    branch_id     INT           NOT NULL REFERENCES branch(branch_id) ON DELETE RESTRICT,
    account_type  VARCHAR(15)   NOT NULL
        CHECK (account_type IN ('savings', 'current')),
    balance       NUMERIC(15,2) NOT NULL DEFAULT 0
        CHECK (balance >= 0),
    status        VARCHAR(15)   NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'frozen')),
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_account_user      ON account(user_id);
CREATE INDEX idx_account_branch    ON account(branch_id);
CREATE INDEX idx_account_status    ON account(status);

-- ---------------------------------------------------------------------
-- 5. transactions
-- ---------------------------------------------------------------------
-- We use the plural "transactions" because TRANSACTION is a reserved
-- word in SQL. Note: at least one initiator (user OR staff) must be set.
CREATE TABLE transactions (
    transaction_id          SERIAL        PRIMARY KEY,
    from_account_id         INT           REFERENCES account(account_id) ON DELETE RESTRICT,
    to_account_id           INT           REFERENCES account(account_id) ON DELETE RESTRICT,
    amount                  NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    transaction_type        VARCHAR(20)   NOT NULL
        CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'reversal')),
    initiated_by_user_id    INT           REFERENCES users(user_id) ON DELETE SET NULL,
    initiated_by_staff_id   INT           REFERENCES bank_staff(staff_id) ON DELETE SET NULL,
    timestamp               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                  VARCHAR(15)   NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'flagged', 'reversed')),

    -- At least one initiator must be specified
    CONSTRAINT chk_initiator CHECK (
        initiated_by_user_id IS NOT NULL OR initiated_by_staff_id IS NOT NULL
    ),
    -- A deposit must have a destination; a withdrawal must have a source;
    -- a transfer must have both.
    CONSTRAINT chk_account_pairing CHECK (
        (transaction_type = 'deposit'    AND to_account_id   IS NOT NULL) OR
        (transaction_type = 'withdrawal' AND from_account_id IS NOT NULL) OR
        (transaction_type = 'transfer'   AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL) OR
        (transaction_type = 'reversal')
    )
);

CREATE INDEX idx_tx_from        ON transactions(from_account_id);
CREATE INDEX idx_tx_to          ON transactions(to_account_id);
CREATE INDEX idx_tx_status      ON transactions(status);
CREATE INDEX idx_tx_timestamp   ON transactions(timestamp);
CREATE INDEX idx_tx_user        ON transactions(initiated_by_user_id);

-- ---------------------------------------------------------------------
-- 6. transaction_hash  (1-to-1 with transactions)
-- ---------------------------------------------------------------------
CREATE TABLE transaction_hash (
    hash_id         SERIAL       PRIMARY KEY,
    transaction_id  INT          NOT NULL UNIQUE
                                  REFERENCES transactions(transaction_id) ON DELETE RESTRICT,
    previous_hash   VARCHAR(80)  NOT NULL,           -- "GENESIS" or 64-char hex
    current_hash    VARCHAR(64)  NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hash_tx ON transaction_hash(transaction_id);

-- ---------------------------------------------------------------------
-- 7. fraud_alert
-- ---------------------------------------------------------------------
CREATE TABLE fraud_alert (
    alert_id        SERIAL       PRIMARY KEY,
    transaction_id  INT          NOT NULL REFERENCES transactions(transaction_id) ON DELETE RESTRICT,
    alert_type      VARCHAR(50)  NOT NULL,
    risk_level      VARCHAR(10)  NOT NULL
        CHECK (risk_level IN ('low', 'medium', 'high')),
    description     TEXT,
    status          VARCHAR(15)  NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'resolved', 'rejected')),
    reviewed_by     INT          REFERENCES bank_staff(staff_id) ON DELETE SET NULL,
    review_notes    TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at     TIMESTAMP
);

CREATE INDEX idx_alert_status     ON fraud_alert(status);
CREATE INDEX idx_alert_tx         ON fraud_alert(transaction_id);
CREATE INDEX idx_alert_risk       ON fraud_alert(risk_level);

-- ---------------------------------------------------------------------
-- 8. device_session
-- ---------------------------------------------------------------------
CREATE TABLE device_session (
    device_id    SERIAL       PRIMARY KEY,
    user_id      INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ip_address   VARCHAR(45),
    device_type  VARCHAR(80),
    login_time   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time  TIMESTAMP,
    is_trusted   BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_device_user ON device_session(user_id);

-- ---------------------------------------------------------------------
-- 9. transaction_log  (append-only audit trail)
-- ---------------------------------------------------------------------
CREATE TABLE transaction_log (
    log_id                  SERIAL       PRIMARY KEY,
    transaction_id          INT          REFERENCES transactions(transaction_id) ON DELETE RESTRICT,
    action                  VARCHAR(40)  NOT NULL,
    timestamp               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    performed_by_user_id    INT          REFERENCES users(user_id) ON DELETE SET NULL,
    performed_by_staff_id   INT          REFERENCES bank_staff(staff_id) ON DELETE SET NULL,
    description             TEXT
);

CREATE INDEX idx_log_tx        ON transaction_log(transaction_id);
CREATE INDEX idx_log_timestamp ON transaction_log(timestamp);

-- ---------------------------------------------------------------------
-- 10. fraud_rules
-- ---------------------------------------------------------------------
CREATE TABLE fraud_rules (
    rule_id              SERIAL        PRIMARY KEY,
    rule_name            VARCHAR(80)   NOT NULL UNIQUE,
    threshold_value      NUMERIC(15,2) NOT NULL,
    time_window_minutes  INT,
    risk_level           VARCHAR(10)   NOT NULL
        CHECK (risk_level IN ('low', 'medium', 'high')),
    is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- TRIGGERS — enforce immutability in the database itself
-- =====================================================================

-- 1. transaction_log is append-only: no UPDATE, no DELETE.
CREATE OR REPLACE FUNCTION trg_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'transaction_log is append-only; % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_log_no_update
BEFORE UPDATE ON transaction_log
FOR EACH ROW EXECUTE FUNCTION trg_log_append_only();

CREATE TRIGGER transaction_log_no_delete
BEFORE DELETE ON transaction_log
FOR EACH ROW EXECUTE FUNCTION trg_log_append_only();

-- 2. transaction_hash is immutable once written.
CREATE OR REPLACE FUNCTION trg_hash_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'transaction_hash is immutable; % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_hash_no_update
BEFORE UPDATE ON transaction_hash
FOR EACH ROW EXECUTE FUNCTION trg_hash_immutable();

CREATE TRIGGER transaction_hash_no_delete
BEFORE DELETE ON transaction_hash
FOR EACH ROW EXECUTE FUNCTION trg_hash_immutable();

-- 3. transactions: once a row reaches a terminal state (success/reversed/failed),
--    its core fields cannot change. Status may still progress (e.g. pending -> success,
--    success -> reversed) but identifying fields are frozen.
CREATE OR REPLACE FUNCTION trg_transactions_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Block any DELETE of a transaction.
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'transactions cannot be deleted (immutable ledger)';
    END IF;

    -- Core identifying fields are NEVER allowed to change.
    IF NEW.transaction_id      IS DISTINCT FROM OLD.transaction_id      OR
       NEW.from_account_id     IS DISTINCT FROM OLD.from_account_id     OR
       NEW.to_account_id       IS DISTINCT FROM OLD.to_account_id       OR
       NEW.amount              IS DISTINCT FROM OLD.amount               OR
       NEW.transaction_type    IS DISTINCT FROM OLD.transaction_type    OR
       NEW.timestamp           IS DISTINCT FROM OLD.timestamp           OR
       NEW.initiated_by_user_id  IS DISTINCT FROM OLD.initiated_by_user_id  OR
       NEW.initiated_by_staff_id IS DISTINCT FROM OLD.initiated_by_staff_id
    THEN
        RAISE EXCEPTION 'transaction core fields are immutable after creation';
    END IF;

    -- If a transaction is already in a terminal state, block status changes
    -- EXCEPT the success -> reversed path (which is a legitimate accounting event).
    IF OLD.status IN ('success', 'reversed', 'failed')
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status = 'success' AND NEW.status = 'reversed')
    THEN
        RAISE EXCEPTION 'transaction status % cannot transition to %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_no_delete
BEFORE DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION trg_transactions_immutable_fields();

CREATE TRIGGER transactions_immutable_fields
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION trg_transactions_immutable_fields();

-- =====================================================================
-- End of schema
-- =====================================================================
