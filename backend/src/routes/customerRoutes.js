// backend/src/routes/customerRoutes.js

const router = require('express').Router();
const { authenticateCustomer } = require('../middleware/auth');
const c = require('../controllers/customerController');

router.use(authenticateCustomer);

router.get ('/me',                  c.getMe);
router.get ('/accounts',            c.getMyAccounts);
router.get ('/transactions',        c.getMyTransactions);
router.post('/transfer',            c.customerTransfer);
router.post('/withdrawal-request',  c.customerWithdrawalRequest);
router.get ('/applications',        c.getMyApplications);
router.post('/apply-account',       c.applyForAccount);

module.exports = router;
