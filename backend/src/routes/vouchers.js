import { Router } from "express";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { DigitalOrder, Listing, Shop, SubOrder, User, Voucher } from "../models/index.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { eligibleVoucher, voucherError } from "../utils/voucher.js";
import { expireDigitalOrders } from "../utils/digital-order.js";

const router = Router();
router.use(requireLogin, requireUser);

function voucherDetails(body) {
  const { kind, value, minSubtotal = 0, maxDiscount = 0, expiresAt } = body || {};
  if (!["fixed", "percent"].includes(kind) || !Number.isSafeInteger(value) || value < 1 ||
      (kind === "percent" && value > 100) || (kind === "fixed" && value > 1000000) ||
      !Number.isSafeInteger(minSubtotal) || minSubtotal < 0 || minSubtotal > 100000000 ||
      !Number.isSafeInteger(maxDiscount) || maxDiscount < 0 || maxDiscount > 1000000 ||
      (kind === "fixed" && maxDiscount !== 0))
    voucherError(400, "Giá trị voucher không hợp lệ.");
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime()) || expiry <= new Date() || expiry.getTime() > Date.now() + 366 * 86400000)
    voucherError(400, "Hạn dùng phải ở tương lai và không quá một năm.");
  return { kind, value, minSubtotal, maxDiscount, expiresAt: expiry };
}

async function requireVoucherSeller(sellerId) {
  if (!(await Shop.exists({ ownerId: sellerId })) && !(await Listing.exists({ sellerId, status: "approved" })))
    voucherError(403, "Bạn cần có gian hàng hoặc sách đang bán để tạo voucher.");
}

async function priorBuyerIds(sellerId) {
  const [paper, digital] = await Promise.all([
    SubOrder.distinct("buyerId", { sellerId, status: { $nin: ["cancelled", "returned"] } }),
    DigitalOrder.distinct("buyerId", { "items.sellerId": sellerId, status: "paid" }),
  ]);
  return [...new Set([...paper, ...digital].map(String))];
}

router.get("/mine", async (req, res) => {
  await expireDigitalOrders({ buyerId: req.user.id });
  const items = await Voucher.find({ buyerId: req.user.id })
    .sort({ createdAt: -1 }).limit(100)
    .populate("sellerId", "name").lean();
  res.json({ items });
});

router.get("/seller", async (req, res) => {
  const items = await Voucher.find({ sellerId: req.user.id })
    .sort({ createdAt: -1 }).limit(100)
    .populate("buyerId", "name email").lean();
  res.json({ items });
});

router.get("/seller/buyers", async (req, res) => {
  const ids = await priorBuyerIds(req.user.id);
  const buyers = await User.find({ _id: { $in: ids } })
    .select("name email").sort({ name: 1, _id: 1 }).limit(200).lean();
  res.json({ items: buyers.map((buyer) => ({
    id: String(buyer._id), name: buyer.name, email: buyer.email,
  })) });
});

router.post("/seller", async (req, res) => {
  const { buyerEmail, buyerId } = req.body || {};
  if (buyerId ? !mongoose.isValidObjectId(buyerId) :
      typeof buyerEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim()) || buyerEmail.length > 254)
    voucherError(400, "Chọn người mua từ đơn hàng hoặc nhập email hợp lệ.");
  const details = voucherDetails(req.body);
  const sellerId = req.user.id;
  await requireVoucherSeller(sellerId);
  if (buyerId && !(await SubOrder.exists({ sellerId, buyerId, status: { $nin: ["cancelled", "returned"] } })) &&
      !(await DigitalOrder.exists({ "items.sellerId": sellerId, buyerId, status: "paid" })))
    voucherError(403, "Chỉ có thể gửi trực tiếp cho người mua đã đặt sách của bạn.");
  const buyer = buyerId
    ? await User.findById(buyerId).select("_id")
    : await User.findOne({ email: buyerEmail.trim().toLowerCase() }).select("_id");
  if (!buyer) voucherError(404, "Không tìm thấy tài khoản người mua với email này.");
  if (String(buyer._id) === sellerId) voucherError(400, "Không thể gửi voucher cho chính mình.");
  let voucher;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      voucher = await Voucher.create({
        sellerId, buyerId: buyer._id,
        code: "BMG" + randomBytes(5).toString("hex").toUpperCase(),
        ...details,
      });
      break;
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    }
  }
  res.status(201).json({ voucher });
});

