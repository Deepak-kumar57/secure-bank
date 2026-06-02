// backend/src/routes/adminRoutes.js

const router = require('express').Router();
const { authenticateStaff } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
const c = require('../controllers/adminController');

router.use(authenticateStaff);

// Admin-only writes:
router.post  ('/staff',              authorizeRoles('admin'), c.createStaff);
router.post  ('/branches',           authorizeRoles('admin'), c.createBranch);
router.patch ('/fraud-rules/:id',    authorizeRoles('admin'), c.updateFraudRule);

// Read endpoints — accessible by admin/manager (and integrity by admin only).
router.get   ('/branches',           c.listBranches);
router.get   ('/users',              authorizeRoles('admin', 'manager'),                  c.listUsers);
router.get   ('/dashboard',          authorizeRoles('admin', 'manager'),                  c.dashboard);
router.get   ('/logs',               authorizeRoles('admin', 'manager', 'analyst'),       c.listLogs);
router.get   ('/integrity/verify',   authorizeRoles('admin'),                             c.integrityVerify);
router.get   ('/reports/summary',    authorizeRoles('admin', 'manager'),                  c.reportsSummary);
router.get   ('/fraud-rules',        authorizeRoles('admin', 'manager', 'analyst'),       c.listFraudRules);

module.exports = router;
