import { Router } from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { readPagination } from "../utils/pagination.js";

const router = Router();
router.use(requireLogin, requireUser);
router.get("/", async (req, res) => {
  const pagination = readPagination(req.query);
  if (!pagination)
    return res.status(400).json({ message: "Phân trang không hợp lệ." });
  const { page, limit } = pagination;
  const filter = { userId: req.user.id };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  res.json({
    items: items.map(notificationResponse),
    total,
    unread,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});
router.patch("/read-all", async (req, res) => {
  await Notification.updateMany(
    { userId: req.user.id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  res.json({ unread: 0 });
});
router.patch("/:id/read", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "ID thông báo không hợp lệ." });
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!item)
    return res.status(404).json({ message: "Không tìm thấy thông báo." });
  res.json({ notification: notificationResponse(item.toObject()) });
});
function notificationResponse(item) {
  return {
    id: String(item._id),
    orderId: String(item.orderId),
    subOrderId: String(item.subOrderId),
    status: item.status,
    title: item.title,
    message: item.message,
    readAt: item.readAt,
    createdAt: item.createdAt,
  };
}
export default router;
