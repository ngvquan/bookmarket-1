// Tài khoản khách hàng/người bán; admin nằm ở collection admins riêng.
import mongoose from "mongoose";
const addressSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 50 },
    receiverName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9+ ]{9,15}$/,
      validate: (value) => /[0-9]/.test(value),
    },
    address: { type: String, required: true, trim: true, maxlength: 1000 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    addresses: {
      type: [addressSchema],
      default: [],
      validate: {
        validator: (addresses) => addresses.length <= 3,
        message: "Mỗi tài khoản có tối đa 3 địa chỉ.",
      },
    },
    favorites: {
      type: [{ type: String, ref: "Listing" }],
      default: [],
      validate: {
        validator: (favorites) =>
          favorites.length <= 500 &&
          new Set(favorites).size === favorites.length,
        message: "Danh sách yêu thích không hợp lệ.",
      },
    },
  },
  {
    timestamps: true,
  },
);
export default mongoose.model("User", userSchema);
