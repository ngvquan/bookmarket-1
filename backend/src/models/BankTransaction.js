import mongoose from "mongoose";

// Chỉ lưu dữ liệu đối soát cần thiết; không lưu header hoặc secret webhook.
const schema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    reason: {
      type: String,
      required: true,
      enum: [
        "no_code",
        "no_order",
        "not_enough",
        "wrong_account",
        "order_cancelled",
        "outgoing",
      ],
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DigitalOrder",
      default: null,
    },
    resolved: { type: Boolean, default: false, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

schema.index({ resolved: 1, createdAt: -1, _id: -1 });
schema.index({ orderId: 1 });
export default mongoose.model("BankTransaction", schema);
