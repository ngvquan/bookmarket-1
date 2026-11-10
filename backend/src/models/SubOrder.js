// Mỗi người bán có một đơn con; snapshot giữ lịch sử khi tin hoặc shop thay đổi.
import mongoose from "mongoose";

const statuses = [
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "completed",
  "cancelled",
  "returned",
];
const itemSchema = new mongoose.Schema(
  {
    listingId: { type: String, ref: "Listing", required: true },
    type: { type: String, enum: ["new", "used"], required: true },
    title: { type: String, required: true, maxlength: 180 },
    author: { type: String, required: true, maxlength: 180 },
    isbn: { type: String, default: "", maxlength: 13 },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 100000000,
      validate: Number.isSafeInteger,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
      validate: function (value) {
        return Number.isInteger(value) && (this.type !== "used" || value === 1);
      },
    },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, required: true },
    status: { type: String, enum: statuses, required: true },
    note: { type: String, default: "", maxlength: 1000 },
  },
  { _id: false },
);

const shipmentSchema = new mongoose.Schema(
  {
    service: { type: String, enum: ["standard", "fast"], required: true },
    fee: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    trackingCode: { type: String, default: "", maxlength: 100 },
    events: { type: [eventSchema], default: [] },
  },
  { _id: false },
);

const subOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
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
    shopName: { type: String, required: true, maxlength: 120 },
    items: {
      type: [itemSchema],
      required: true,
      validate: (items) => items.length > 0 && items.length <= 20,
    },
    itemsTotal: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    shippingFee: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    status: {
      type: String,
      enum: statuses,
      default: "pending",
      required: true,
    },
    cancelReason: { type: String, default: "", maxlength: 1000 },
    shipment: { type: shipmentSchema, required: true },
  },
  { timestamps: true, versionKey: false },
);

subOrderSchema.index({ orderId: 1, sellerId: 1 }, { unique: true });
subOrderSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
subOrderSchema.index({ sellerId: 1, createdAt: -1, _id: -1 });
subOrderSchema.index({ buyerId: 1, createdAt: -1, _id: -1 });
subOrderSchema.index({ status: 1, createdAt: -1, _id: -1 });
subOrderSchema.index({ "items.listingId": 1, status: 1 });
subOrderSchema.pre("validate", function () {
  const sum = this.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  if (sum !== this.itemsTotal)
    this.invalidate("itemsTotal", "Tiền sách phải bằng tổng các dòng sách.");
  if (this.shipment && this.shipment.fee !== this.shippingFee)
    this.invalidate("shippingFee", "Phí giao phải khớp thông tin vận chuyển.");
});
export default mongoose.model("SubOrder", subOrderSchema);
