// controllers/adminSettingsController.js
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin'); 
const Customer = require('../models/Customer'); 

// 1. Change Password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    // Auth middleware se admin id aayegi (req.admin ya req.user jo bhi aap use karte hain)
    const adminId = req.admin ? req.admin.id : req.user.id; 
    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account nahi mila.' });
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password galat hai!' });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    res.status(200).json({ success: true, message: 'Password successfully update ho gaya hai!' });
  } catch (err) {
    console.error('Change Password Error:', err);
    res.status(500).json({ success: false, message: 'Server error while changing password.' });
  }
};

// 2. Create New Admin
exports.createAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Ye username pehle se exist karta hai.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new Admin({
      username,
      password: hashedPassword,
      role: 'superadmin' 
    });

    await newAdmin.save();
    res.status(201).json({ success: true, message: 'Naya Admin successfully create ho gaya hai!' });
  } catch (err) {
    console.error('Create Admin Error:', err);
    res.status(500).json({ success: false, message: 'Server error while creating admin.' });
  }
};

// 3. Get All Customers
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({}).sort({ createdAt: -1 }).select('-password');
    
    const formattedCustomers = customers.map(c => {
      let fullAddress = 'Address not provided';
      let cityState = 'N/A';

      // Schema ke hisaab se defaultAddress check kar rahe hain
      if (c.defaultAddress) {
        const { address, city, state, pincode } = c.defaultAddress;
        
        // City / State table mein dikhane ke liye
        let locParts = [];
        if (city) locParts.push(city);
        if (state) locParts.push(state);
        if (locParts.length > 0) cityState = locParts.join(' / ');

        // Full Address Pop-up ke liye
        let fullParts = [];
        if (address) fullParts.push(address);
        if (city) fullParts.push(city);
        if (state) fullParts.push(state);
        if (pincode) fullParts.push(`PIN: ${pincode}`);
        
        if (fullParts.length > 0) fullAddress = fullParts.join(', ');
      }

      return {
        _id: c._id,
        name: c.name || 'Unknown',
        phone: c.phone || 'N/A',
        cityState: cityState,
        fullAddress: fullAddress, 
        createdAt: c.createdAt
      };
    });

    res.status(200).json({ success: true, customers: formattedCustomers });
  } catch (err) {
    console.error('Fetch Customers Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching customers data.' });
  }
};