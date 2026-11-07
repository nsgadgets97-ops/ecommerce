const Product = require('../models/Product');
const { uploadToGitHub, deleteFromGitHub } = require('../utils/githubUpload');
const sharp = require('sharp');
const sanitizeHtml = require('sanitize-html'); // 🔒 XSS Protection

// 🔒 Safe Sanitize Function (HTML Tags ko allow karta hai, script ko block)
const cleanHTML = (html) => {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class'] // Basic styling allow karne ke liye
    }
  });
};

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

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product nahi mila' });
    res.status(200).json({ success: true, data: product, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const imagesToDelete = [
      ...(product.images || []),
      product.imageUrl,
      product.thumbnailUrl
    ].filter(Boolean); 

    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Product deleted permanently' });

    if (imagesToDelete.length > 0) {
      deleteImagesInBackground(imagesToDelete);
    }
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const { categoryId, admin, page: queryPage, search, sort } = req.query;
    let query = {};

    if (categoryId && categoryId.toLowerCase() !== 'all') {
      query.category = categoryId;
    }

    if (search) {
      // 🔒 Search query ko bhi sanitize karein taki NoSQL/XSS attacks na ho
      const safeSearch = sanitizeHtml(search, { allowedTags: [], allowedAttributes: {} });
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    let sortOption = {};
    if (sort === 'priceLowHigh') sortOption = { price: 1 };
    else if (sort === 'priceHighLow') sortOption = { price: -1 };
    else if (sort === 'nameAZ') sortOption = { title: 1 };
    else if (sort === 'nameZA') sortOption = { title: -1 };
    else sortOption = { priority: -1, createdAt: -1 };

    let productQuery = Product.find(query)
      .select('title price mrp thumbnailUrl createdAt inStock advancePayment images category youtubeLink variants priority')
      .populate('category', 'name')
      .sort(sortOption);

    let page = 1;
    let hasMore = false;

    if (admin !== 'true') {
      const limit = 30;
      page = parseInt(queryPage) || 1;
      const skip = (page - 1) * limit;

      productQuery = productQuery.skip(skip).limit(limit);
      const totalCount = await Product.countDocuments(query);
      hasMore = (page * limit) < totalCount;
    }

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

exports.createProduct = async (req, res) => {
  try {
    let { title, description, category, price, mrp, advancePayment, adminId, youtubeLink, variants, priority } = req.body; 

    if (!title || !category || !price || !mrp) {
      return res.status(400).json({ success: false, message: 'Sabhi zaroori fields bharein' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Kam se kam 1 image zaroori hai' });
    }
    if (req.files.length > 4) {
      return res.status(400).json({ success: false, message: 'Maximum 4 images allow hain' });
    }

    // 🔒 Sanitization Data (Safe Save)
    title = sanitizeHtml(title, { allowedTags: [], allowedAttributes: {} }); 
    description = cleanHTML(description);

    const imageUrls = [];
    let thumbnailUrl = '';

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const url = await uploadToGitHub(file.buffer, file.originalname, 'products');
      imageUrls.push(url);

      if (i === 0) {
        const thumbBuffer = await sharp(file.buffer).resize({ width: 300, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        thumbnailUrl = await uploadToGitHub(thumbBuffer, `thumb_${file.originalname}`, 'products/thumbnails');
      }
    }
    
    let parsedVariants = [];
    if (variants) { try { parsedVariants = JSON.parse(variants); } catch (error) { console.error('Error parsing variants:', error); } }

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
      variants: parsedVariants,
      priority: priority ? Number(priority) : 0 
    });

    await newProduct.save();
    res.status(201).json({ success: true, data: newProduct, message: 'Product successfully create ho gaya' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let { title, category, price, mrp, advancePayment, existingImages, description, inStock, youtubeLink, variants, priority } = req.body;

    let product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const oldImages = product.images ? [...product.images] : [];
    let parsedVariants = [];
    if (variants) { try { parsedVariants = JSON.parse(variants); } catch (error) {} }

    // 🔒 Sanitization Data
    if (title) product.title = sanitizeHtml(title, { allowedTags: [], allowedAttributes: {} });
    if (description !== undefined) product.description = cleanHTML(description);

    if (category) product.category = category;
    if (price) product.price = Number(price);
    if (mrp) product.mrp = Number(mrp);
    if (inStock !== undefined) product.inStock = (inStock === 'true');
    product.youtubeLink = youtubeLink || '';
    product.variants = parsedVariants;
    if (priority !== undefined) product.priority = Number(priority); 

    if (advancePayment !== undefined) {
      if (advancePayment === '' || advancePayment === 'null') product.advancePayment = undefined;
      else product.advancePayment = Number(advancePayment);
    }

    let finalImages = [];
    if (existingImages) {
      try { finalImages = JSON.parse(existingImages); }
      catch (e) { finalImages = Array.isArray(existingImages) ? existingImages : [existingImages]; }
    }

    let newFilesData = [];
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const url = await uploadToGitHub(file.buffer, file.originalname, 'products');
        finalImages.push(url);
        newFilesData.push({ url, buffer: file.buffer, originalname: file.originalname });
      }
    }

    finalImages = finalImages.slice(0, 3);
    product.images = finalImages;

    let thumbnailToDeleteInBg = null;
    if (finalImages.length > 0) {
      if (finalImages[0] !== oldImages[0] || !product.thumbnailUrl) {
        thumbnailToDeleteInBg = product.thumbnailUrl;
        product.thumbnailUrl = '';
        let thumbBuffer, thumbFileName;

        const matchedNewFile = newFilesData.find(f => f.url === finalImages[0]);
        if (matchedNewFile) {
          thumbBuffer = matchedNewFile.buffer;
          thumbFileName = `thumb_${matchedNewFile.originalname}`;
        } else {
          try {
            const axios = require('axios');
            const response = await axios.get(finalImages[0], { responseType: 'arraybuffer', timeout: 15000 });
            thumbBuffer = Buffer.from(response.data);
            thumbFileName = `thumb_recovered_${Date.now()}.webp`;
          } catch (fetchErr) {}
        }
        if (thumbBuffer) {
          try {
            const resizedBuffer = await sharp(thumbBuffer).resize({ width: 300, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
            product.thumbnailUrl = await uploadToGitHub(resizedBuffer, thumbFileName, 'products/thumbnails');
          } catch (sharpErr) {}
        }
      }
    } else {
      thumbnailToDeleteInBg = product.thumbnailUrl;
      product.images = [];
      product.thumbnailUrl = '';
    }

    await product.save();
    res.status(200).json({ success: true, message: 'Product updated successfully', product });

    setTimeout(async () => {
      try {
        const imagesToDelete = oldImages.filter(oldImg => !finalImages.includes(oldImg));
        for (const imgUrl of imagesToDelete) await deleteFromGitHub(imgUrl);
        if (thumbnailToDeleteInBg) await deleteFromGitHub(thumbnailToDeleteInBg);
      } catch (delErr) {}
    }, 0);

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};