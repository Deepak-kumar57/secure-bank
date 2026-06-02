// backend/src/routes/authRoutes.js

const router = require('express').Router();
const { customerRegister, customerLogin, staffLogin } = require('../controllers/authController');

router.post('/customer/register', customerRegister);
router.post('/customer/login',    customerLogin);
router.post('/staff/login',       staffLogin);

module.exports = router;
