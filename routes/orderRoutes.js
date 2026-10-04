const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// --- Customer Endpoints ---
router.post('/create', orderController.createOrder);
router.get('/customer/check/:phone', orderController.checkCustomerExists);
router.post('/customer/verify-address', orderController.fetchSavedAddress);
router.post('/customer/login', orderController.customerLoginAndOrders);
router.post('/customer/forgot-password', orderController.forgotPassword);
router.get('/track/:phone', orderController.getCustomerOrders);

// --- Admin Endpoints ---
router.get('/all', orderController.getAllOrders);
// PUT aur PATCH dono allow karein taaki 404 error na aaye
router.put('/:id/status', orderController.updateOrderStatus);
router.patch('/:id/status', orderController.updateOrderStatus);

module.exports = router;