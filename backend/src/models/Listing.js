// Một offer có editionId riêng, giữ ID tin cũ để không mất giỏ/yêu thích.
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
const listingSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    editionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Edition",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
    },
    type: {
      type: String,
      enum: ["new", "used", "digital"],
      required: true,
    },
    price: {
      type: Number,
      min: 0,
      max: 100000000,
      required: true,
      validate: Number.isSafeInteger,
    },
    stock: {
      type: Number,
      min: 0,
      max: 100000,
      required: function () {
        return ["new", "used"].includes(this.type);
      },
      validate: {
        validator: function (value) {
          return (
            value === undefined ||
            (Number.isSafeInteger(value) &&
              (this.type !== "used" || value <= 1))
          );
        },
        message: "Kho phải là số nguyên; mỗi tin sách cũ tối đa một cuốn.",
      },
    },
    condition: {
      type: String,
      enum: ["Như mới", "Còn tốt", "Đã cũ"],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "hidden", "sold"],
      default: "approved",
      required: true,
    },
    hiddenBy: {
      type: String,
      enum: ["seller", "admin"],
    },
    location: {
      type: String,
      default: "Việt Nam",
      maxlength: 500,
    },
    images: {
      type: [
        {
          _id: false,
          id: { type: String, required: true, match: /^[0-9a-f-]{36}$/i },
          contentType: {
            type: String,
            enum: ["image/jpeg", "image/png", "image/webp"],
            required: true,
          },
        },
      ],
      default: [],
      validate: {
        validator: (images) => images.length <= 5,
        message: "Mỗi tin đăng có tối đa 5 ảnh.",
      },
    },
    ebookFileId: {
      type: String,
      match: /^[0-9a-f-]{36}$/i,
      default: null,
    },
    ebookPageCount: {
      type: Number,
      min: 0,
      max: 100000,
      default: 0,
      validate: Number.isSafeInteger,
    },
  },
  {
    timestamps: true,
  },
);
// Index ghép theo đúng bộ lọc và cách sắp xếp trong routes/listings.js.
listingSchema.index({ status: 1, type: 1, createdAt: -1, _id: 1 });
listingSchema.index({ status: 1, type: 1, price: 1, _id: 1 });
listingSchema.index({ sellerId: 1, createdAt: -1, _id: 1 });
listingSchema.index({ editionId: 1, status: 1, type: 1, price: 1 });
listingSchema.index({ shopId: 1, status: 1 });
export default mongoose.model("Listing", listingSchema);
