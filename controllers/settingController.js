const Setting = require('../models/Setting');
const { uploadToGitHub } = require('../utils/githubUpload'); // GitHub upload utility zaroor import karein

// 1. Get current settings
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

// 2. Update settings (Admin only)
exports.updateSettings = async (req, res) => {
  try {
    // Frontend FormData se ye variables aayenge
   const { upiId, defaultAdvancePayment, whatsappNumber, announcement1, announcement2, announcement3, adminId } = req.body;

    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting({});
    }

    // 1. TEXT FIELDS UPDATE: 
    // Agar koi value undefined nahi hai (yani form se aayi hai), tabhi update hogi
    if (upiId !== undefined) {
      settings.upiId = upiId;
    }
    
    if (whatsappNumber !== undefined) {
      settings.whatsappNumber = whatsappNumber;
    }
    
    // Frontend 'defaultAdvancePayment' bhejta hai, par DB mein 'defaultAdvanceAmount' hai
    if (defaultAdvancePayment !== undefined) {
      settings.defaultAdvanceAmount = Number(defaultAdvancePayment);
    }
    if (announcement1 !== undefined) settings.announcement1 = announcement1;
    if (announcement2 !== undefined) settings.announcement2 = announcement2;
    if (announcement3 !== undefined) settings.announcement3 = announcement3;

    // 2. IMAGE OVERWRITE PREVENT LOGIC:
    // Agar frontend se nayi file aayi hai, tabhi GitHub par upload karke naya URL save karein.
    // Agar file nahi aayi, toh ye block skip ho jayega aur purani image safe rahegi!
    if (req.file) {
      const imageUrl = await uploadToGitHub(req.file.buffer, req.file.originalname, 'settings');
      settings.upiQrCodeUrl = imageUrl;
    }

    // Audit field
    settings.updatedBy = adminId || null;

    await settings.save();
    res.status(200).json({ success: true, data: settings, message: 'Settings update ho gayi' });
  } catch (error) {
    console.error('Settings Update Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};