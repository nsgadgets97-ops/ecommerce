const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    targetLink: {
      type: String,
      default: '', // Kisi specific product ya category par redirect karne ke liye
    },
    position: {
      type: Number,
      default: 1, // Banner order (1, 2, 3...)
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Banner', bannerSchema);