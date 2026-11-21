// Chủ shop tự tạo/xem/sửa; tên shop chỉ để hiển thị, ownerId lấy từ JWT.
import { Router } from "express";
import mongoose from "mongoose";
import Shop from "../models/Shop.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { shopResponse } from "../utils/user.js";
import { readShop, hasCompleteShopDetails } from "../utils/shop.js";
const router = Router();
router.use(requireLogin, requireUser);
router.get("/", async (req, res) => {
  const shop = await Shop.findOne({
    ownerId: req.user.id,
  });
  res.json({
    items: shop ? [shopResponse(shop)] : [],
  });
});
router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "ID shop không hợp lệ.",
    });
  }
  const shop = await Shop.findById(req.params.id);
  if (!shop) {
    return res.status(404).json({
      message: "Không tìm thấy shop.",
    });
  }
  if (String(shop.ownerId) !== req.user.id) {
    return res.status(403).json({
      message: "Bạn không phải chủ shop.",
    });
  }
  res.json({
    shop: shopResponse(shop),
  });
});
router.post("/", async (req, res) => {
  const { data, message } = readShop(req.body);
  if (message) {
    return res.status(400).json({
      message,
    });
  }
  if (
    await Shop.exists({
      ownerId: req.user.id,
    })
  ) {
    return res.status(409).json({
      message: "Bạn đã có một shop.",
    });
  }
  const shop = await Shop.create({
    ownerId: req.user.id,
    ...data,
    isRegistrationComplete: true,
    registrationCompletedAt: new Date(),
  });
  res.status(201).json({
    shop: shopResponse(shop),
  });
});
router.patch("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "ID shop không hợp lệ.",
    });
  }
  const shop = await Shop.findById(req.params.id);
  if (!shop) {
    return res.status(404).json({
      message: "Không tìm thấy shop.",
    });
  }
  if (String(shop.ownerId) !== req.user.id) {
    return res.status(403).json({
      message: "Bạn không phải chủ shop.",
    });
  }
  const { data, message } = readShop(req.body, {
    partial: true,
    registered: Boolean(shop.registrationCompletedAt),
  });
  if (message) {
    return res.status(400).json({
      message,
    });
  }
  Object.assign(shop, data);
  // Shop cũ chỉ hoàn tất khi đã bổ sung đủ thông tin, không tự điền dữ liệu giả.
  shop.isRegistrationComplete = hasCompleteShopDetails(shop);
  if (shop.isRegistrationComplete && !shop.registrationCompletedAt)
    shop.registrationCompletedAt = new Date();
  await shop.save();
  res.json({
    shop: shopResponse(shop),
  });
});
export default router;
