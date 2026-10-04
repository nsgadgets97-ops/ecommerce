require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

// तीनों मॉडल्स को इम्पोर्ट करें (पाथ अपने प्रोजेक्ट के हिसाब से चेक कर लें)
const Product = require('./models/Product'); 
const Category = require('./models/Category'); 
const Banner = require('./models/Banner'); 

const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// GitHub API Headers
const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
};

async function getDbImages() {
    console.log('Fetching active images from Database (Products, Categories, Banners)...');
    const activeImages = new Set();

    // 1. Products की इमेजेज
    const products = await Product.find({}, 'images thumbnailUrl');
    products.forEach(p => {
        if (p.images && p.images.length > 0) {
            p.images.forEach(img => activeImages.add(img));
        }
        if (p.thumbnailUrl) {
            activeImages.add(p.thumbnailUrl);
        }
    });

    // 2. Categories की इमेजेज
    const categories = await Category.find({}, 'categoryImage imageUrl image');
    categories.forEach(c => {
        if (c.imageUrl) activeImages.add(c.imageUrl);
        if (c.categoryImage) activeImages.add(c.categoryImage);
        if (c.image) activeImages.add(c.image);
    });

    // 3. Banners की इमेजेज
    const banners = await Banner.find({}, 'imageUrl image');
    banners.forEach(b => {
        if (b.imageUrl) activeImages.add(b.imageUrl);
        if (b.image) activeImages.add(b.image);
    });

    return activeImages;
}

async function getGithubFiles(folderPath) {
    console.log(`Fetching files from GitHub folder: ${folderPath}...`);
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${folderPath}?ref=${GITHUB_BRANCH}`;
        const response = await axios.get(url, { headers });
        return response.data.filter(file => file.type === 'file'); // सिर्फ फाइल्स को फ़िल्टर करें
    } catch (err) {
        if (err.response && err.response.status === 404) {
            console.log(`Folder '${folderPath}' not found on GitHub, skipping...`);
            return []; // अगर फोल्डर नहीं बना है तो खाली ऐरे भेज दें
        }
        throw err;
    }
}

async function deleteFromGithub(filePath, sha) {
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
        await axios.delete(url, {
            headers,
            data: {
                message: `Cleanup: Deleted orphaned image ${filePath}`,
                sha: sha,
                branch: GITHUB_BRANCH
            }
        });
        console.log(`✅ Deleted: ${filePath}`);
    } catch (err) {
        console.error(`❌ Failed to delete ${filePath}:`, err.message);
    }
}

async function runCleanup() {
    try {
        // डेटाबेस से कनेक्ट करें
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        // डेटाबेस से सभी एक्टिव इमेजेज मंगाएं
        const activeImagesSet = await getDbImages();
        console.log(`Total active images in DB: ${activeImagesSet.size}`);

        // GitHub के सभी फोल्डर्स से फाइल्स की लिस्ट मंगाएं
        const productFiles = await getGithubFiles('products');
        const thumbnailFiles = await getGithubFiles('products/thumbnails');
        const categoryFiles = await getGithubFiles('categories');
        const bannerFiles = await getGithubFiles('banners');
        
        const allGithubFiles = [...productFiles, ...thumbnailFiles, ...categoryFiles, ...bannerFiles];

        console.log(`Total files found on GitHub across all folders: ${allGithubFiles.length}`);

        let deletedCount = 0;

        for (const file of allGithubFiles) {
            // चेक करें कि क्या GitHub की फाइल हमारे डेटाबेस में मौजूद है
            const isUsed = Array.from(activeImagesSet).some(dbUrl => dbUrl.includes(file.name));

            if (!isUsed) {
                console.log(`🗑️ Orphan found: ${file.path}. Deleting...`);
                await deleteFromGithub(file.path, file.sha);
                deletedCount++;
            }
        }

        console.log(`\n🎉 Cleanup Complete! Total ${deletedCount} orphaned images deleted.`);
        process.exit(0);
    } catch (error) {
        console.error('Script Error:', error);
        process.exit(1);
    }
}

runCleanup();