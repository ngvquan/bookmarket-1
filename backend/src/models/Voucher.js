import mongoose from "mongoose";

const money = { type: Number, min: 0, validate: Number.isSafeInteger };
const schema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["fixed", "percent"], required: true },
    value: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    minSubtotal: { ...money, required: true, default: 0 },
    maxDiscount: { ...money, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "reserved", "used", "revoked"],
      default: "active",
      required: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    digitalOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalOrder" },
    usedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
schema.index({ buyerId: 1, createdAt: -1 });
schema.index({ sellerId: 1, createdAt: -1 });
export default mongoose.model("Voucher", schema);
