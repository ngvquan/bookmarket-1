import mongoose from "mongoose";

// Mọi thao tác liên quan đơn/kho phải dùng cùng session để cùng lưu hoặc cùng hủy.
export async function withOrderTransaction(work) {
  try {
    return await mongoose.connection.transaction(work, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } catch (error) {
    if (
      error.code === 20 ||
      /Transaction numbers are only allowed|does not support.*transactions/i.test(
        error.message,
      )
    ) {
      const unavailable = new Error(
        "Đặt hàng cần MongoDB replica set để bảo đảm đơn và tồn kho. Hãy chạy scripts/start-mongo-replica.ps1 và cấu hình MONGO_URI theo hướng dẫn.",
      );
      unavailable.status = 503;
      throw unavailable;
    }
    throw error;
  }
}
