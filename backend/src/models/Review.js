// Mỗi người mua chỉ đánh giá một lần cho một tin sách, dựa trên đơn đã hoàn tất.
import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
    repliedAt: { type: Date, required: true },
    editedAt: Date,
  },
  { _id: false },
);

const reviewSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listingId: { type: String, ref: "Listing", required: true, maxlength: 100 },
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
    reply: { type: replySchema, default: undefined },
  },
  { timestamps: true, versionKey: false },
);

reviewSchema.index({ buyerId: 1, listingId: 1 }, { unique: true });
reviewSchema.index({ listingId: 1, createdAt: -1, _id: -1 });
reviewSchema.index({ sellerId: 1, createdAt: -1, _id: -1 });
export default mongoose.model("Review", reviewSchema);
