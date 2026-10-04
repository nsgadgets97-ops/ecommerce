// createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

async function createInitialAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for admin creation');

    const adminUsername = 'admin';
    const rawPassword = 'adminPassword123';

    const existingAdmin = await Admin.findOne({ username: adminUsername });
    if (existingAdmin) {
      console.log('Admin user pehle se exist karta hai!');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    await Admin.create({
      username: adminUsername,
      password: hashedPassword,
      role: 'superadmin'
    });

    console.log(`Admin account created! Username: ${adminUsername} | Password: ${rawPassword}`);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

createInitialAdmin();