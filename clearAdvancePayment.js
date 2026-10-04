require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product'); // अपने Product मॉडल का सही पाथ चेक कर लें

async function clearAdvancePayment() {
  try {
    console.log('⏳ MongoDB se connect ho raha hai...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected!\n');

    // सिर्फ उन प्रोडक्ट्स को खोजें जिनका advancePayment एकदम 300 है
    const query = { advancePayment: 300 };
    
    // पहले चेक करते हैं कितने प्रोडक्ट्स हैं
    const productsToUpdate = await Product.countDocuments(query);

    if (productsToUpdate === 0) {
      console.log('🎉 Koi aisa product nahi mila jisme advance payment exactly 300 ho. Sab pehle se clear hai!');
      process.exit(0);
    }

    console.log(`📦 Total ${productsToUpdate} products mile jinme advance payment 300 hai. Unhe clear kar rahe hain...\n`);

    // $unset का इस्तेमाल करके उन सभी से advancePayment फील्ड को हमेशा के लिए हटा देंगे
    const result = await Product.updateMany(
      query,
      { $unset: { advancePayment: 1 } }
    );

    console.log(`✅ Success: ${result.modifiedCount} products se 300 wali advance payment hatayi ja chuki hai!`);
    console.log('🚀 (Jo 300 se zyada the, unhe bilkul nahi chheda gaya hai.)\n');

  } catch (err) {
    console.error('❌ Script fail ho gayi:', err);
  } finally {
    // काम खत्म होने के बाद कनेक्शन बंद करें
    mongoose.connection.close();
    process.exit(0);
  }
}

clearAdvancePayment();