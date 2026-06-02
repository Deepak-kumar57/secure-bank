# SecureBank — Fraud-Aware Banking Management System

CS232 Database Management Systems — Semester Project

A full-stack banking system with **SHA-256 hash-chain transaction integrity**
and a **rule-based fraud detection engine**, built on PostgreSQL with a
Node.js/Express backend and a React + Vite frontend.

---

## Project structure

```
securebank/
├── database/          PostgreSQL schema, seed data, README
├── backend/           Node.js + Express REST API
│   └── src/
│       ├── config/    DB connection
│       ├── middleware/  JWT auth + role authorization
│       ├── utils/     Hash chain + fraud engine
│       ├── controllers/ Request handlers
│       └── routes/    Express routers
└── frontend/          React + Vite SPA
    └── src/
        ├── api/       Axios client with JWT interceptor
        ├── context/   AuthContext (login/logout state)
        ├── components/  Navbar, ProtectedRoute, StatCard, format
        ├── pages/     19 pages (customer, staff, admin, fraud)
        └── styles/    Hand-written CSS
```

---

## Prerequisites

- **PostgreSQL 13+** (must include the `pgcrypto` extension — this is in the
  default `contrib` package, so a stock install is fine).
- **Node.js 18+** (for both backend and frontend).
- **npm** (ships with Node.js).

---

## Setup — step by step

### 1. Database

```bash
# from the project root
createdb -U postgres securebank
psql -U postgres -d securebank -f database/schema.sql
psql -U postgres -d securebank -f database/seed.sql
```

If you need to start over, drop and recreate:

```bash
dropdb -U postgres securebank && createdb -U postgres securebank
psql -U postgres -d securebank -f database/schema.sql
psql -U postgres -d securebank -f database/seed.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env if your Postgres user/password/host differs
npm run dev
```

The API listens on **http://localhost:5000**. Health check: `GET /api/health`.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The SPA opens at **http://localhost:5173**. The Vite dev server proxies
`/api/*` to the backend at `localhost:5000`, so no CORS configuration is
needed during development.

---

## Demo login credentials

All passwords are seeded by `database/seed.sql`. Sign in at:

- Customer login: `http://localhost:5173/login`
- Staff login: `http://localhost:5173/staff/login`

### Staff

| Role        | Email                          | Password      |
|-------------|--------------------------------|---------------|
| Admin       | `admin@securebank.local`       | `Admin@123`   |
| Teller      | `teller@securebank.local`      | `Teller@123`  |
| Teller (br2)| `teller2@securebank.local`     | `Teller@123`  |
| Fraud Analyst | `analyst@securebank.local`   | `Analyst@123` |
| Manager     | `manager@securebank.local`     | `Manager@123` |

### Customers

| Customer       | Email                  | Password      |
|----------------|------------------------|---------------|
| Alice Hassan   | `alice@example.com`    | `Alice@123`   |
| Bob Siddiqui   | `bob@example.com`      | `Bob@123`     |
| Charlie Raza   | `charlie@example.com`  | `Charlie@123` |
| Diana Sheikh   | `diana@example.com`    | `Diana@123`   |
| Ethan Mirza    | `ethan@example.com`    | `Ethan@123`   |

---

## How the system works

### Banking flow

| Action                    | Customer | Teller | Manager | Analyst | Admin |
|---------------------------|:--------:|:------:|:-------:|:-------:|:-----:|
| Register / login          |    ✓     |   ✓*   |   ✓*    |   ✓*    |  ✓*   |
| View own accounts/tx      |    ✓     |        |         |         |       |
| Transfer (own funds)      |    ✓     |        |         |         |       |
| Request withdrawal        |    ✓     |        |         |         |       |
| Approve withdrawal        |          |   ✓    |         |         |   ✓   |
| Deposit                   |          |   ✓    |         |         |   ✓   |
| Create account            |          |   ✓    |         |         |   ✓   |
| Freeze / unfreeze account |          |        |   ✓     |         |   ✓   |
| Close account             |          |        |         |         |   ✓   |
| Review fraud alerts       |          |        |   ✓     |   ✓     |   ✓   |
| Run integrity verify      |          |        |         |         |   ✓   |
| Edit fraud rules          |          |        |         |         |   ✓   |

`*` Staff log in via the staff portal, not the customer portal.

### Withdrawal (two-step)

1. Customer submits a request from their **Accounts** page → transaction
   row inserted with `status = 'pending'`. **No money moves yet.**
2. Teller or admin opens the **Withdrawals** page, reviews the request,
   clicks Approve → balance is deducted, status flips to `success`,
   a hash row is appended, and an audit log entry is created.

If the fraud engine raises a HIGH-risk alert during approval, the
transaction is marked `flagged` instead, and no funds move.

### Hash chain (SHA-256)

Every successful or flagged transaction generates one row in
`transaction_hash`:

```
current_hash = SHA-256( tx_id | amount | timestamp | from_acct | to_acct | previous_hash )
```

