import "dotenv/config";
import mongoose from "mongoose";
import { hardenDatabase } from "../src/migrations/harden-database.js";

// Mặc định chỉ xem trước. --apply mới sao lưu, cập nhật dữ liệu và đồng bộ index.
try {
  await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 5000,
  });
  const report = await hardenDatabase({
    apply: process.argv.includes("--apply"),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) {
    console.error("Migration chưa ghi dữ liệu: cần xử lý các lỗi trên trước.");
    process.exitCode = 1;
  }
} finally {
  await mongoose.disconnect();
}
