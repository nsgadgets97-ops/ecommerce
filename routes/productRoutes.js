const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const multer = require('multer');

// 🔒 Auth Middleware Import Karein
const { verifyAdmin } = require('../middlewares/authMiddleware');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
});

// ✅ Public Routes (Grahak ko products dikhane ke liye)
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// 🔒 Protected Admin Routes (Hacker nahi ghus sakta)
router.post('/add', verifyAdmin, upload.array('images', 4), productController.createProduct);
router.put('/:id', verifyAdmin, upload.array('images', 4), productController.updateProduct);
router.put('/update/:id', verifyAdmin, upload.array('images', 3), productController.updateProduct);
router.delete('/:id', verifyAdmin, productController.deleteProduct);

module.exports = router;