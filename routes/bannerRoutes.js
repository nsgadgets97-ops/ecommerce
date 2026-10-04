const express = require('express');
const router = express.Router();
const multer = require('multer'); // 1. Multer import kiya

// 2. Memory storage setup kiya
const upload = multer({ storage: multer.memoryStorage() }); 

const {
  getActiveBanners,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/bannerController');

router.get('/active', getActiveBanners); 
router.get('/all', getAllBanners);        

// 3. FIX: Yahan 'upload.single("bannerImage")' lagana zaroori hai
router.post('/add', upload.single('bannerImage'), createBanner); 

router.put('/:id', updateBanner);         
router.delete('/:id', deleteBanner); 
     

module.exports = router;