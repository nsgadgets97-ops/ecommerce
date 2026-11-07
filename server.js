require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const geoip = require('geoip-lite');
const cookieParser = require('cookie-parser');

const Order = require('./models/Order'); 
const Setting = require('./models/Setting'); 

const app = express();

// ==========================================
// 🛡️ SECURITY MIDDLEWARES START
// ==========================================

// 1. Security Headers (Helmet)
app.use(helmet({ crossOriginResourcePolicy: false }));

// 2. Strict CORS Setup - Sirf Compile Print aur Client ki websites allowed hain
const allowedOrigins = [
    'https://compileprint.in', 
    'https://nssmartgadgets.netlify.app', // Client ki Netlify site
    'https://nssmartgadgets.com',         // Client ka Custom Domain
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5500',
    'http://192.168.1.9:5500',
    process.env.FRONTEND_URL
]; 
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by CORS Security'));
        }
    },
    credentials: true // HttpOnly Cookie based auth ke liye zaroori
}));

// 3. Geo-Blocking Middleware - Videshi traffic block karega
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    if (ip === '127.0.0.1' || ip === '::1' || ip.includes('localhost')) {
        return next();
    }

    const geo = geoip.lookup(ip);
    if (geo && geo.country !== 'IN') {
        console.warn(`Blocked request from ${geo.country} - IP: ${ip}`);
        return res.status(403).json({ success: false, message: 'Access denied from your region.' });
    }
    next();
});

// 4. Rate Limiting (DDoS aur Brute Force se bachaaw)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    message: { success: false, message: 'Bahut zyada requests aayi hain. Kripya 15 minute baad try karein.' }
});
app.use('/api/', apiLimiter);

// 5. Body Parser aur Cookie Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); 

// 6. NoSQL Injection Prevention
app.use((req, res, next) => {
    if (req.body) mongoSanitize.sanitize(req.body, { replaceWith: '_' });
    if (req.query) mongoSanitize.sanitize(req.query, { replaceWith: '_' });
    if (req.params) mongoSanitize.sanitize(req.params, { replaceWith: '_' });
    next();
});

// ==========================================
// 🛡️ SECURITY MIDDLEWARES END
// ==========================================

// Static frontend serve karne ke liye
app.use(express.static(path.join(__dirname, 'frontend')));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// API Routes (Saare Duplicates hata diye gaye hain)
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/settings', require('./routes/settingRoutes')); 
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/customer', require('./routes/customerAuthRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/admin-settings', require('./routes/adminSettingsRoutes'));

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running securely' });
});

// Port Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running securely on port ${PORT} and open to local network`);
});