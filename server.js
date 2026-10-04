// server.js
require('dotenv').config();
//const dns = require('dns');
//dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middlewares
app.use(cors()); // Live Server (port 5500) se requests accept karne ke liye
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend serve karne ke liye (agar same port se run karna ho)
app.use(express.static(path.join(__dirname, 'frontend')));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// API Routes
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/settings', require('./routes/settingRoutes')); // Dhyan dein: settingRoutes (without 's')
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/customer', require('./routes/customerAuthRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// server.js (API Routes wale section mein)

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
// ... baki routes ...

// Naya completely isolated route add karein
app.use('/api/admin-settings', require('./routes/adminSettingsRoutes'));

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running smoothly' });
});

// Port Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});