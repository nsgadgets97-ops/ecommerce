const Banner = require('../models/Banner');


// 1. Get active banners for Homepage (sorted by position)
exports.getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .sort({ position: 1 })
      .limit(5); // Top 5 active banners
    res.status(200).json({ success: true, count: banners.length, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get all banners (Admin Dashboard ke liye)
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ position: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Create Banner (Admin only)
// controllers/bannerController.js (Sirf createBanner function replace karein)

const { uploadToGitHub } = require('../utils/githubUpload'); // GitHub upload function

exports.createBanner = async (req, res) => {
  try {
    // 1. Agar req.body undefined hai, toh empty object assign karein
    const body = req.body || {};
    const { targetLink } = body; 

    // 2. Check karein ki image file aayi hai ya nahi
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Banner image is required' });
    }

    // 3. Image ko GitHub par upload karein
    const imageUrl = await uploadToGitHub(req.file.buffer, req.file.originalname, 'banners');

    // 4. Database mein naya banner save karein
    const newBanner = await Banner.create({
      imageUrl: imageUrl,
      targetLink: targetLink || '', // Agar link nahi diya hai toh khali string save hogi
      isActive: true // By default active rakhein (max 4 ki limit baad mein handle kar lenge)
    });

    res.status(201).json({ success: true, message: 'Banner added successfully', data: newBanner });
  } catch (error) {
    console.error('Banner Upload Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Update Banner
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBanner = await Banner.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json({ success: true, data: updatedBanner, message: 'Banner update ho gaya' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Delete Banner
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    await Banner.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Banner delete ho gaya' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};