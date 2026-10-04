// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadToGitHub = require('../utils/githubUpload');

// In-memory storage taaki disk space na bhare
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Max 2MB safety limit (frontend compress karke 1MB se kam hi bhejega)
});

router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file required hai' });
    }

    const rawUrl = await uploadToGitHub(req.file.buffer, req.file.originalname);

    res.status(200).json({
      success: true,
      message: 'Image successfully uploaded to GitHub',
      imageUrl: rawUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'GitHub upload failed: ' + (error.response?.data?.message || error.message),
    });
  }
});

module.exports = router;