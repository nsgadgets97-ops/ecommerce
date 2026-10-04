const Category = require('../models/Category');
const sharp = require('sharp');
// Ensure ye import tumhari file me upar ho
const { uploadToGitHub } = require('../utils/githubUpload');

// 1. Get all active categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Add new category (With Thumbnail Compression & GitHub Upload)
exports.createCategory = async (req, res) => {
  try {
    const { name, adminId } = req.body;
    let imageUrl = req.body.imageUrl; // Agar direct URL aaye

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name zaroori hai' });
    }

    const existingCategory = await Category.findOne({ name: name.trim() });
    if (existingCategory) {
      return res.status(400).json({ success: false, message: 'Yeh category pehle se bani hui hai' });
    }

    // NAYA LOGIC: Agar file upload hui hai, toh compress karke GitHub pe bhejein
    if (req.file) {
      const compressedBuffer = await sharp(req.file.buffer)
        .resize({ width: 300, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      
      imageUrl = await uploadToGitHub(compressedBuffer, req.file.originalname, 'categories');
    }

    if (!imageUrl) {
        return res.status(400).json({ success: false, message: 'Image upload fail ya URL missing hai' });
    }

    const newCategory = new Category({
      name: name.trim(),
      imageUrl,
      createdBy: adminId || null,
      updatedBy: adminId || null,
    });

    await newCategory.save();
    res.status(201).json({ success: true, data: newCategory, message: 'Category successfully add ho gayi' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Toggle Category Active/Inactive
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, adminId } = req.body;

    const updated = await Category.findByIdAndUpdate(
      id,
      { isActive, updatedBy: adminId || null },
      { new: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Update Category (With Image Compression)
exports.updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    let updateData = {};
    if (name) updateData.name = name.trim();
    
    // अगर नई इमेज आई है तो उसे कंप्रेस करके GitHub पर अपलोड करें
    if (req.file) {
      const compressedBuffer = await sharp(req.file.buffer)
        .resize({ width: 300, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const imageUrl = await uploadToGitHub(compressedBuffer, req.file.originalname, 'categories');
      updateData.imageUrl = imageUrl;
    }

    const category = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ success: true, data: category, message: 'Category Updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};