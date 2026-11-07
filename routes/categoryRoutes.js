const express = require('express');
const router = express.Router();
const multer = require('multer');
const Category = require('../models/Category');
const { uploadToGitHub } = require('../utils/githubUpload');

// 🔒 Auth Middleware Import Karein
const { verifyAdmin } = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } 
});

// ✅ Public Route (Grahak ko categories dikhane ke liye)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 🔒 Protected Admin Routes (Sirf Admin hi categories chhed sakta hai)
router.post('/', verifyAdmin, upload.single('categoryImage'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category Name zaroori hai' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Category photo upload karni zaroori hai' });

    const rawImageUrl = await uploadToGitHub(req.file.buffer, req.file.originalname, 'categories');
    const newCat = new Category({ name: name.trim(), imageUrl: rawImageUrl });
    await newCat.save();

    res.json({ success: true, message: 'Category created!', data: newCat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

router.put('/:id', verifyAdmin, upload.single('categoryImage'), async (req, res) => {
  try {
    const { name } = req.body;
    let updateData = {};
    if (name) updateData.name = name.trim();
    
    if (req.file) {
      const imageUrl = await uploadToGitHub(req.file.buffer, req.file.originalname, 'categories');
      updateData.imageUrl = imageUrl;
    }

    const category = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ success: true, data: category, message: 'Category Updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;