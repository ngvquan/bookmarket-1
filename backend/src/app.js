// Ghép các route và trả lỗi JSON chung; file này không tự mở cổng để supertest dùng được.
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import shopRoutes from "./routes/shops.js";
import listingRoutes from "./routes/listings.js";
import adminAuthRoutes from "./routes/admin-auth.js";
import orderRoutes from "./routes/orders.js";
import subOrderRoutes from "./routes/subOrders.js";
import adminOrderRoutes from "./routes/admin-orders.js";
import shippingRoutes from "./routes/shipping.js";
import conversationRoutes from "./routes/conversations.js";
import reviewRoutes from "./routes/reviews.js";
import {
  digitalRoutes,
  bankWebhookRoutes,
  adminDigitalRoutes,
  adminBankRoutes,
} from "./routes/digital-orders.js";
import libraryRoutes from "./routes/library.js";
import notificationRoutes from "./routes/notifications.js";
const app = express();
app.use(
  cors({
    origin: (process.env.CLIENT_URL || "http://localhost:5173").split(","),
  }),
);
app.use(
  express.json({
    limit: "256kb",
  }),
);
app.get("/health", (req, res) =>
  res.json({
    message: "BookMarket API đang chạy.",
  }),
);
app.use("/auth", authRoutes);
app.use("/admin/auth", adminAuthRoutes);
app.use("/shops", shopRoutes);
app.use("/listings", listingRoutes);
app.use("/orders", orderRoutes);
app.use("/sub-orders", subOrderRoutes);
app.use("/admin", adminOrderRoutes);
app.use("/shipping", shippingRoutes);
app.use("/conversations", conversationRoutes);
app.use("/reviews", reviewRoutes);
app.use("/digital-orders", digitalRoutes);
app.use("/webhooks", bankWebhookRoutes);
app.use("/admin/digital-orders", adminDigitalRoutes);
app.use("/admin/bank-transactions", adminBankRoutes);
app.use("/library", libraryRoutes);
app.use("/notifications", notificationRoutes);
app.use((req, res) =>
  res.status(404).json({
    message: "Không tìm thấy API.",
  }),
);

// Mongoose/JSON lỗi trả 400 hoặc 409; lỗi ngoài dự kiến không lộ thông tin nội bộ.
app.use((error, req, res, next) => {
  if (error.code === 11000) {
    return res.status(409).json({
      message: "Email hoặc chủ shop đã tồn tại.",
    });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({
      message: "Dữ liệu không hợp lệ.",
    });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "JSON không hợp lệ.",
    });
  }
  if (error.type === "entity.too.large") {
    return res.status(400).json({
      message: "Nội dung quá lớn.",
    });
  }
  if ([400, 403, 409, 503].includes(error.status)) {
    return res.status(error.status).json({
      message: error.message,
      ...(error.listingId ? { listingId: error.listingId } : {}),
    });
  }
  console.error(error);
  res.status(500).json({
    message: "Máy chủ gặp lỗi. Vui lòng thử lại.",
  });
});
export default app;
