const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
      index: true,
    },
    shippingDetails: {      
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true }
    },
    products: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        title: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
      },
    ],
    paymentType: {
      type: String,
      enum: ['ADVANCE_COD', 'FULL_PAID'],
      default: 'ADVANCE_COD',
    },
    amountToPayOnline: {
      type: Number,
      required: true,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    orderStatus: {
      type: String,
      enum: ['Pending', 'Accepted', 'Packed', 'Dispatched', 'Delivered', 'Cancelled'],
      default: 'Pending',
    },
    trackingId: {
      type: String,
      default: '',
    },
    courierName: {
      type: String,
      default: '',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);