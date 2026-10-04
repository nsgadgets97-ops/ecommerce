const Product = require('../models/Product');
const { uploadToGitHub, deleteFromGitHub } = require('../utils/githubUpload');
const sharp = require('sharp');

const deleteImagesInBackground = async (imageUrls) => {
  try {
    for (const url of imageUrls) {
      if (url) await deleteFromGitHub(url);
    }
    console.log("✅ Background image deletion task completed.");
  } catch (err) {
    console.error("❌ Background image deletion error:", err);
  }
};



// 1. Get products (Category filter, Pagination aur Bandwidth Save ke sath)
// 1. Get products (Category filter, Pagination, aur Admin Check ke sath)
exports.getProducts = async (req, res) => {
  try {
    const { categoryId, admin, page: queryPage } = req.query;
    let query = {};

    // 1. Category filter lagayein
    if (categoryId && categoryId.toLowerCase() !== 'all') {
      query.category = categoryId;
    }

    // 2. Basic Query banayein (Customer aur Admin dono ko saare products dikhenge)
    let productQuery = Product.find(query)
      .select('title price mrp thumbnailUrl inStock advancePayment images category youtubeLink variants')
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    // 3. Pagination sirf Customer ke liye (Jab admin request na ho)
    let page = 1;
    let hasMore = false;

    if (admin !== 'true') {
      const limit = 30; // Customer ko ek baar me 30 product dikhenge
      page = parseInt(queryPage) || 1;
      const skip = (page - 1) * limit;

      // Query mein pagination add karein
      productQuery = productQuery.skip(skip).limit(limit);

      const totalCount = await Product.countDocuments(query);
      hasMore = (page * limit) < totalCount;
    }

    // Query execute karein
    const products = await productQuery;

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
      products: products,
      hasMore: hasMore,
      currentPage: page
    });
  } catch (error) {
    console.error("getProducts Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get single product details
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product nahi mila' });
    res.status(200).json({ success: true, data: product, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Create Product (Thumbnail Creation included)
exports.createProduct = async (req, res) => {
  try {
    const { title, description, category, price, mrp, advancePayment, adminId, youtubeLink, variants } = req.body;

    if (!title || !category || !price || !mrp) {
      return res.status(400).json({ success: false, message: 'Sabhi zaroori fields bharein' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Kam se kam 1 image zaroori hai' });
    }

    if (req.files.length > 4) {
      return res.status(400).json({ success: false, message: 'Maximum 4 images allow hain' });
    }

    const imageUrls = [];
    let thumbnailUrl = '';

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const url = await uploadToGitHub(file.buffer, file.originalname, 'products');
      imageUrls.push(url);

      // Pehli image (Index 0) ka 300px ka Thumbnail banayein
      if (i === 0) {
        const thumbBuffer = await sharp(file.buffer)
          .resize({ width: 300, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        thumbnailUrl = await uploadToGitHub(thumbBuffer, `thumb_${file.originalname}`, 'products/thumbnails');
      }
    }
    let parsedVariants = [];
    if (variants) {
      try {
        parsedVariants = JSON.parse(variants);
      } catch (error) {
        console.error('Error parsing variants:', error);
      }
    }

    const newProduct = new Product({
      title, description, category,
      price: Number(price),
      mrp: Number(mrp),
      advancePayment: advancePayment ? Number(advancePayment) : null,
      images: imageUrls,
      thumbnailUrl: thumbnailUrl,
      createdBy: adminId || null,
      updatedBy: adminId || null,
      youtubeLink: youtubeLink || '',
      variants: parsedVariants
    });

    await newProduct.save();
    res.status(201).json({ success: true, data: newProduct, message: 'Product successfully create ho gaya' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Update Product (With new Thumbnail generation)
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, price, mrp, advancePayment, existingImages, description, inStock, youtubeLink, variants } = req.body;

    let product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // 1. Purani images aur thumbnail ka backup le rahe hain (delete logic ke liye)
    const oldImages = product.images ? [...product.images] : [];
    const oldThumbnail = product.thumbnailUrl;
    let parsedVariants = [];
    if (variants) {
      try {
        parsedVariants = JSON.parse(variants);
      } catch (error) {
        console.error('Error parsing variants in update:', error);
      }
    }

    // 2. Normal text fields update
    if (title) product.title = title;
    if (category) product.category = category;
    if (price) product.price = Number(price);
    if (mrp) product.mrp = Number(mrp);
    if (description !== undefined) product.description = description;
    if (inStock !== undefined) product.inStock = (inStock === 'true');
    product.youtubeLink = youtubeLink || '';
    product.variants = parsedVariants;

    // 3. Advance Payment Fix
    if (advancePayment !== undefined) {
      if (advancePayment === '' || advancePayment === 'null') {
        product.advancePayment = undefined;
      } else {
        product.advancePayment = Number(advancePayment);
      }
    }

    // 4. Existing images ka array handle karna
    let finalImages = [];
    if (existingImages) {
      try { finalImages = JSON.parse(existingImages); }
      catch (e) { finalImages = Array.isArray(existingImages) ? existingImages : [existingImages]; }
    }

    let newFilesData = [];

    // 5. Nayi files upload karna (aur buffer save rakhna thumbnail ke liye)
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const url = await uploadToGitHub(file.buffer, file.originalname, 'products');
        finalImages.push(url);
        newFilesData.push({ url, buffer: file.buffer, originalname: file.originalname });
      }
    }

    // Max 3 images limit
    finalImages = finalImages.slice(0, 3);
    product.images = finalImages;

    // ==========================================
    // 6. SMART THUMBNAIL LOGIC (Bulletproof Fix)
    // ==========================================
    let thumbnailToDeleteInBg = null;

    if (finalImages.length > 0) {
      // Agar main image (Pehli photo) change hui hai, ya pehle se thumbnail nahi hai
      if (finalImages[0] !== oldImages[0] || !product.thumbnailUrl) {

        // ✅ FIX: Pehle hi purana thumbnail DB se hata do, taaki galat photo na dikhe
        thumbnailToDeleteInBg = product.thumbnailUrl;
        product.thumbnailUrl = '';

        let thumbBuffer;
        let thumbFileName;

        // Condition A: Agar nayi main image abhi upload hui hai
        const matchedNewFile = newFilesData.find(f => f.url === finalImages[0]);
        if (matchedNewFile) {
          thumbBuffer = matchedNewFile.buffer;
          thumbFileName = `thumb_${matchedNewFile.originalname}`;
        }
        // Condition B: Agar purani image main ban gayi hai, toh GitHub se download karo
        else {
          try {
            const axios = require('axios');
            // Timeout badha diya hai taaki network slow ho toh jaldi fail na ho
            const response = await axios.get(finalImages[0], { responseType: 'arraybuffer', timeout: 15000 });
            thumbBuffer = Buffer.from(response.data);
            thumbFileName = `thumb_recovered_${Date.now()}.webp`;
          } catch (fetchErr) {
            console.error('⚠️ Thumbnail banane ke liye image fetch fail ho gayi (Network Issue):', fetchErr.message);
          }
        }

        // Agar buffer mil gaya, toh upload karo
        if (thumbBuffer) {
          try {
            const resizedBuffer = await sharp(thumbBuffer)
              .resize({ width: 300, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer();
            product.thumbnailUrl = await uploadToGitHub(resizedBuffer, thumbFileName, 'products/thumbnails');
          } catch (sharpErr) {
            console.error('⚠️ Thumbnail upload error:', sharpErr.message);
          }
        }
      }
    } else {
      // Agar saari photos delete kar di hain
      thumbnailToDeleteInBg = product.thumbnailUrl;
      product.images = [];
      product.thumbnailUrl = '';
    }

    await product.save();
    res.status(200).json({ success: true, message: 'Product updated successfully', product });

    // ==========================================
    // 7. ASYNC BACKGROUND GITHUB DELETION LOGIC
    // ==========================================
    setTimeout(async () => {
      try {
        // Un images ko dhundo jo purane array mein thi par naye mein nahi hain
        const imagesToDelete = oldImages.filter(oldImg => !finalImages.includes(oldImg));

        for (const imgUrl of imagesToDelete) {
          await deleteFromGitHub(imgUrl);
        }

        // Agar humne naya thumbnail banaya hai, toh purana GitHub se delete karo
        if (thumbnailToDeleteInBg) {
          await deleteFromGitHub(thumbnailToDeleteInBg);
        }
      } catch (delErr) {
        console.error("Background image deletion failed (Network timeout likely):", delErr.message);
      }
    }, 0);

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. DELETE PRODUCT (Background delete ke sath)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Delete hone wali saari images ka array bana lo (main images + old imageUrl + thumbnail)
    const imagesToDelete = [
      ...(product.images || []),
      product.imageUrl,
      product.thumbnailUrl
    ].filter(Boolean); // filter(Boolean) se null ya undefined value array se hat jayegi

    // 🚀 Database se turant product hata do aur Admin ko success bhej do
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Product deleted permanently' });

    // ⏳ RESPONSE JANE KE BAAD Background Task start kar do
    if (imagesToDelete.length > 0) {
      deleteImagesInBackground(imagesToDelete);
    }

  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};