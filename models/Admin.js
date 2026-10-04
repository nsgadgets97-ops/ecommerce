const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true, // Hashed password (bcryptjs se save karna hoga controller mein)
    },
    role: {
      type: String,
      default: 'SUPER_ADMIN',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);