const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // JWT इम्पोर्ट किया
const Admin = require('../models/Admin');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username aur Password dono zaroori hain' });
    }

    const admin = await Admin.findOne({ username: username.trim() });
    
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid Credentials' });

    // सुरक्षित JWT टोकन बनाना (1 दिन की वैलिडिटी के साथ)
    const token = jwt.sign(
      { id: admin._id, role: admin.role }, 
      process.env.JWT_SECRET || 'super_secret_key_123', 
      { expiresIn: '1d' }
    );

    res.json({ success: true, message: 'Login successful', token, admin: { username: admin.username, role: admin.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server login error' });
  }
});
module.exports = router;