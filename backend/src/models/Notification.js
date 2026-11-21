import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    subOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubOrder",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipping",
        "delivered",
        "completed",
        "cancelled",
        "returned",
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ userId: 1, readAt: 1, createdAt: -1, _id: -1 });
schema.index({ userId: 1, subOrderId: 1, status: 1 }, { unique: true });
export default mongoose.model("Notification", schema);
