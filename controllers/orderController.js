// controllers/orderController.js
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const bcrypt = require('bcryptjs');
const sanitizeHtml = require('sanitize-html'); // 🔒 XSS Protection

// 🔒 Safe Sanitize Function (Sirf text, no HTML)
const cleanText = (text) => {
  if (!text) return text;
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
};

// Auto-cleanup helper (Fire & Forget)
async function cleanupOldOrders(phone) {
  try {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const allOrders = await Order.find({ customerPhone: phone }).sort({ createdAt: -1 });

    if (allOrders.length > 5) {
      for (let i = 5; i < allOrders.length; i++) {
        if (allOrders[i].createdAt < twoMonthsAgo) {
          await Order.findByIdAndDelete(allOrders[i]._id);
        }
      }
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

// 1. Create Order
exports.createOrder = async (req, res) => {
  try {
    const {
      orderId, customerPhone, shippingDetails, products,
      paymentType, amountToPayOnline, remainingBalance, password
    } = req.body;

    if (!customerPhone || !shippingDetails || !products || !products.length) {
      return res.status(400).json({ success: false, message: 'All delivery details and products are required.' });
    }

    const cleanPhone = cleanText(customerPhone.trim());
    let existingCustomer = await Customer.findOne({ phone: cleanPhone });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentOrdersCount = await Order.countDocuments({
      customerPhone: cleanPhone,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (recentOrdersCount >= 3) {
      return res.status(429).json({ success: false, message: 'Too many orders recently. Please wait 5 minutes.' });
    }

    // 🔒 Sanitize Shipping Details
    const safeShippingDetails = {
      name: cleanText(shippingDetails.name),
      phone: cleanText(shippingDetails.phone) || cleanPhone,
      address: cleanText(shippingDetails.address),
      city: cleanText(shippingDetails.city) || 'N/A',
      state: cleanText(shippingDetails.state) || 'N/A',
      pincode: cleanText(shippingDetails.pincode)
    };

    const existingPendingOrder = await Order.findOne({
      customerPhone: cleanPhone,
      orderStatus: 'Screenshot Pending'
    });

    if (existingPendingOrder) {
      existingPendingOrder.products = products.map(item => ({
        productId: cleanText(item.productId), // Sanitize Product ID
        title: cleanText(item.title),         // Sanitize Product Title
        price: Number(item.price),
        quantity: Number(item.quantity || 1)
      }));
      existingPendingOrder.shippingDetails = safeShippingDetails;
      existingPendingOrder.amountToPayOnline = Number(amountToPayOnline !== undefined ? amountToPayOnline : 300);
      existingPendingOrder.paymentType = cleanText(paymentType) || 'FULL_PAID'; // Sanitize Payment Type
      existingPendingOrder.remainingBalance = Number(remainingBalance !== undefined ? remainingBalance : 0);

      await existingPendingOrder.save();

      return res.status(200).json({
        success: true,
        message: 'Order silently updated',
        orderId: cleanText(existingPendingOrder.orderId) // Sanitize Order ID
      });
    }

    const newOrder = new Order({
      orderId: cleanText(orderId) || ('ORD-' + Date.now()), // Sanitize Order ID
      customerPhone: cleanPhone,
      shippingDetails: safeShippingDetails,
      products: products.map(item => ({
        productId: cleanText(item.productId), // Sanitize Product ID
        title: cleanText(item.title),         // Sanitize Product Title
        price: Number(item.price),
        quantity: Number(item.quantity || 1)
      })),
      paymentType: cleanText(paymentType) || 'FULL_PAID', // Sanitize Payment Type
      amountToPayOnline: Number(amountToPayOnline !== undefined ? amountToPayOnline : 300),
      remainingBalance: Number(remainingBalance !== undefined ? remainingBalance : 0),
      orderStatus: 'Screenshot Pending'
    });

    await newOrder.save();

    if (typeof cleanupOldOrders === 'function') cleanupOldOrders(cleanPhone);

    if (!existingCustomer) {
      const fallbackPassword = password ? cleanText(password) : (safeShippingDetails.name.split(' ')[0] || '123456'); // Sanitize Password
      const hashedPassword = await bcrypt.hash(fallbackPassword, 10);

      await Customer.create({
        phone: cleanPhone,
        name: safeShippingDetails.name,
        password: hashedPassword,
        defaultAddress: {
          address: safeShippingDetails.address,
          city: safeShippingDetails.city,
          state: safeShippingDetails.state,
          pincode: safeShippingDetails.pincode
        }
      });
    } else {
      existingCustomer.name = safeShippingDetails.name;
      existingCustomer.defaultAddress = {
        address: safeShippingDetails.address,
        city: safeShippingDetails.city,
        state: safeShippingDetails.state,
        pincode: safeShippingDetails.pincode
      };
      if (password && password !== '********' && password.trim() !== '') {
        existingCustomer.password = await bcrypt.hash(cleanText(password.trim()), 10); // Sanitize Password
      }
      await existingCustomer.save();
    }

    return res.status(201).json({ success: true, message: 'Order placed successfully!', orderId: newOrder.orderId });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Check Exists
exports.checkCustomerExists = async (req, res) => {
  try {
    const customer = await Customer.findOne({ phone: cleanText(req.params.phone.trim()) }); // Sanitize Phone
    res.status(200).json({ success: true, exists: Boolean(customer), name: customer ? customer.name : '' });
  } catch (err) { res.status(500).json({ success: false }); }
};

// 3. Verify Address for Autofill
exports.fetchSavedAddress = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const cleanPhone = cleanText(phone.trim()); // Sanitize Phone
    const customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) return res.status(404).json({ success: false, message: 'Account not found.' });

    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      return res.status(403).json({ success: false, message: 'Account locked.' });
    }

    const isMatch = await bcrypt.compare(cleanText(password), customer.password); // Sanitize Password
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect password.' });

    res.status(200).json({ success: true, data: { name: customer.name, address: customer.defaultAddress } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 4. Customer Login
exports.customerLoginAndOrders = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const cleanPhone = cleanText(phone.trim()); // Sanitize Phone
    const customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) return res.status(404).json({ success: false, message: 'Account not found.' });

    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      return res.status(403).json({ success: false, message: 'Account locked.' });
    }

    const isMatch = await bcrypt.compare(cleanText(password), customer.password); // Sanitize Password
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect password.' });

    if (customer.failedAttempts > 0) {
      customer.failedAttempts = 0;
      await customer.save();
    }
    const orders = await Order.find({ customerPhone: cleanPhone }).sort({ createdAt: -1 }).limit(10);
    res.status(200).json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 5. Forgot Password Logic
exports.forgotPassword = async (req, res) => {
  try {
    const { phone, pincode, newPassword } = req.body;
    const cleanPhone = cleanText(phone.trim()); // Sanitize Phone
    const cleanPincode = cleanText(pincode.trim()); // Sanitize Pincode
    const customer = await Customer.findOne({ phone: cleanPhone });

    if (!customer) return res.status(404).json({ success: false, message: 'Account not found.' });

    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      return res.status(403).json({ success: false, message: 'Account locked.' });
    }

    if (customer.defaultAddress.pincode === cleanPincode) {
      customer.password = await bcrypt.hash(cleanText(newPassword), 10); // Sanitize Password
      customer.failedAttempts = 0;
      customer.lockUntil = null;
      await customer.save();
      return res.status(200).json({ success: true, message: 'Password reset successfully!' });
    } else {
      customer.failedAttempts = (customer.failedAttempts || 0) + 1;
      if (customer.failedAttempts >= 3) {
        customer.lockUntil = new Date(Date.now() + 4 * 60 * 60 * 1000);
        customer.failedAttempts = 0;
        await customer.save();
        return res.status(403).json({ success: false, message: 'Account locked for 4 hours.' });
      } else {
        await customer.save();
        return res.status(400).json({ success: false, message: 'Incorrect details.' });
      }
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 6. Get Customer Orders
exports.getCustomerOrders = async (req, res) => {
  try {
    const cleanPhone = cleanText(req.params.phone.trim()); // Sanitize Phone
    const orders = await Order.find({ customerPhone: cleanPhone }).sort({ createdAt: -1 }).limit(10);
    res.status(200).json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Routes
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  } catch (error) { res.status(500).json({ success: false }); }
};

// Admin Routes - Status & Payment Update COMBINED
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, trackingId, courierName, paymentType, amountToPayOnline } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Status Updates
    if (orderStatus) order.orderStatus = cleanText(orderStatus); // Sanitize Order Status
    if (trackingId !== undefined) order.trackingId = cleanText(trackingId); // Sanitize Tracking ID
    if (courierName !== undefined) order.courierName = cleanText(courierName); // Sanitize Courier Name

    // Payment Updates
    if (paymentType) order.paymentType = cleanText(paymentType); // Sanitize Payment Type
    if (amountToPayOnline !== undefined) order.amountToPayOnline = Number(amountToPayOnline);

    // Dynamic Balance Calculation
    if (paymentType || amountToPayOnline !== undefined) {
      if (order.paymentType === 'FULL_PAID') {
        order.remainingBalance = 0;
      } else {
        let totalOrderValue = 0;
        if (order.products && order.products.length > 0) {
          order.products.forEach(p => {
            totalOrderValue += (p.price * p.quantity);
          });
        }
        order.remainingBalance = totalOrderValue - (order.amountToPayOnline || 0);
        if (order.remainingBalance < 0) order.remainingBalance = 0;
      }
    }

    const updatedOrder = await order.save();
    res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Order
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOrder = await Order.findByIdAndDelete(id);
    if (!deletedOrder) return res.status(404).json({ success: false, message: 'Order not found' });
    res.status(200).json({ success: true, message: 'Order successfully deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Confirm Screenshot & Instant Cleanup
exports.confirmScreenshot = async (req, res) => {
  try {
    const { orderId, customerPhone } = req.body; 
    const cleanOrderId = cleanText(orderId); // Sanitize Order ID
    const cleanCustomerPhone = cleanText(customerPhone); // Sanitize Customer Phone

    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: cleanOrderId }, 
      { orderStatus: 'Pending',
        createdAt: new Date()
       }, 
      { returnDocument: 'after' }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await Order.deleteMany({
      customerPhone: cleanCustomerPhone.trim(),
      orderStatus: 'Screenshot Pending',
      orderId: { $ne: cleanOrderId } 
    });

    res.status(200).json({
      success: true,
      message: "Order confirmed and duplicates cleaned up instantly"
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};