The first hash links to the literal string `"GENESIS"`. All subsequent
rows link to the previous row's `current_hash`. Modifying any historical
field changes the recomputed hash and breaks every downstream link —
this is detected in O(n) by `GET /api/admin/integrity/verify`.

### Fraud rules

Configurable in the `fraud_rules` table; admin can edit thresholds
through `PATCH /api/admin/fraud-rules/:id`.

| Rule              | Default threshold | Risk    | Effect                                          |
|-------------------|-------------------|---------|-------------------------------------------------|
| `HIGH_AMOUNT`     | 100,000           | high    | HIGH on transfers/withdrawals → transaction is **flagged**, money does NOT move; on deposits, alert only. |
| `VELOCITY`        | 3 tx / 10 min     | medium  | Alert raised, transaction proceeds.             |
| `RAPID_TRANSFER`  | 3 distinct dest / 15 min | medium | Alert raised, transaction proceeds.       |
| `NEW_DEVICE`      | new IP+UA combo   | low     | Login session marked `is_trusted = false`.      |

### Append-only protections

- **DB triggers** reject `UPDATE` and `DELETE` on `transaction_hash` and
  `transaction_log`.
- **DB trigger** rejects `DELETE` on `transactions` and any modification
  to a transaction's identifying fields once it exists.
- **Backend** never issues `DELETE` against any of these tables.

---

## Verifying the integrity check (live demo)

Once everything is running, sign in as **admin** and visit
**Admin → Integrity** in the navbar. Click **Run integrity check**.

You should see:

```
✅ Chain is valid
Checked transactions: 6
Broken at: — none —
Message: All 6 transactions verified successfully.
```

To demo tamper detection, open `psql` and try to alter a historical
transaction. The trigger will block direct edits:

```sql
-- This is REJECTED by the trigger
UPDATE transactions SET amount = 1.00 WHERE transaction_id = 1;
-- ERROR:  transaction core fields are immutable after creation
```

To force a real chain break for demo purposes, you can bypass the
trigger by altering the hash row directly (which is itself blocked too):

```sql
UPDATE transaction_hash SET current_hash = 'tampered' WHERE hash_id = 1;
-- ERROR:  transaction_hash is immutable; UPDATE is not permitted
```

So the only way to corrupt the chain is to disable triggers as a
superuser — which is exactly the kind of attack the integrity check
is designed to surface against backups and replicas.

---

## API surface (summary)

```
Auth
  POST /api/auth/customer/register
  POST /api/auth/customer/login
  POST /api/auth/staff/login

Customer (requires customer JWT)
  GET  /api/customer/me
  GET  /api/customer/accounts
  GET  /api/customer/transactions
  POST /api/customer/transfer
  POST /api/customer/withdrawal-request

Staff (requires staff JWT; some routes role-restricted)
  GET   /api/staff/accounts
  POST  /api/staff/accounts                     [admin, teller]
  POST  /api/staff/deposit                      [admin, teller]
  POST  /api/staff/withdraw                     [admin, teller]
  GET   /api/staff/withdrawals/pending
  POST  /api/staff/transfer                     [admin, teller]
  PATCH /api/staff/accounts/:id/freeze          [admin, manager]
  PATCH /api/staff/accounts/:id/unfreeze        [admin, manager]
  PATCH /api/staff/accounts/:id/close           [admin]

Fraud (requires staff JWT; analyst/manager/admin)
  GET   /api/fraud/alerts
  GET   /api/fraud/alerts/pending
  PATCH /api/fraud/alerts/:id/resolve
  PATCH /api/fraud/alerts/:id/reject

Admin
  POST  /api/admin/staff                        [admin]
  POST  /api/admin/branches                     [admin]
  GET   /api/admin/branches
  GET   /api/admin/users                        [admin, manager]
  GET   /api/admin/dashboard                    [admin, manager]
  GET   /api/admin/logs                         [admin, manager, analyst]
  GET   /api/admin/integrity/verify             [admin]
  GET   /api/admin/reports/summary              [admin, manager]
  GET   /api/admin/fraud-rules                  [admin, manager, analyst]
  PATCH /api/admin/fraud-rules/:id              [admin]
```

---

## Tech stack

| Layer    | Technology                                |
|----------|-------------------------------------------|
| Database | PostgreSQL (with `pgcrypto`)              |
| Backend  | Node.js 18+, Express 4                    |
| Auth     | JWT (jsonwebtoken), bcryptjs              |
| Hashing  | SHA-256 via Node `crypto`                 |
| Frontend | React 18, Vite 5, React Router 6, Axios   |
| Styling  | Hand-written CSS, no UI libraries         |

---

## Team

| Name                  | Reg. No.  |
|-----------------------|-----------|
| Asaad Arfan Miana     | 2024115   |
| Deepak Kumar          | 2024149   |
| Muhammad Asfar Javed  | 2024356   |
| Muhammad Yousaf Rehman| 2024490   |

Instructor: Ahsan Shah · CS232 Database Management Systems
