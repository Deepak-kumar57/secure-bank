// backend/src/middleware/roles.js
// Role-based authorization. Use AFTER authenticateStaff.

function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.auth || req.auth.type !== 'staff') {
            return res.status(403).json({ error: 'Staff authentication required' });
        }
        if (!allowedRoles.includes(req.auth.role)) {
            return res.status(403).json({
                error: `Forbidden: requires one of [${allowedRoles.join(', ')}]`,
            });
        }
        next();
    };
}

module.exports = { authorizeRoles };
