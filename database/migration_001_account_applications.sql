-- Migration: Add account_application table
-- Run with:  psql -d securebank -f database/migration_001_account_applications.sql

CREATE TABLE IF NOT EXISTS account_application (
    application_id      SERIAL       PRIMARY KEY,
    user_id             INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    account_type        VARCHAR(15)  NOT NULL
        CHECK (account_type IN ('savings', 'current')),
    preferred_branch_id INT          REFERENCES branch(branch_id) ON DELETE SET NULL,
    status              VARCHAR(15)  NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by         INT          REFERENCES bank_staff(staff_id) ON DELETE SET NULL,
    review_notes        TEXT,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_application_user   ON account_application(user_id);
CREATE INDEX IF NOT EXISTS idx_application_status ON account_application(status);
