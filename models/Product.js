const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // Category reference (Picklist ke liye)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },
    mrp: {
      type: Number,
      required: true,
    },
    advancePayment: {
      type: Number,
      default: null,
    },
    // Array of Strings with Validation for max 3 images
    images: {
      type: [{ type: String, required: true }],
      validate: [arrayLimit, 'Aap maximum 3 images hi upload kar sakte hain'],
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    thumbnailUrl: {
      type: String,
      default: ''
    },
    youtubeLink: {
      type: String,
      default: ''
    },
    variants: [
    {
      label: { type: String }, 
      hasDifferentPrice: { type: Boolean, default: false }, // Checkbox track karne ke liye
      options: [
        {
          name: { type: String }, // Option ka naam (e.g., Red, XL)
          price: { type: Number } // Alag price (sirf tab jab hasDifferentPrice true ho)
        }
      ]
    }
  ],
    // Audit Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

// Helper function to limit array length
function arrayLimit(val) {
  return val.length > 0 && val.length <= 3;
}

module.exports = mongoose.model('Product', productSchema);