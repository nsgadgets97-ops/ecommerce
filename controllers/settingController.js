const Setting = require('../models/Setting');
const { uploadToGitHub } = require('../utils/githubUpload'); 
const sanitizeHtml = require('sanitize-html'); // 🔒 XSS Protection

// 🔒 Safe Sanitize Function (Sirf text, no HTML)
const cleanText = (text) => {
  if (!text) return text;
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
};

exports.getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        upiId: '',
        upiQrCodeUrl: '',
        defaultAdvanceAmount: 300,
        whatsappNumber: '',
      });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { upiId, defaultAdvancePayment, whatsappNumber, announcement1, announcement2, announcement3, adminId, howToOrderTitle, howToOrderVideoUrl, pendingOrderExpiryHours } = req.body;

    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting({});
    }

    // 1. TEXT FIELDS UPDATE (With Sanitization) 🔒
    if (upiId !== undefined) settings.upiId = cleanText(upiId);
    if (whatsappNumber !== undefined) settings.whatsappNumber = cleanText(whatsappNumber);
    if (defaultAdvancePayment !== undefined) settings.defaultAdvanceAmount = Number(defaultAdvancePayment);
    
    // Announcements Sanitize
    if (announcement1 !== undefined) settings.announcement1 = cleanText(announcement1);
    if (announcement2 !== undefined) settings.announcement2 = cleanText(announcement2);
    if (announcement3 !== undefined) settings.announcement3 = cleanText(announcement3);
    
    // Video Text Sanitize
    if (howToOrderTitle !== undefined) settings.howToOrderTitle = cleanText(howToOrderTitle);
    if (howToOrderVideoUrl !== undefined) settings.howToOrderVideoUrl = cleanText(howToOrderVideoUrl); // URL ko bhi clean kiya
    if (pendingOrderExpiryHours !== undefined) settings.pendingOrderExpiryHours = Number(pendingOrderExpiryHours);

    // 2. IMAGE OVERWRITE PREVENT LOGIC
    if (req.file) {
      const imageUrl = await uploadToGitHub(req.file.buffer, req.file.originalname, 'settings');
      settings.upiQrCodeUrl = imageUrl;
    }

    settings.updatedBy = adminId || null;

    await settings.save();
    res.status(200).json({ success: true, data: settings, message: 'Settings update ho gayi' });
  } catch (error) {
    console.error('Settings Update Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};