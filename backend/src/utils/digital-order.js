import { createHash } from "node:crypto";
import {
  Listing,
  DigitalOrder,
  EbookAccess,
  BankTransaction,
} from "../models/index.js";
import { editionDetails } from "./catalog.js";
import { withOrderTransaction } from "./order-transaction.js";
import { makeTransferCode, buildQrUrl, getPlatformBank } from "./vietqr.js";

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
export async function createDigitalOrder(buyerId, ids) {
  const items = await digitalItems(ids, buyerId);
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const bank = total === 0 ? undefined : getPlatformBank();
  const cartKey = createHash("sha256")
    .update(JSON.stringify(ids))
    .digest("hex");
  await DigitalOrder.updateMany(
    { buyerId, status: "pending_payment", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } },
  );
  const existing = await DigitalOrder.findOne({
    buyerId,
    cartKey,
    status: "pending_payment",
  });
  if (existing)
    return total === 0
      ? await markPaid(existing._id, "FREE-" + existing.id, 0)
      : existing;
  for (let attempt = 0; attempt < 3; attempt++) {
    const transferCode = makeTransferCode();
    try {
      const order = await DigitalOrder.create({
        buyerId,
        items,
        total,
        cartKey,
        transferCode,
        bank,
        qrImageUrl: total === 0 ? "" : buildQrUrl(total, transferCode, bank),
        expiresAt: new Date(Date.now() + 30 * 60000),
      });
      return total === 0
        ? await markPaid(order._id, "FREE-" + order.id, 0)
        : order;
    } catch (error) {
      if (error.code !== 11000) throw error;
      const previous = await DigitalOrder.findOne({
        buyerId,
        cartKey,
        status:
          total === 0
            ? { $in: ["pending_payment", "paid"] }
            : "pending_payment",
      });
      if (previous)
        return total === 0 && previous.status !== "paid"
          ? await markPaid(previous._id, "FREE-" + previous.id, 0)
          : previous;
    }
  }
  digitalError(503, "Chưa tạo được mã thanh toán. Hãy thử lại.");
}
export async function expireDigitalOrders(filter) {
  await DigitalOrder.updateMany(
    { ...filter, status: "pending_payment", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } },
  );
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
    status: data.status,
    transferCode: data.transferCode,
    qrImageUrl: data.qrImageUrl || "",
    bank: data.bank || null,
    expiresAt: data.expiresAt,
    paidAt: data.paidAt || null,
    createdAt: data.createdAt,
  };
}
