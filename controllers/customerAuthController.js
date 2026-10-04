// 1. Customer Normal Login
// controllers/customerAuthController.js के सबसे ऊपर Order मॉडल इम्पोर्ट करें:
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const bcrypt = require('bcryptjs');

// loginCustomer फंक्शन को ऐसे अपडेट करें:
exports.loginCustomer = async (req, res) => {
  try {
    const { phone, password } = req.body;
    console.log("👉 [DEBUG] Customer login for phone:", phone);

    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // अगर अकाउंट लॉक है
    if (customer.lockUntil && customer.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((customer.lockUntil - new Date()) / (1000 * 60));
      return res.status(403).json({ 
        success: false, 
        message: `Account locked for remainingMinutes hours due to security reasons.`
      });
    }

    // पासवर्ड चेक
    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    // लॉगिन सफल, अब डेटाबेस से इसके ऑर्डर्स निकालें
    const orders = await Order.find({ customerPhone: phone.trim() })
      .sort({ createdAt: -1 })
      .limit(10);

    console.log("👉 [DEBUG] Total orders fetched:", orders.length);

    // फ्रंटएंड data.orders ढूँढ रहा है, इसलिए orders की (key) भेजना ज़रूरी है
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: customer,
      orders: orders // <--- यह लाइन डेटा पास करेगी
    });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 2. Normal Forgot Password (Pincode + Birth Year check)
exports.verifyAndResetPassword = async (req, res) => {
  try {
    const { phone, pincode, birthYear, newPassword } = req.body;

    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer nahi mila' });
    }

    // Verify Pincode and Birth Year
    const isPincodeMatch = customer.address && customer.address.pincode === pincode.trim();
    const isYearMatch = Number(customer.birthYear) === Number(birthYear);

    if (!isPincodeMatch || !isYearMatch) {
      customer.failedAttempts += 1;
      await customer.save();

      const remaining = 3 - customer.failedAttempts;
      return res.status(400).json({
        success: false,
        failedAttempts: customer.failedAttempts,
        canHardReset: customer.failedAttempts >= 3,
        message:
          remaining > 0
            ? `Pincode ya Birth Year galat hai. ${remaining} attempts bache hain.`
            : '3 attempts khatam ho gaye. Aap "Reset Account" use kar sakte hain.',
      });
    }

    // Details verified successfully -> Set new password
    const salt = await bcrypt.genSalt(10);
    customer.password = await bcrypt.hash(newPassword, salt);
    customer.failedAttempts = 0;
    customer.lockUntil = null;
    customer.isResetPending = false;
    await customer.save();

    res.status(200).json({ success: true, message: 'Password successfully change ho gaya' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Trigger 2-Hour Hard Reset (Clear 45+ Days Old Orders & Lock Account)
exports.triggerHardReset = async (req, res) => {
  try {
    const { phone } = req.body;

    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer nahi mila' });
    }

    if (customer.failedAttempts < 3) {
      return res.status(400).json({
        success: false,
        message: 'Hard reset sirf 3 failed attempts ke baad hi allow hai.',
      });
    }

    // Calculate cutoff date: 45 days ago
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

    // Delete only orders older than 45 days (keeps active/dispatched orders under 45 days safe)
    await Order.deleteMany({
      customerPhone: customer.phone,
      createdAt: { $lt: fortyFiveDaysAgo },
    });

    // Lock account for 2 hours (2 * 60 * 60 * 1000 ms)
    customer.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
    customer.isResetPending = true;
    customer.failedAttempts = 0;
    await customer.save();

    res.status(200).json({
      success: true,
      message: '45 din se purane orders clear kar diye gaye hain. Aap 2 ghante baad naya password set kar sakte hain.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Check Status After 2 Hours & Allow New Password
exports.checkLockAndSetPassword = async (req, res) => {
  try {
    const { phone, newPassword } = req.body;

    const customer = await Customer.findOne({ phone: phone.trim() });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer nahi mila' });
    }

    if (!customer.isResetPending) {
      return res.status(400).json({ success: false, message: 'Koi hard reset pending nahi hai.' });
    }

    // Verify 2-hour timer completion
    if (customer.lockUntil && customer.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((customer.lockUntil - new Date()) / (1000 * 60));
      return res.status(403).json({
        success: false,
        isUnlocked: false,
        remainingMinutes,
        message: `Kripya ${remainingMinutes} minute baad try karein. Abhi 2 ghante poore nahi huye.`,
      });
    }

    // If newPassword provided, set it and unlock account
    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      customer.password = await bcrypt.hash(newPassword, salt);
      customer.lockUntil = null;
      customer.isResetPending = false;
      customer.failedAttempts = 0;
      await customer.save();

      return res.status(200).json({
        success: true,
        message: 'Password set ho gaya. Ab aap login kar sakte hain.',
      });
    }

    // Agar sirf check karne ke liye call kiya hai
    res.status(200).json({
      success: true,
      isUnlocked: true,
      message: '2 ghante poore ho gaye hain. Naya password enter karein.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};