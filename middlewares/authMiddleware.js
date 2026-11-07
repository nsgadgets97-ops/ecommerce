const jwt = require('jsonwebtoken');

exports.verifyAdmin = (req, res, next) => {
  try {
    // 🔒 अब टोकन हेडर से नहीं, बल्कि Cookie-Parser की मदद से Secure Cookie से आएगा
    const token = req.cookies.adminToken;
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access Denied! Kripya login karein.' });
    }

    // हार्डकोडेड सीक्रेट हटा दिया गया है, सिर्फ .env इस्तेमाल होगा
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.admin = decoded; // डिकोडेड डेटा req में डाल दिया
    next();
  } catch (error) {
    // अगर हैकर ने गलत टोकन भेजा या टोकन एक्सपायर हो गया
    return res.status(401).json({ success: false, message: 'Invalid or Expired Token! Kripya wapas login karein.' });
  }
};