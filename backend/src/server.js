// Đọc cấu hình, kết nối MongoDB rồi mới nhận request từ frontend.
import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { allModels, Listing, User } from "./models/index.js";
async function startServer() {
  if (
    !process.env.MONGO_URI ||
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      "Hãy đặt MONGO_URI và JWT_SECRET ít nhất 32 ký tự trong backend/.env.",
    );
  }
  await mongoose.connect(process.env.MONGO_URI);
  // Đợi unique index sẵn sàng để email và ownerId không bị tạo trùng.
  for (const model of allModels) await model.init();
  if (
    (await Listing.collection.countDocuments({
      editionId: {
        $exists: false,
      },
    })) ||
    (await User.collection.countDocuments({
      role: "admin",
    }))
  ) {
    throw new Error(
      "Database còn cấu trúc cũ. Chạy npm run migrate trước khi mở backend.",
    );
  }
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () =>
    console.log(`BookMarket API: http://localhost:${port}`),
  );
}
startServer().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
