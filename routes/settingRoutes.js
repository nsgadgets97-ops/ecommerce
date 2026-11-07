const express = require('express');
const router = express.Router();
const multer = require('multer');
const { updateSettings, getSettings } = require('../controllers/settingController'); 

// 🔒 Auth Middleware Import Karein
const { verifyAdmin } = require('../middlewares/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

// ✅ Public Route (UI ke liye settings lena)
router.get('/', getSettings);

// 🔒 Protected Admin Route (Settings sirf admin badal sakta hai)
router.put('/update', verifyAdmin, upload.single('qrImage'), updateSettings);

module.exports = router;