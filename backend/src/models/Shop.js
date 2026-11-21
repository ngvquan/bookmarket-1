// Mỗi tài khoản có tối đa một shop; ownerId là ID tài khoản, không phải tên shop.
import mongoose from "mongoose";
import { hasCompleteShopDetails } from "../utils/shop.js";
const addressSchema = new mongoose.Schema(
  {
    province: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    ward: { type: String, required: true, trim: true, maxlength: 100 },
    detail: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 200,
    },
  },
  { _id: false },
);
const shopSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },
    // Không bắt buộc ở schema để giữ các shop đã có; API đăng ký mới kiểm tra đầy đủ.
    contactName: {
      type: String,
      trim: true,
      maxlength: 100,
      validate: (value) => !value || value.length >= 2,
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: 20,
      validate: (value) =>
        !value || /^(?:0[35789]\d{8}|\+84[35789]\d{8})$/.test(value),
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    },
    pickupAddress: { type: addressSchema, default: undefined },
    isRegistrationComplete: { type: Boolean, default: false },
    registrationCompletedAt: Date,
  },
  {
    timestamps: true,
  },
);
shopSchema.pre("validate", function () {
  // Shop cũ được giữ hồ sơ chưa đủ; không cho lưu cờ hoàn tất giả.
  if (
    this.isRegistrationComplete &&
    (!hasCompleteShopDetails(this) || !this.registrationCompletedAt)
  ) {
    this.invalidate(
      "isRegistrationComplete",
      "Shop hoàn tất phải có đủ liên hệ, địa chỉ và thời điểm đăng ký.",
    );
  }
});
export default mongoose.model("Shop", shopSchema);
