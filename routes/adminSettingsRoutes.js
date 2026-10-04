// routes/adminSettingsRoutes.js
const express = require('express');
const router = express.Router();
const adminSettingsController = require('../controllers/adminSettingsController');

// Apna auth middleware import karein. (Agar naam alag ho toh theek kar lein)
const { verifyAdmin } = require('../middlewares/authMiddleware'); 

// Sabhi routes ko verifyAdmin se protect kiya gaya hai
router.put('/change-password', verifyAdmin, adminSettingsController.changePassword);
router.post('/create-user', verifyAdmin, adminSettingsController.createAdmin);
router.get('/customers', verifyAdmin, adminSettingsController.getAllCustomers);

module.exports = router;