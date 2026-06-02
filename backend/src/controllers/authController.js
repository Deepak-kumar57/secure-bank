// backend/src/controllers/authController.js

const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');
const { signCustomerToken, signStaffToken } = require('../middleware/auth');
const { isUntrustedDevice } = require('../utils/fraudEngine');

// ---------- Customer registration ----------
async function customerRegister(req, res) {
    try {
        const { full_name, email, phone, password } = req.body || {};
        if (!full_name || !email || !password) {
            return res.status(400).json({ error: 'full_name, email, password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Email uniqueness
        const exists = await query(`SELECT 1 FROM users WHERE email = $1`, [email]);
        if (exists.rowCount > 0) {
            return res.status(409).json({ error: 'Email is already registered' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const result = await query(
            `INSERT INTO users (full_name, email, phone, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING user_id, full_name, email, phone, created_at`,
            [full_name, email, phone || null, password_hash]
        );

        const user = result.rows[0];
        const token = signCustomerToken(user);
        return res.status(201).json({ token, user });
    } catch (err) {
        console.error('customerRegister:', err);
        return res.status(500).json({ error: 'Registration failed' });
    }
}

// ---------- Customer login ----------
async function customerLogin(req, res) {
    const client = await pool.connect();
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const r = await client.query(
            `SELECT user_id, full_name, email, phone, password_hash
               FROM users WHERE email = $1`,
            [email]
        );
        const user = r.rows[0];
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        // Track device session + raise NEW_DEVICE alert if untrusted.
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
        const device = (req.headers['user-agent'] || 'unknown').toString().slice(0, 80);

        const untrusted = await isUntrustedDevice(client, user.user_id, ip, device);
        await client.query(
            `INSERT INTO device_session (user_id, ip_address, device_type, is_trusted)
             VALUES ($1, $2, $3, $4)`,
            [user.user_id, ip || null, device, !untrusted]
        );

        const safeUser = {
            user_id:   user.user_id,
            full_name: user.full_name,
            email:     user.email,
            phone:     user.phone,
        };
        const token = signCustomerToken(safeUser);
        return res.json({
            token,
            user: safeUser,
            warning: untrusted ? 'Login from a new or untrusted device.' : null,
        });
    } catch (err) {
        console.error('customerLogin:', err);
        return res.status(500).json({ error: 'Login failed' });
    } finally {
        client.release();
    }
}

// ---------- Staff login ----------
async function staffLogin(req, res) {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const r = await query(
            `SELECT staff_id, full_name, email, phone_number, password_hash,
                    role, branch_id, access_level, status
               FROM bank_staff WHERE email = $1`,
            [email]
        );
        const staff = r.rows[0];
        if (!staff) return res.status(401).json({ error: 'Invalid credentials' });
        if (staff.status !== 'active') return res.status(403).json({ error: 'Staff account is inactive' });

        const ok = await bcrypt.compare(password, staff.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        await query(`UPDATE bank_staff SET last_login = NOW() WHERE staff_id = $1`, [staff.staff_id]);

        const safe = {
            staff_id:   staff.staff_id,
            full_name:  staff.full_name,
            email:      staff.email,
            role:       staff.role,
            branch_id:  staff.branch_id,
            access_level: staff.access_level,
        };
        const token = signStaffToken(safe);
        return res.json({ token, staff: safe });
    } catch (err) {
        console.error('staffLogin:', err);
        return res.status(500).json({ error: 'Login failed' });
    }
}

module.exports = { customerRegister, customerLogin, staffLogin };
