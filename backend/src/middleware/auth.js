// backend/src/middleware/auth.js
// JWT-based authentication middleware.
// Customer tokens contain  { type: 'customer', user_id, email }
// Staff    tokens contain  { type: 'staff',    staff_id, email, role }

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_only_replace_me';

function signCustomerToken(user) {
    return jwt.sign(
        { type: 'customer', user_id: user.user_id, email: user.email },
        SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );
}

function signStaffToken(staff) {
    return jwt.sign(
        {
            type: 'staff',
            staff_id: staff.staff_id,
            email: staff.email,
            role: staff.role,
            branch_id: staff.branch_id,
        },
        SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );
}

function extractToken(req) {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    return h.slice(7);
}

function authenticateCustomer(req, res, next) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
        const decoded = jwt.verify(token, SECRET);
        if (decoded.type !== 'customer') {
            return res.status(403).json({ error: 'Customer token required' });
        }
        req.auth = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function authenticateStaff(req, res, next) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
        const decoded = jwt.verify(token, SECRET);
        if (decoded.type !== 'staff') {
            return res.status(403).json({ error: 'Staff token required' });
        }
        req.auth = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = {
    signCustomerToken,
    signStaffToken,
    authenticateCustomer,
    authenticateStaff,
};
