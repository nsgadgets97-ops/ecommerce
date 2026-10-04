require('dotenv').config();
const mongoose = require('mongoose');
const sharp = require('sharp');
const Product = require('./models/Product');
const { uploadToGitHub } = require('./utils/githubUpload');

async function generateThumbnails() {
  try {
    console.log('⏳ MongoDB se connect ho raha hai...');
    // Apne connection string ko verify kar lena
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected!\n');

    // Wo products dhoondho jinme thumbnailUrl nahi hai ya khali hai
    const products = await Product.find({
      $or: [
        { thumbnailUrl: { $exists: false } },
        { thumbnailUrl: '' },
        { thumbnailUrl: null }
      ]
    });

    if (products.length === 0) {
      console.log('🎉 Koi naya product update karne ke liye nahi bacha hai. Sabme thumbnail hai!');
      process.exit(0);
    }

    console.log(`📦 Total ${products.length} products mile jinke thumbnail banne hain.\n`);

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`⚙️  Processing ${i + 1}/${products.length}: ${product.title}`);

      // Pehli image ka URL nikalein
      const mainImage = (product.images && product.images.length > 0)
        ? product.images[0]
        : product.imageUrl;

      if (!mainImage) {
        console.log(`   ⏭️ Skipping... is product mein koi image hi nahi hai.`);
        continue;
      }

      try {
        // 1. Existing image ko URL se download karein (Buffer mein)
        const response = await fetch(mainImage);
        if (!response.ok) throw new Error(`Image fetch failed with status: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // 2. Sharp se compress karke Thumbnail banayein
        const thumbBuffer = await sharp(imageBuffer)
          .resize({ width: 300, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        // 3. GitHub par upload karein
        const fileName = `thumb_migrated_${product._id}.webp`;
        const thumbnailUrl = await uploadToGitHub(thumbBuffer, fileName, 'products/thumbnails');

        // 4. Database mein product update karein
        product.thumbnailUrl = thumbnailUrl;
        await product.save();

        console.log(`   ✅ Success: Thumbnail updated -> ${thumbnailUrl}`);
      } catch (err) {
        console.error(`   ❌ Error for '${product.title}':`, err.message);
      }
    }

    console.log('\n🚀 Sabhi thumbnails ka kaam poora ho gaya!');
  } catch (err) {
    console.error('Migration script fail ho gayi:', err);
  } finally {
    // Kaam khatam hone ke baad connection close karein taaki script khud band ho jaye
    mongoose.connection.close();
    process.exit(0);
  }
}

generateThumbnails();