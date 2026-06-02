// backend/src/routes/staffRoutes.js

const router = require('express').Router();
const { authenticateStaff } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roles');
const c = require('../controllers/staffController');

router.use(authenticateStaff);

router.get   ('/accounts',                            c.listAccounts);
router.post  ('/accounts',                            authorizeRoles('admin', 'teller'), c.createAccount);
router.post  ('/deposit',                             authorizeRoles('admin', 'teller'), c.deposit);
router.post  ('/withdraw',                            authorizeRoles('admin', 'teller'), c.withdraw);
router.get   ('/withdrawals/pending',                 c.listPendingWithdrawals);
router.post  ('/transfer',                            authorizeRoles('admin', 'teller'), c.staffTransfer);
router.patch ('/accounts/:id/freeze',                 authorizeRoles('admin', 'manager'), c.freezeAccount);
router.patch ('/accounts/:id/unfreeze',               authorizeRoles('admin', 'manager'), c.unfreezeAccount);
router.patch ('/accounts/:id/close',                  authorizeRoles('admin'),            c.closeAccount);
router.get   ('/applications',                        authorizeRoles('admin', 'teller'),  c.listApplications);
router.patch ('/applications/:id/approve',            authorizeRoles('admin', 'teller'),  c.approveApplication);
router.patch ('/applications/:id/reject',             authorizeRoles('admin', 'teller'),  c.rejectApplication);

module.exports = router;
