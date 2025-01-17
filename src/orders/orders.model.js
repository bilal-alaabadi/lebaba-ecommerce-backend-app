const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    orderId: String,
    firstName: { type: String, required: true }, // الاسم الأول
    lastName: { type: String, required: true }, // اسم العائلة
    products: [
      {
        productId: { type: String, required: true },
        quantity: { type: Number, required: true },
      },
    ],
    amount: Number,
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    shippingAddress: {
      country: { type: String, required: true },
      province: { type: String, required: true },
      wilayat: { type: String, required: true },
      streetAddress: { type: String, required: true },
    },
    orderNotes: String, // ملاحظات الطلب
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", OrderSchema);
module.exports = Order;