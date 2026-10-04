// controllers/orderController.js
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const bcrypt = require('bcryptjs');

// Auto-cleanup helper (Fire & Forget)
async function cleanupOldOrders(phone) {
  try {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const allOrders = await Order.find({ customerPhone: phone }).sort({ createdAt: -1 });
    
    // Keep minimum 5 orders. Delete anything beyond 5th IF it's older than 60 days.
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
      orderId,
      customerPhone,
      shippingDetails,
      products,
      paymentType,
      amountToPayOnline,
      remainingBalance,
      password
    } = req.body;

    if (!customerPhone || !shippingDetails || !products || !products.length) {
      return res.status(400).json({ success: false, message: 'All delivery details and products are required.' });
    }

    const cleanPhone = customerPhone.trim();

    // Check customer existence upfront taaki new vs existing ka validation handle ho sake
    let existingCustomer = await Customer.findOne({ phone: cleanPhone });

    

    // Rate Limiting: 5 minutes mein max 3 orders
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentOrdersCount = await Order.countDocuments({
      customerPhone: cleanPhone,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (recentOrdersCount >= 3) {
      return res.status(429).json({ success: false, message: 'Too many orders recently. Please wait 5 minutes.' });
    }

    // New Order create karein aapke schema fields ke anusar
    const newOrder = new Order({
      orderId: orderId || ('ORD-' + Date.now()),
      customerPhone: cleanPhone,
      shippingDetails: {
        name: shippingDetails.name,
        phone: shippingDetails.phone || cleanPhone,
        address: shippingDetails.address,
        city: shippingDetails.city || 'N/A',
        state: shippingDetails.state || 'N/A',
        pincode: shippingDetails.pincode
      },
      products: products.map(item => ({
        productId: item.productId,
        title: item.title,
        price: Number(item.price),
        quantity: Number(item.quantity || 1)
      })),
      paymentType: paymentType || 'FULL_PAID',
      amountToPayOnline: Number(amountToPayOnline !== undefined ? amountToPayOnline : 300),
      remainingBalance: Number(remainingBalance !== undefined ? remainingBalance : 0),
      orderStatus: 'Pending'
    });

    await newOrder.save();

    // Cleanup background job
    if (typeof cleanupOldOrders === 'function') {
      cleanupOldOrders(cleanPhone);
    }

    // Customer record create ya update karein
    if (!existingCustomer) {
      const fallbackPassword = password || shippingDetails.name.split(' ')[0] || '123456';
      const hashedPassword = await bcrypt.hash(fallbackPassword, 10);

      await Customer.create({
        phone: cleanPhone,
        name: shippingDetails.name,
        password: hashedPassword,
        defaultAddress: {
          address: shippingDetails.address,
          city: shippingDetails.city,
          state: shippingDetails.state,
          pincode: shippingDetails.pincode
        }
      });
    } else {
      // Existing customer: Address update karein
      existingCustomer.name = shippingDetails.name;
      existingCustomer.defaultAddress = {
        address: shippingDetails.address,
        city: shippingDetails.city,
        state: shippingDetails.state,
        pincode: shippingDetails.pincode
      };

      // Password sirf tabhi update karein jab valid new password diya ho (dummy '********' ya blank na ho)
      if (password && password !== '********' && password.trim() !== '') {
        existingCustomer.password = await bcrypt.hash(password.trim(), 10);
      }

      

      await existingCustomer.save();
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      orderId: newOrder.orderId
    });

  } catch (error) {
    console.error("Order creation error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Check Exists
exports.checkCustomerExists = async (req, res) => {
  try {
    const customer = await Customer.findOne({ phone: req.params.phone.trim() });
    res.status(200).json({ success: true, exists: Boolean(customer), name: customer ? customer.name : '' });
  } catch (err) { res.status(500).json({ success: false }); }
};

// 3. Verify Address for Autofill (Blocks if locked)
exports.fetchSavedAddress = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) return res.status(404).json({ success: false, message: 'Account not found.' });

    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      return res.status(403).json({ success: false, message: 'Your account is locked for 4 hours due to multiple failed reset attempts. New orders can still be placed.' });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect password.' });

    res.status(200).json({ success: true, data: { name: customer.name, address: customer.defaultAddress } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 4. Customer Login (Blocks if locked)
exports.customerLoginAndOrders = async (req, res) => {
  try {
    const { phone, password } = req.body;
    console.log("👉 [DEBUG] Login attempt for phone:", phone);
    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) return res.status(404).json({ success: false, message: 'Account not found.' });

    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      return res.status(403).json({ success: false, message: 'Account locked for 4 hours due to security reasons. New orders can still be placed.' });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect password.' });

    // Login successful, reset failed attempts just in case
    if (customer.failedAttempts > 0) {
      customer.failedAttempts = 0;
      await customer.save();
    }
    console.log("👉 [DEBUG] Customer found! Searching orders for customerPhone:", phone.trim()); // LOG 2

    const orders = await Order.find({ customerPhone: phone.trim() }).sort({ createdAt: -1 }).limit(10);
    console.log("👉 [DEBUG] Orders found from DB:", orders.length); // LOG 3
    console.log(orders); // Yeh pura order array terminal mein print karega
    res.status(200).json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 5. Forgot Password Logic (3 Strikes = 4 Hour Lock)
exports.forgotPassword = async (req, res) => {
  try {
    const { phone, pincode, newPassword } = req.body;
    const customer = await Customer.findOne({ phone: phone.trim() });
    
    if (!customer) return res.status(404).json({ success: false, message: 'Account not found.' });

    // Check if currently locked
    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      return res.status(403).json({ success: false, message: 'Account is locked for 4 hours. Try again later.' });
    }

    
    if (customer.defaultAddress.pincode === pincode.trim()) {
      // Success! Reset password and clear strikes
      customer.password = await bcrypt.hash(newPassword, 10);
      customer.failedAttempts = 0;
      customer.lockUntil = null;
      await customer.save();
      return res.status(200).json({ success: true, message: 'Password reset successfully!' });
    } else {
      // Failed attempt
      customer.failedAttempts = (customer.failedAttempts || 0) + 1;
      let remaining = 3 - customer.failedAttempts;
      
      if (customer.failedAttempts >= 3) {
        customer.lockUntil = new Date(Date.now() + 4 * 60 * 60 * 1000); // Lock for 4 hours
        customer.failedAttempts = 0; // Reset counter for next time
        await customer.save();
        return res.status(403).json({ success: false, message: '3 failed attempts. Account locked for 4 hours for security.' });
      } else {
        await customer.save();
        return res.status(400).json({ success: false, message: `Incorrect details. ${remaining} attempts left before account lock.` });
      }
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 6. Get Customer Orders (THIS WAS MISSING!)
exports.getCustomerOrders = async (req, res) => {
  try {
    const { phone } = req.params;
    const orders = await Order.find({ customerPhone: phone.trim() })
      .sort({ createdAt: -1 })
      .limit(10);
    res.status(200).json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Routes
// ... existing code ...

// Admin Routes - Status & Tracking Update
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    // req.body se sabhi naye fields lein
    const { orderStatus, trackingId, courierName } = req.body;

    const updateData = {};
    if (orderStatus) updateData.orderStatus = orderStatus;
    // trackingId update, khali bhi ho sakti hai (jaise pack karte samay)
    if (trackingId !== undefined) updateData.trackingId = trackingId;
    if (courierName !== undefined) updateData.courierName = courierName;

    const updatedOrder = await Order.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
};

// ... existing code ...

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  } catch (error) { res.status(500).json({ success: false }); }
};