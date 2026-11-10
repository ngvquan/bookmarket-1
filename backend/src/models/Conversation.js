import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
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
    book: {
      listingId: { type: String, ref: "Listing" },
      title: String,
      author: String,
    },
    nextSequence: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    lastSequence: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    lastText: { type: String, default: "", maxlength: 2000 },
    lastMessageAt: { type: Date, default: Date.now },
    buyerReadSequence: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    sellerReadSequence: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
  },
  { timestamps: true },
);
conversationSchema.index({ buyerId: 1, sellerId: 1 }, { unique: true });
conversationSchema.index({ buyerId: 1, lastMessageAt: -1, _id: -1 });
conversationSchema.index({ sellerId: 1, lastMessageAt: -1, _id: -1 });
export default mongoose.model("Conversation", conversationSchema);
