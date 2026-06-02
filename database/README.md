# SecureBank — Database

PostgreSQL schema and seed for the SecureBank semester project.

## Setup

```bash
# 1. Create the database (Postgres must be running locally)
createdb securebank

# 2. Load schema (tables, indexes, constraints, triggers)
psql -d securebank -f schema.sql

# 3. Load seed data (branches, staff, customers, accounts, transactions)
psql -d securebank -f seed.sql
```

If you need to start over:

```bash
dropdb securebank && createdb securebank
psql -d securebank -f schema.sql
psql -d securebank -f seed.sql
```

## Notes

- **`pgcrypto` extension** is required for bcrypt-compatible password
  hashes in seed data and for SHA-256 inside the seed hash chain.
  The seed script enables it automatically.
- **Append-only triggers** prevent UPDATE/DELETE on `transaction_log`
  and `transaction_hash`, and prevent core-field changes on
  `transactions` after creation.
- **All passwords** in the seed are listed in the project README.

## Tables

| Table | Purpose |
|---|---|
| `users` | Customers (login + profile) |
| `branch` | Bank branches |
| `bank_staff` | Admin / teller / analyst / manager accounts |
| `account` | Customer bank accounts |
| `transactions` | The transaction ledger (immutable) |
| `transaction_hash` | SHA-256 hash chain over transactions |
| `fraud_alert` | Alerts raised by the rule engine |
| `device_session` | Login sessions and trust state |
| `transaction_log` | Append-only audit trail |
| `fraud_rules` | Configurable fraud thresholds |
