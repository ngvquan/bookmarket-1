import { createHash } from "node:crypto";
import {
  Listing,
  DigitalOrder,
  EbookAccess,
  BankTransaction,
  Voucher,
} from "../models/index.js";
import { editionDetails } from "./catalog.js";
import { withOrderTransaction } from "./order-transaction.js";
import { makeTransferCode, buildQrUrl, getPlatformBank } from "./vietqr.js";
import { claimVoucher, eligibleVoucher, releaseDigitalVoucher } from "./voucher.js";

export function digitalError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function readListingIds(body) {
  const ids = body?.listingIds;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 20 ||
    ids.some((id) => typeof id !== "string" || !id.trim() || id.length > 100)
  )
    digitalError(400, "Hãy chọn từ 1 đến 20 ebook.");
  const cleaned = ids.map((id) => id.trim()).sort();
  if (new Set(cleaned).size !== cleaned.length)
    digitalError(400, "Ebook bị trùng trong giỏ.");
  return cleaned;
}
export async function digitalItems(ids, buyerId) {
  const items = [];
  for (const id of ids) {
    const listing = await Listing.findById(id);
    if (!listing || listing.type !== "digital" || listing.status !== "approved")
      digitalError(400, "Ebook không còn bán hoặc loại tin không hợp lệ.");
    if (String(listing.sellerId) === String(buyerId))
      digitalError(403, "Không được mua ebook của chính mình.");
    if (await EbookAccess.exists({ buyerId, listingId: id }))
      digitalError(409, "Ebook đã có trong thư viện của bạn.");
    const metadata = await editionDetails(listing.editionId);
    items.push({
      listingId: id,
      sellerId: listing.sellerId,
      editionId: listing.editionId,
      title: metadata.title,
      author: metadata.author,
      price: listing.price,
    });
  }
  return items;
}
export async function createDigitalOrder(buyerId, ids, voucherId = null) {
  const items = await digitalItems(ids, buyerId);
  const cartKey = createHash("sha256")
    .update(JSON.stringify(voucherId ? { ids, voucherId } : ids))
    .digest("hex");
  await expireDigitalOrders({ buyerId });
  const existing = await DigitalOrder.findOne({
    buyerId,
    cartKey,
    status: "pending_payment",
  });
  if (existing)
    return existing.total === 0
      ? await markPaid(existing._id, "FREE-" + existing.id, 0)
      : existing;
  const sellerTotals = new Map();
  for (const item of items) {
    const sellerId = String(item.sellerId);
    sellerTotals.set(sellerId, (sellerTotals.get(sellerId) || 0) + item.price);
  }
  if (voucherId) await eligibleVoucher(voucherId, buyerId, sellerTotals);
  for (let attempt = 0; attempt < 3; attempt++) {
    const transferCode = makeTransferCode();
    try {
      const order = await withOrderTransaction(async (session) => {
        const orderId = new DigitalOrder()._id;
        const applied = voucherId
          ? await claimVoucher(voucherId, buyerId, sellerTotals, orderId, "digital", session)
          : null;
        const total = items.reduce((sum, item) => sum + item.price, 0) - (applied?.discount || 0);
        const bank = total === 0 ? undefined : getPlatformBank();
        const created = new DigitalOrder({
          _id: orderId, buyerId, items, total, cartKey, transferCode, bank,
          voucherId: voucherId || undefined,
          voucherCode: applied?.code || "",
          discountTotal: applied?.discount || 0,
          qrImageUrl: total === 0 ? "" : buildQrUrl(total, transferCode, bank),
          expiresAt: new Date(Date.now() + 30 * 60000),
        });
        await created.save({ session });
        return created;
      });
      return order.total === 0
        ? await markPaid(order._id, "FREE-" + order.id, 0)
        : order;
    } catch (error) {
      const previous = await DigitalOrder.findOne({
        buyerId,
        cartKey,
        status: { $in: ["pending_payment", "paid"] },
      });
      if (previous)
        return previous.total === 0 && previous.status !== "paid"
          ? await markPaid(previous._id, "FREE-" + previous.id, 0)
          : previous;
      if (error.code !== 11000) throw error;
    }
  }
  digitalError(503, "Chưa tạo được mã thanh toán. Hãy thử lại.");
}
export async function expireDigitalOrders(filter) {
  const expired = await DigitalOrder.find({
    ...filter, status: "pending_payment", expiresAt: { $lte: new Date() },
  }).select("_id").lean();
  for (const item of expired) {
    await withOrderTransaction(async (session) => {
      const changed = await DigitalOrder.updateOne(
        { _id: item._id, status: "pending_payment", expiresAt: { $lte: new Date() } },
        { $set: { status: "expired" } }, { session },
      );
      if (changed.modifiedCount) await releaseDigitalVoucher(item._id, session);
    });
  }
}
export async function markPaid(orderId, bankTransactionId, paidAmount) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await withOrderTransaction(async (session) => {
        if (await DigitalOrder.exists({ bankTransactionId }).session(session))
          return null;
        const current = await DigitalOrder.findById(orderId).session(session);
        if (
          !current ||
          !["pending_payment", "expired"].includes(current.status)
        )
          return null;
        if (paidAmount < current.total)
          digitalError(400, "Số tiền thanh toán chưa đủ.");
        // Chỉ webhook đã xác thực hoặc admin được gọi hàm này; không tin trạng thái từ client.
        const order = await DigitalOrder.findOneAndUpdate(
          { _id: orderId, status: current.status },
          {
            $set: {
              status: "paid",
              paidAt: new Date(),
              bankTransactionId,
              paidAmount,
            },
          },
          { new: true, session, runValidators: true },
        );
        if (!order) return null;
        if (order.voucherId) {
          const redeemed = await Voucher.findOneAndUpdate(
            { _id: order.voucherId, buyerId: order.buyerId,
              $or: [
                { digitalOrderId: order._id, status: "reserved" },
                { status: "active" },
              ],
            },
            { $set: { status: "used", usedAt: new Date(), digitalOrderId: order._id } },
            { session },
          );
          if (!redeemed)
            digitalError(409, "Voucher của đơn ebook đã được dùng ở đơn khác. Cần đối soát khoản chuyển tiền này.");
        }
        // Upsert giữ quyền cũ nếu hai đơn khác nhau cùng chứa một ebook; vẫn ghi đủ khoản tiền đã nhận.
        for (const item of order.items)
          await EbookAccess.updateOne(
            { buyerId: order.buyerId, listingId: item.listingId },
            {
              $setOnInsert: {
                buyerId: order.buyerId,
                listingId: item.listingId,
                editionId: item.editionId,
                digitalOrderId: order._id,
                grantedAt: new Date(),
              },
            },
            { upsert: true, session, runValidators: true },
          );
        await BankTransaction.updateOne(
          { transactionId: bankTransactionId },
          { $set: { resolved: true, orderId: order._id } },
          { session },
        );
        return order;
      });
    } catch (error) {
      // Hai giỏ chồng ebook có thể cùng cấp quyền; thử lại với snapshot mới, không bỏ mất khoản thu.
      if (error.code !== 11000 || !error.keyPattern?.listingId || attempt === 2)
        throw error;
    }
  }
}
export function validPaymentInput(id, amount) {
  return (
    typeof id === "string" &&
    !!id.trim() &&
    id.length <= 120 &&
    Number.isSafeInteger(amount) &&
    amount > 0
  );
}

export function digitalOrderResponse(order) {
  const data = order?.toObject ? order.toObject() : order;
  return {
    _id: String(data._id),
    items: (data.items || []).map((item) => ({
      listingId: item.listingId,
      title: item.title,
      author: item.author,
      price: item.price,
    })),
    total: data.total,
    discountTotal: data.discountTotal || 0,
    voucherCode: data.voucherCode || "",
    status: data.status,
    transferCode: data.transferCode,
    qrImageUrl: data.qrImageUrl || "",
    bank: data.bank || null,
    expiresAt: data.expiresAt,
    paidAt: data.paidAt || null,
    createdAt: data.createdAt,
  };
}
