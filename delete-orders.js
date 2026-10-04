require('dotenv').config();
const mongoose = require('mongoose');

// apne Order model ka sahi path yahan check kar lena
const Order = require('./models/Order'); 

async function cleanupDuplicatePendingOrders() {
    try {
        console.log("⏳ Database se connect ho raha hai...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Database connected successfully.");

        // Step 1: Saare unique customer phone numbers nikal lo
        const distinctPhones = await Order.distinct('customerPhone');
        console.log(`📦 Total unique customers found: ${distinctPhones.length}`);

        let totalDeleted = 0;
        const idsToDelete = [];

        // Step 2: Har ek customer ke orders check karo
        for (const phone of distinctPhones) {
            // Is number ke saare orders nikalo (sabse naya order sabse upar aayega - descending order)
            const orders = await Order.find({ customerPhone: phone }).sort({ createdAt: -1 });

            // Check karo ki kya is customer ka koi order Accepted, Packed ya Dispatched ho chuka hai?
            const hasProcessedOrder = orders.some(o => o.orderStatus !== 'Pending');

            if (hasProcessedOrder) {
                // Agar order accept ho chuka hai, toh iske bache hue saare 'Pending' orders ko delete list mein daal do
                orders.forEach(o => {
                    if (o.orderStatus === 'Pending') {
                        idsToDelete.push(o._id);
                    }
                });
            } else {
                // Agar koi accept nahi hua hai (sirf pending pade hain)
                let pendingCount = 0;
                orders.forEach(o => {
                    if (o.orderStatus === 'Pending') {
                        pendingCount++;
                        // Pehla (sabse latest) pending order chhod do, baki sabko delete list mein daal do
                        if (pendingCount > 1) {
                            idsToDelete.push(o._id);
                        }
                    }
                });
            }
        }

        // Step 3: Jo bhi duplicate orders mile hain, unhe ek sath delete kar do
        if (idsToDelete.length > 0) {
            console.log(`🗑️ Deleting ${idsToDelete.length} duplicate pending orders...`);
            const result = await Order.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`🎉 Success! Total ${result.deletedCount} duplicate orders successfully delete ho gaye.`);
        } else {
            console.log(`✅ Badhiya! Koi bhi duplicate pending order nahi mila. Database ekdum clean hai.`);
        }

    } catch (error) {
        console.error("❌ Orders delete karte samay error aaya:", error);
    } finally {
        mongoose.connection.close();
        console.log("🔌 Database connection closed.");
    }
}

cleanupDuplicatePendingOrders();