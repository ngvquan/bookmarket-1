import { Router } from "express";
import mongoose from "mongoose";
import { DigitalOrder, BankTransaction } from "../models/index.js";
import { requireLogin, requireUser, requireAdmin } from "../middleware/auth.js";
import {
  getPlatformBank,
  validWebhookSecret,
  readBankTransaction,
} from "../utils/vietqr.js";
import {
  readListingIds,
  createDigitalOrder,
  markPaid,
  expireDigitalOrders,
  validPaymentInput,
  digitalOrderResponse,
} from "../utils/digital-order.js";
export const digitalRoutes = Router(),
  bankWebhookRoutes = Router(),
  adminDigitalRoutes = Router(),
  adminBankRoutes = Router();

digitalRoutes.use(requireLogin, requireUser);
digitalRoutes.post("/", async (req, res) => {
  const order = await createDigitalOrder(req.user.id, readListingIds(req.body));
  const safeOrder = digitalOrderResponse(order);
  res
    .status(201)
    .json({
      order: safeOrder,
      qrImageUrl: safeOrder.qrImageUrl,
      transferCode: safeOrder.transferCode,
      total: safeOrder.total,
      bank: safeOrder.bank,
      expiresAt: safeOrder.expiresAt,
    });
});
digitalRoutes.get("/mine", async (req, res) => {
  await expireDigitalOrders({ buyerId: req.user.id });
  await listDigitalOrders(req, res, { buyerId: req.user.id });
});
digitalRoutes.get("/:id/status", async (req, res) => {
  const order = await ownedOrder(req, res);
  if (!order) return;
  await expireDigitalOrders({ _id: order._id });
  res.json({ status: (await DigitalOrder.findById(order._id)).status });
});
digitalRoutes.post("/:id/cancel", async (req, res) => {
  const order = await ownedOrder(req, res);
  if (!order) return;
  await expireDigitalOrders({ _id: order._id });
  const changed = await DigitalOrder.findOneAndUpdate(
    { _id: order._id, status: "pending_payment" },
    { $set: { status: "cancelled" } },
    { new: true },
  );
  if (!changed)
    return res.status(409).json({ message: "Đơn không còn chờ thanh toán." });
  res.json({ order: digitalOrderResponse(changed) });
});
async function ownedOrder(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "ID đơn không hợp lệ." });
    return null;
  }
  const order = await DigitalOrder.findById(req.params.id);
  if (!order) {
    res.status(404).json({ message: "Không tìm thấy đơn ebook." });
    return null;
  }
  if (String(order.buyerId) !== req.user.id) {
    res.status(403).json({ message: "Bạn không được xem đơn này." });
    return null;
  }
  return order;
}
async function listDigitalOrders(req, res, filter) {
  const page = Number(req.query.page || 1),
    limit = 10;
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    return res.status(400).json({ message: "Trang không hợp lệ." });
  if (req.query.status) {
    if (
      !["pending_payment", "paid", "cancelled", "expired"].includes(
        req.query.status,
      )
    )
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    filter.status = req.query.status;
  }
  const tabs = {
    all: [],
    pending: ["pending_payment"],
    "to-ship": [],
    "to-receive": ["paid"],
    cancelled: ["cancelled", "expired"],
  };
  if (req.query.tab !== undefined) {
    if (
      typeof req.query.tab !== "string" ||
      !Object.hasOwn(tabs, req.query.tab)
    )
      return res.status(400).json({ message: "Mục đơn không hợp lệ." });
    if (req.query.tab === "to-ship") filter.status = { $in: [] };
    else if (tabs[req.query.tab].length)
      filter.status = { $in: tabs[req.query.tab] };
  }
  const [items, total] = await Promise.all([
    DigitalOrder.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DigitalOrder.countDocuments(filter),
  ]);
  const counts = {};
  if (filter.buyerId) {
    const groups = await DigitalOrder.aggregate([
      {
        $match: {
          buyerId: new mongoose.Types.ObjectId(String(filter.buyerId)),
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    for (const group of groups) counts[group._id] = group.count;
    counts.all = groups.reduce((sum, group) => sum + group.count, 0);
  }
  res.json({
    items: filter.buyerId ? items.map(digitalOrderResponse) : items,
    total,
    counts,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

bankWebhookRoutes.post("/bank-transaction", async (req, res) => {
  if (
    !process.env.PAYMENT_WEBHOOK_SECRET ||
    process.env.PAYMENT_WEBHOOK_SECRET.length < 32
  )
    return res.status(503).json({ message: "Webhook chưa được cấu hình." });
  if (!validWebhookSecret(req.headers.authorization))
    return res.status(401).json({ message: "Sai secret." });
  const transaction = readBankTransaction(req.body || {});
  const { amount, transactionId, code } = transaction;
  if (!validPaymentInput(transactionId, amount))
    return res.status(400).json({ message: "Dữ liệu giao dịch không hợp lệ." });
  if (await DigitalOrder.exists({ bankTransactionId: transactionId }))
    return res.json({ success: true, duplicate: true });
  const order = code
    ? await DigitalOrder.findOne({ transferCode: code })
    : null;
  const platformAccount = String(getPlatformBank().accountNo);
  const correctAccount =
    transaction.accountNo !== undefined &&
    transaction.accountNo !== null &&
    String(transaction.accountNo) === platformAccount;
  const reason = unmatchedReason(transaction, order, correctAccount);
  if (reason) {
    await saveUnmatchedTransaction(transaction, order, reason);
    return res.json({ success: true, matched: false });
  }
  try {
    const paid = await markPaid(order._id, transactionId, amount);
    // Dong giao dich treo cu neu SePay gui lai sau khi don da duoc dong bo.
    await BankTransaction.updateOne(
      { transactionId },
      { $set: { resolved: true, orderId: order._id } },
    );
    // SePay cần success:true để công nhận đã nhận webhook; matched dùng cho đối soát.
    res.json({ success: true, matched: true, duplicate: !paid });
  } catch (error) {
    if (error.code === 11000)
      return res.json({ success: true, duplicate: true });
    throw error;
  }
});
function unmatchedReason(transaction, order, correctAccount) {
  if (!transaction.incoming) return "outgoing";
  if (!transaction.code) return "no_code";
  if (!order) return "no_order";
  if (transaction.amount < order.total) return "not_enough";
  if (!correctAccount) return "wrong_account";
  if (order.status === "cancelled") return "order_cancelled";
  return null;
}
async function saveUnmatchedTransaction(transaction, order, reason) {
  try {
    await BankTransaction.create({
      transactionId: transaction.transactionId,
      amount: transaction.amount,
      description: transaction.description,
      reason,
      orderId: order?._id || null,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}
adminDigitalRoutes.use(requireLogin, requireAdmin);
adminDigitalRoutes.get("/", async (req, res) => {
  await expireDigitalOrders({});
  await listDigitalOrders(req, res, {});
});
adminBankRoutes.use(requireLogin, requireAdmin);
adminBankRoutes.get("/", async (req, res) => {
  const page = Number(req.query.page || 1),
    limit = 10;
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    ![undefined, "true", "false"].includes(req.query.resolved)
  )
    return res.status(400).json({ message: "Bộ lọc giao dịch không hợp lệ." });
  const filter = { resolved: req.query.resolved === "true" };
  const [items, total] = await Promise.all([
    BankTransaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BankTransaction.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});
adminDigitalRoutes.patch("/:id/mark-paid", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "ID đơn không hợp lệ." });
  const { bankTransactionId, paidAmount } = req.body || {};
  if (!validPaymentInput(bankTransactionId, paidAmount))
    return res
      .status(400)
      .json({ message: "Cần mã giao dịch và số tiền đã nhận hợp lệ." });
  if (!(await DigitalOrder.exists({ _id: req.params.id })))
    return res.status(404).json({ message: "Không tìm thấy đơn ebook." });
  try {
    const order = await markPaid(
      req.params.id,
      bankTransactionId.trim(),
      paidAmount,
    );
    if (!order)
      return res
        .status(409)
        .json({ message: "Đơn hoặc giao dịch đã được xử lý." });
    res.json({ order });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ message: "Mã giao dịch đã được dùng." });
    throw error;
  }
});
