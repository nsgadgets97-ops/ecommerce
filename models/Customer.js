const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  birthYear: { type: String, required: true }, // Added for verification
  failedAttempts: { type: Number, default: 0 }, // For 3-strike logic
  lockUntil: { type: Date }, // 4-hour lock timestamp
  defaultAddress: {
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);