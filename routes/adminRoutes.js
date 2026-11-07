const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 
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

    if (!process.env.JWT_SECRET) {
      console.error("CRITICAL ERROR: .env file mein JWT_SECRET nahi hai!");
      return res.status(500).json({ success: false, message: 'Server Security Configuration Error' });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    // 🔒 FIX: sameSite ko 'Strict' se hata kar 'Lax' kar diya gaya hai
    // Taaki localhost aur 127.0.0.1 ke beech cookie block na ho
    res.cookie('adminToken', token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', 
      maxAge: 24 * 60 * 60 * 1000 
    });

    res.json({ success: true, message: 'Login successful', admin: { username: admin.username, role: admin.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server login error' });
  }
});

router.post('/logout', (req, res) => {
  // 🔒 FIX: Yahan bhi sameSite update kiya hai
  res.clearCookie('adminToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax'
  });
  res.json({ success: true, message: 'Logout successful' });
});

module.exports = router;