router.post("/seller/bulk", async (req, res) => {
  const { buyerEmails, buyerIds } = req.body || {};
  const usingIds = Array.isArray(buyerIds);
  if (usingIds === Array.isArray(buyerEmails))
    voucherError(400, "Chọn người mua hoặc nhập danh sách email.");
  let recipients;
  if (usingIds) {
    if (buyerIds.length < 2 || buyerIds.length > 50 ||
        buyerIds.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id)))
      voucherError(400, "Chọn từ 2 đến 50 người mua hợp lệ.");
    recipients = buyerIds.map(String);
  } else {
    if (buyerEmails.length < 2 || buyerEmails.length > 50 ||
        buyerEmails.some((email) => typeof email !== "string" || email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))
      voucherError(400, "Nhập từ 2 đến 50 email người mua hợp lệ.");
    recipients = buyerEmails.map((email) => email.trim().toLowerCase());
  }
  if (new Set(recipients).size !== recipients.length)
    voucherError(400, usingIds ? "Danh sách người mua bị trùng." : "Danh sách email có người mua bị trùng.");
  const details = voucherDetails(req.body);
  const sellerId = req.user.id;
  await requireVoucherSeller(sellerId);
  if (usingIds) {
    const allowed = new Set(await priorBuyerIds(sellerId));
    if (recipients.some((id) => !allowed.has(id)))
      voucherError(403, "Chỉ chọn người mua từng đặt hàng ở shop của bạn.");
  }
  const buyers = await User.find(usingIds
    ? { _id: { $in: recipients } }
    : { email: { $in: recipients } }).select("_id email").lean();
  const byRecipient = new Map(buyers.map((buyer) => [
    usingIds ? String(buyer._id) : buyer.email.toLowerCase(), buyer,
  ]));
  const missing = recipients.filter((entry) => !byRecipient.has(entry));
  if (missing.length)
    voucherError(404, usingIds ? "Một số người mua không còn tài khoản." :
      `Chưa có tài khoản BookMarket: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}.`);
  if (buyers.some((buyer) => String(buyer._id) === sellerId))
    voucherError(400, "Không thể gửi voucher cho chính mình.");
  const vouchers = recipients.map((entry) => ({
    sellerId, buyerId: byRecipient.get(entry)._id,
    code: "BMG" + randomBytes(8).toString("hex").toUpperCase(),
    ...details,
  }));
  await mongoose.connection.transaction(async (session) => {
    await Voucher.insertMany(vouchers, { session });
  });
  res.status(201).json({ created: vouchers.length });
});

router.patch("/seller/:id/revoke", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) voucherError(400, "ID voucher không hợp lệ.");
  const voucher = await Voucher.findOneAndUpdate(
    { _id: req.params.id, sellerId: req.user.id, status: "active" },
    { $set: { status: "revoked" } }, { new: true },
  );
  if (!voucher) voucherError(409, "Voucher không thể thu hồi hoặc không thuộc bạn.");
  res.json({ voucher });
});

router.post("/quote", async (req, res) => {
  const { voucherId, items, channel } = req.body || {};
  if (!mongoose.isValidObjectId(voucherId) || !["physical", "digital"].includes(channel) ||
      !Array.isArray(items) || !items.length || items.length > 20 ||
      items.some((item) => !item || typeof item.listingId !== "string" ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99))
    voucherError(400, "Thông tin áp dụng voucher không hợp lệ.");
  const ids = items.map((item) => item.listingId);
  if (new Set(ids).size !== ids.length) voucherError(400, "Sách trong giỏ bị trùng.");
  const listings = await Listing.find({ _id: { $in: ids }, status: "approved" }).lean();
  if (listings.length !== ids.length || listings.some((listing) =>
    channel === "digital" ? listing.type !== "digital" : listing.type === "digital"))
    voucherError(409, "Một số sách không còn được bán.");
  const sellerTotals = new Map();
  for (const item of items) {
    const listing = listings.find((entry) => entry._id === item.listingId);
    const sellerId = String(listing.sellerId);
    sellerTotals.set(sellerId, (sellerTotals.get(sellerId) || 0) + listing.price * item.quantity);
  }
  const { voucher, discount } = await eligibleVoucher(voucherId, req.user.id, sellerTotals);
  res.json({ discount, code: voucher.code, sellerId: voucher.sellerId });
});

export default router;
