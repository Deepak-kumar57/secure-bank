// backend/src/routes/fraudRoutes.js

const router = require('express').Router();
const { authenticateStaff } = require('../middleware/auth');
const c = require('../controllers/fraudController');

router.use(authenticateStaff);

router.get  ('/alerts',               c.listAlerts);
router.get  ('/alerts/pending',       c.listPendingAlerts);
router.patch('/alerts/:id/resolve',   c.resolveAlert);
router.patch('/alerts/:id/reject',    c.rejectAlert);

module.exports = router;
