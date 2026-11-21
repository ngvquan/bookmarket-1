import { Voucher } from "../models/index.js";

export function voucherError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function voucherDiscount(voucher, subtotal) {
  if (!Number.isSafeInteger(subtotal) || subtotal <= 0)
    voucherError(400, "Giỏ hàng chưa có sách của người bán phát voucher.");
  if (subtotal < voucher.minSubtotal)
    voucherError(400, `Cần mua ít nhất ${voucher.minSubtotal}đ từ người bán này để dùng voucher.`);
  const raw = voucher.kind === "fixed"
    ? voucher.value
    : Math.floor(subtotal * voucher.value / 100);
  return Math.min(subtotal, voucher.maxDiscount || raw, raw);
}

export async function eligibleVoucher(id, buyerId, sellerTotals, session = null) {
  const voucher = await Voucher.findOne({ _id: id, buyerId }).session(session);
  if (!voucher || voucher.status !== "active" || voucher.expiresAt <= new Date())
    voucherError(409, "Voucher không còn hiệu lực hoặc đã được sử dụng.");
  const subtotal = sellerTotals.get(String(voucher.sellerId)) || 0;
  return { voucher, discount: voucherDiscount(voucher, subtotal) };
}

export async function claimVoucher(id, buyerId, sellerTotals, orderId, channel, session) {
  const { voucher, discount } = await eligibleVoucher(id, buyerId, sellerTotals, session);
  const update = channel === "digital"
    ? { status: "reserved", digitalOrderId: orderId }
    : { status: "used", orderId, usedAt: new Date() };
  const claimed = await Voucher.findOneAndUpdate(
    { _id: voucher._id, buyerId, status: "active", expiresAt: { $gt: new Date() } },
    { $set: update },
    { session, new: true },
  );
  if (!claimed) voucherError(409, "Voucher vừa được dùng ở đơn khác. Hãy chọn lại.");
  return { sellerId: String(voucher.sellerId), code: voucher.code, discount };
}

export async function releaseDigitalVoucher(orderId, session) {
  await Voucher.updateOne(
    { digitalOrderId: orderId, status: "reserved" },
    { $set: { status: "active" }, $unset: { digitalOrderId: "" } },
    { session },
  );
}
