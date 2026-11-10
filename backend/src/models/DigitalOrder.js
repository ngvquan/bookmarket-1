import mongoose from "mongoose";
const money = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isSafeInteger,
};
const itemSchema = new mongoose.Schema(
  {
    listingId: { type: String, ref: "Listing", required: true },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    editionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Edition",
      required: true,
    },
    title: { type: String, required: true },
    author: { type: String, required: true },
    price: money,
  },
  { _id: false },
);
const schema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [itemSchema],
      required: true,
      validate: (items) =>
        items.length > 0 &&
        items.length <= 20 &&
        new Set(items.map((item) => item.listingId)).size === items.length,
    },
    total: money,
    status: {
      type: String,
      enum: ["pending_payment", "paid", "cancelled", "expired"],
      default: "pending_payment",
      required: true,
    },
    transferCode: {
      type: String,
      required: true,
      unique: true,
      match: /^BM[A-Z0-9]{10}$/,
    },
    qrImageUrl: { type: String, default: "" },
    bank: { id: String, name: String, accountNo: String, accountName: String },
    expiresAt: { type: Date, required: true },
    bankTransactionId: {
      type: String,
      unique: true,
      sparse: true,
      maxlength: 120,
    },
    paidAmount: { type: Number, min: 0, validate: Number.isSafeInteger },
    paidAt: Date,
    cartKey: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ buyerId: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, createdAt: -1, _id: -1 });
// Một giỏ ebook của một người chỉ có một đơn đang chờ, kể cả bấm đồng thời.
schema.index(
  { buyerId: 1, cartKey: 1 },
  { unique: true, partialFilterExpression: { status: "pending_payment" } },
);
schema.pre("validate", function () {
  if (this.total !== this.items.reduce((sum, item) => sum + item.price, 0))
    this.invalidate("total", "Tổng tiền ebook không khớp.");
  const validPaidAmount =
    Number.isSafeInteger(this.paidAmount) &&
    (this.total === 0 ? this.paidAmount === 0 : this.paidAmount >= this.total);
  if (
    this.status === "paid" &&
    (!this.bankTransactionId || !this.paidAt || !validPaidAmount)
  )
    this.invalidate("paidAmount", "Thiếu thông tin thanh toán.");
});
export default mongoose.model("DigitalOrder", schema);
