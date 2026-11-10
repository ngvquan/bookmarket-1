import mongoose from "mongoose";
import { backupDatabase } from "../utils/database-backup.js";

// Dữ liệu thật chỉ đổi khi --apply và sau khi ghi được bản sao lưu.
export async function removeExchange({ apply = false } = {}) {
  const db = mongoose.connection.db;
  const listings = db.collection("listings");
  const deleted = await listings.countDocuments({ type: "exchange" });
  const cleaned = await listings.countDocuments({
    type: { $ne: "exchange" },
    wanted: { $exists: true },
  });
  const report = { mode: apply ? "apply" : "dry-run", deleted, cleaned };
  if (!apply || (!deleted && !cleaned)) return report;
  report.backup = await backupDatabase(db, "before-remove-exchange");
  await listings.deleteMany({ type: "exchange" });
  await listings.updateMany(
    { wanted: { $exists: true } },
    { $unset: { wanted: "" } },
  );
  return report;
}
