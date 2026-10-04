const express = require('express');
const router = express.Router();
const multer = require('multer');
const { updateSettings, getSettings } = require('../controllers/settingController'); // controller ka naam apne hisaab se check kar lena

// Multer memory storage setup
const upload = multer({ storage: multer.memoryStorage() });

// Get settings
router.get('/', getSettings);

// Update settings (Yahan upload.single('qrImage') lagana zaroori hai)
router.put('/update', upload.single('qrImage'), updateSettings);

module.exports = router;