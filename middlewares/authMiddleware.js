const jwt = require('jsonwebtoken');

exports.verifyAdmin = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ success: false, message: 'Access Denied!' });

    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    // JWT वेरीफाई करना
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_key_123');
    req.admin = decoded; // डिकोडेड डेटा (जिसमें id है) req में डाल दिया
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or Expired Token!' });
  }
};