const express = require('express');
const router = express.Router();
const multer = require('multer');

// 🔒 Auth Middleware Import Karein
const { verifyAdmin } = require('../middlewares/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() }); 

const {
  getActiveBanners,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/bannerController');

// ✅ Public Routes
router.get('/active', getActiveBanners); 
router.get('/all', getAllBanners);        

// 🔒 Protected Admin Routes
router.post('/add', verifyAdmin, upload.single('bannerImage'), createBanner); 
router.put('/:id', verifyAdmin, updateBanner);         
router.delete('/:id', verifyAdmin, deleteBanner); 
     
module.exports = router;