const express = require('express');
const router = express.Router();
const {
  loginCustomer,
  verifyAndResetPassword,
  triggerHardReset,
  checkLockAndSetPassword,
} = require('../controllers/customerAuthController');

router.post('/login', loginCustomer);
router.post('/verify-reset', verifyAndResetPassword);
router.post('/trigger-hard-reset', triggerHardReset);
router.post('/complete-unlock', checkLockAndSetPassword);

module.exports = router;