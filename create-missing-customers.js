require('dotenv').config(); // Taki MONGO_URI .env se mil jaye
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Apne models ka sahi path zaroor check kar lena (jaise './models/Order')
const Order = require('./models/Order'); 
const Customer = require('./models/Customer'); 

async function createMissingCustomers() {
  try {
    console.log("⏳ MongoDB se connect ho raha hai...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Database Connected!");

    const allOrders = await Order.find({});
    console.log(`📦 Total Orders found: ${allOrders.length}`);

    let createdCount = 0;
    // Set ka use duplicate numbers ko memory mein hi rokne ke liye
    const processedPhones = new Set(); 

    for (const order of allOrders) {
      const phone = order.customerPhone?.trim();
      
      // Agar phone number nahi hai ya is loop mein pehle process ho chuka hai, toh skip karein
      if (!phone || processedPhones.has(phone)) continue;
      
      processedPhones.add(phone);

      // Database mein check karein
      const existingCustomer = await Customer.findOne({ phone: phone });

      if (!existingCustomer) {
        console.log(`👤 Customer missing for ${phone}. Creating new...`);
        
        const fullName = order.shippingDetails?.name?.trim();
        const nameToSave = fullName || 'Unknown User';
        
        // Default password '12345'
        let fallbackPassword = '12345';
        
        // Agar naam diya hai, toh first name ko password banayein
        if (fullName && fullName.toLowerCase() !== 'unknown user') {
          fallbackPassword = fullName.split(' ')[0]; 
        }

        // Password Hash (Encrypt) karein
        const hashedPassword = await bcrypt.hash(fallbackPassword, 10);

        // Customer Create karein
        await Customer.create({
          phone: phone,
          name: nameToSave,
          password: hashedPassword,
          defaultAddress: {
            address: order.shippingDetails?.address || '',
            city: order.shippingDetails?.city || '',
            state: order.shippingDetails?.state || '',
            pincode: order.shippingDetails?.pincode || ''
          }
        });

        createdCount++;
      }
    }

    console.log(`🎉 Script Finished! Total ${createdCount} naye customers banaye gaye.`);
    process.exit(0);

  } catch (error) {
    console.error("❌ Error aagaya bhai:", error);
    process.exit(1);
  }
}

createMissingCustomers();