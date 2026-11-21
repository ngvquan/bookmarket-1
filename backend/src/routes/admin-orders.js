// Admin xem đơn toàn sàn; route riêng bảo vệ bằng JWT tài khoản quản trị.
import { Router } from "express";
import mongoose from "mongoose";
import SubOrder from "../models/SubOrder.js";
import { requireLogin, requireAdmin } from "../middleware/auth.js";
import { listOrders, listSubOrders } from "../utils/order-query.js";
import { changeStatus } from "../utils/order-status.js";

const router = Router();
router.get("/orders", requireLogin, requireAdmin, async (req, res) =>
  res.json(await listOrders(req.query)),
);
router.get("/sub-orders", requireLogin, requireAdmin, async (req, res) =>
  res.json(await listSubOrders(req.query)),
);

// Admin đóng vai hãng vận chuyển demo; không có kết nối thương hiệu thật.
router.patch(
  "/sub-orders/:id/shipping",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID đơn con không hợp lệ." });
    const { status, note } = req.body || {};
    if (
      !["delivered", "returned"].includes(status) ||
      (note !== undefined &&
        (typeof note !== "string" || note.trim().length > 1000))
    ) {
      return res
        .status(400)
        .json({
          message: "status phải delivered/returned; note tối đa 1000 ký tự.",
        });
    }
    const sub = await SubOrder.findById(req.params.id);
    if (!sub)
      return res.status(404).json({ message: "Không tìm thấy đơn con." });
    if (
      (status === "delivered" && sub.status !== "shipping") ||
      (status === "returned" &&
        !["shipping", "delivered", "completed"].includes(sub.status))
    ) {
      return res
        .status(409)
        .json({
          message:
            "Chỉ giao thành công khi đơn đang giao; chỉ hoàn hàng cho đơn đang giao, đã giao hoặc đã hoàn tất.",
        });
    }
    const message =
      note?.trim() ||
      (status === "delivered"
        ? "Hãng demo đã giao thành công."
        : "Hãng demo đã hoàn hàng cho người bán.");
    res.json({
      subOrder: await changeStatus(sub, status, message, {
        actorId: req.user.id,
      }),
    });
  },
);
export default router;
