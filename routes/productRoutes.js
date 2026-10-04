const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const multer = require('multer');

// Memory storage for GitHub buffer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// All Routes
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

router.post('/add', upload.array('images', 4), productController.createProduct);

// Update endpoints (PUT on /:id and /update/:id)
router.put('/:id', upload.array('images', 4), productController.updateProduct);
router.put('/update/:id', upload.array('images', 3), productController.updateProduct);
router.delete('/:id', productController.deleteProduct);



module.exports = router;