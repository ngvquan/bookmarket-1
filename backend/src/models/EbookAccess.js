import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listingId: { type: String, ref: "Listing", required: true },
    editionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Edition",
      required: true,
    },
    digitalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DigitalOrder",
      required: true,
    },
    grantedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ buyerId: 1, listingId: 1 }, { unique: true });
export default mongoose.model("EbookAccess", schema);
