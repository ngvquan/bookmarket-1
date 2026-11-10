// Đơn mẹ lưu người nhận và tổng tiền tại lúc mua, không lấy lại giá hiện tại.
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const orderSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      default: randomUUID,
      match: /^[a-zA-Z0-9_-]{16,128}$/,
    },
    requestHash: { type: String, match: /^[a-f0-9]{64}$/ },
    receiverName: { type: String, required: true, trim: true, maxlength: 120 },
    receiverPhone: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9+ ]{9,15}$/,
      validate: (value) => /[0-9]/.test(value),
    },
    receiverAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    paymentMethod: {
      type: String,
      enum: ["cod"],
      default: "cod",
      required: true,
    },
    itemsTotal: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    shippingTotal: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
  },
  { timestamps: true, versionKey: false },
);

orderSchema.index({ buyerId: 1, createdAt: -1, _id: -1 });
orderSchema.index({ createdAt: -1, _id: -1 });
orderSchema.pre("validate", function () {
  if (this.total !== this.itemsTotal + this.shippingTotal)
    this.invalidate("total", "Tổng tiền phải bằng tiền sách cộng phí giao.");
});
// Cùng người mua + cùng mã đặt hàng chỉ được lưu một đơn, kể cả chạy nhiều API.
orderSchema.index(
  { buyerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
export default mongoose.model("Order", orderSchema);
