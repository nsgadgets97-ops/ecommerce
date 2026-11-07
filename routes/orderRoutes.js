const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// 🔒 Auth Middleware Import Karein
const { verifyAdmin } = require('../middlewares/authMiddleware');

// ✅ Public/Customer Endpoints (Yahan taala nahi lagega)
router.post('/create', orderController.createOrder);
router.get('/customer/check/:phone', orderController.checkCustomerExists);
router.post('/customer/verify-address', orderController.fetchSavedAddress);
router.post('/customer/login', orderController.customerLoginAndOrders);
router.post('/customer/forgot-password', orderController.forgotPassword);
router.get('/track/:phone', orderController.getCustomerOrders);

// 🌟 FIX: Customer screenshot confirm karta hai, isliye isse public mein rakha gaya hai
router.post('/confirm-screenshot', orderController.confirmScreenshot); 

// 🔒 Protected Admin Endpoints (Sirf Admin hi inhe chhed sakta hai)
router.get('/all', verifyAdmin, orderController.getAllOrders);
router.put('/:id/status', verifyAdmin, orderController.updateOrderStatus);
router.patch('/:id/status', verifyAdmin, orderController.updateOrderStatus);
router.delete('/delete/:id', verifyAdmin, orderController.deleteOrder);

module.exports = router;