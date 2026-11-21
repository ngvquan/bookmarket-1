// Người mua/người bán thao tác đúng đơn con; hủy dùng CAS trước khi hoàn kho.
import { Router } from "express";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import SubOrder from "../models/SubOrder.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { listSubOrders } from "../utils/order-query.js";
import { changeStatus } from "../utils/order-status.js";

const router = Router();
router.use(requireLogin, requireUser);
router.get("/shop", async (req, res) =>
  res.json(await listSubOrders(req.query, req.user.id)),
);

router.param("id", async (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "ID đơn con không hợp lệ." });
  req.subOrder = await SubOrder.findById(id);
  if (!req.subOrder)
    return res.status(404).json({ message: "Không tìm thấy đơn con." });
  next();
});

router.patch("/:id/cancel", async (req, res) => {
  const sub = req.subOrder;
  const isBuyer = String(sub.buyerId) === req.user.id;
  const isSeller = String(sub.sellerId) === req.user.id;
  if (!isBuyer && !isSeller)
    return res.status(403).json({ message: "Bạn không có quyền hủy đơn này." });
  const reason = req.body?.reason;
  if (
    reason !== undefined &&
    (typeof reason !== "string" || reason.trim().length > 1000)
  ) {
    return res.status(400).json({ message: "Lý do hủy tối đa 1000 ký tự." });
  }
  if (isSeller && !reason?.trim())
    return res.status(400).json({ message: "Người bán cần nhập lý do hủy." });
  if (
    (isBuyer && sub.status !== "pending") ||
    (isSeller && !["pending", "confirmed"].includes(sub.status))
  ) {
    return res
      .status(409)
      .json({ message: "Đơn không còn ở trạng thái được phép hủy." });
  }
  const note = reason?.trim() || "Người mua hủy đơn.";
  res.json({
    subOrder: await changeStatus(sub, "cancelled", note, {
      actorId: req.user.id,
    }),
  });
});

router.patch("/:id/confirm", async (req, res) => {
  if (String(req.subOrder.sellerId) !== req.user.id)
    return res
      .status(403)
      .json({ message: "Chỉ người bán của đơn được xác nhận." });
  const trackingCode = "BM" + randomBytes(4).toString("hex").toUpperCase();
  res.json({
    subOrder: await changeStatus(
      req.subOrder,
      "confirmed",
      "Người bán đã xác nhận đơn.",
      { trackingCode, actorId: req.user.id },
    ),
  });
});
router.patch("/:id/ship", async (req, res) => {
  if (String(req.subOrder.sellerId) !== req.user.id)
    return res
      .status(403)
      .json({ message: "Chỉ người bán của đơn được giao cho hãng." });
  res.json({
    subOrder: await changeStatus(
      req.subOrder,
      "shipping",
      "Người bán đã giao sách cho hãng vận chuyển demo.",
      { actorId: req.user.id },
    ),
  });
});
router.patch("/:id/received", async (req, res) => {
  if (String(req.subOrder.buyerId) !== req.user.id)
    return res
      .status(403)
      .json({ message: "Chỉ người mua của đơn được xác nhận đã nhận." });
  res.json({
    subOrder: await changeStatus(
      req.subOrder,
      "completed",
      "Người mua đã xác nhận nhận sách.",
      { actorId: req.user.id },
    ),
  });
});

export default router;
