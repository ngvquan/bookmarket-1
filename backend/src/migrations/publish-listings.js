import mongoose from "mongoose";
import { backupDatabase } from "../utils/database-backup.js";

// Chỉ bỏ hàng chờ của sách; không đổi đơn hàng pending hoặc tin admin đã ẩn.
export async function publishPendingListings({ apply = false } = {}) {
  const db = mongoose.connection.db;
  const listings = db.collection("listings");
  const pending = await listings.countDocuments({ status: "pending" });
  const report = {
    database: db.databaseName,
    mode: apply ? "apply" : "dry-run",
    pending,
    published: 0,
  };
  if (apply && pending) {
    report.backup = await backupDatabase(db, "before-publish-books");
    const result = await listings.updateMany(
      { status: "pending" },
      { $set: { status: "approved", updatedAt: new Date() } },
    );
    report.published = result.modifiedCount;
  }
  return report;
}
