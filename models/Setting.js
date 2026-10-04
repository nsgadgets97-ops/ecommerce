const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    upiId: {
      type: String,
      default: '',
    },
    upiQrCodeUrl: {
      type: String,
      default: '',
    },
    defaultAdvanceAmount: {
      type: Number,
      default: 300,
    },
    whatsappNumber: {
      type: String,
      default: '',
    },
    announcement1: { type: String, default: 'COD Available' },
    announcement2: { type: String, default: 'Free AirPods on orders above ₹1000' },
    announcement3: { type: String, default: '' },
    // Audit Field
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);