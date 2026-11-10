// Xem trước, xác nhận đúng tên DB và backup rồi mới xóa dữ liệu E2E phát triển.
import "dotenv/config";
import mongoose from "mongoose";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
try {
  if (process.env.NODE_ENV === "production")
    throw new Error("Không chạy dọn dữ liệu ở production.");
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  if (!/^bookmarket(?:_[a-z0-9_]+)?$/i.test(db.databaseName))
    throw new Error("Chỉ hỗ trợ database phát triển BookMarket.");
  const candidates = await db
    .collection("users")
    .find({ email: /@example\.com$/i })
    .toArray();
  const safeIds = [];
  let kept = 0;
  for (const user of candidates) {
    // Giữ user đã có đơn để không làm hỏng lịch sử người nhận/người bán.
    const order = await db.collection("orders").findOne({ buyerId: user._id });
    const sub = await db
      .collection("suborders")
      .findOne({ $or: [{ buyerId: user._id }, { sellerId: user._id }] });
    if (order || sub) kept++;
    else safeIds.push(user._id);
  }
  const countShops = await db
    .collection("shops")
    .countDocuments({ ownerId: { $in: safeIds } });
  const countListings = await db
    .collection("listings")
    .countDocuments({ sellerId: { $in: safeIds } });
  console.log(
    `CẢNH BÁO: DB ${db.databaseName}; sẽ xóa ${safeIds.length} user @example.com, ${countShops} shop, ${countListings} tin của họ và collection refreshsessions cũ.`,
  );
  console.log(
    `Giữ ${kept} user có lịch sử đơn; không xóa orders/suborders hoặc catalog dùng chung. Bỏ users.isActive/listings.searchText nếu còn. Hãy dừng API trước khi dọn.`,
  );
  const option = process.argv.find((value) => value.startsWith("--confirm="));
  let answer = option?.slice("--confirm=".length);
  if (answer === undefined) {
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      answer = await prompt.question(
        "Nhập chính xác tên database để xác nhận, hoặc Enter để bỏ qua: ",
      );
    } finally {
      prompt.close();
    }
  }
  if (answer !== db.databaseName) {
    console.log("Đã bỏ qua, không sửa dữ liệu.");
  } else {
    const backup = {
      database: db.databaseName,
      createdAt: new Date().toISOString(),
      collections: [],
    };
    for (const { name } of await db
      .listCollections({}, { nameOnly: true })
      .toArray()) {
      if (name.startsWith("system.")) continue;
      backup.collections.push({
        name,
        indexes: await db.collection(name).indexes(),
        documents: mongoose.mongo.BSON.EJSON.serialize(
          await db.collection(name).find().toArray(),
          { relaxed: false },
        ),
      });
    }
    const directory = path.join(root, "exports", "backups");
    await fs.mkdir(directory, { recursive: true });
    const file = path.join(directory, "cleanup-" + Date.now() + ".json");
    await fs.writeFile(file, JSON.stringify(backup, null, 2));
    if (
      JSON.parse(await fs.readFile(file, "utf8")).collections.length !==
      backup.collections.length
    )
      throw new Error("Không xác minh được backup.");
    await db.collection("listings").deleteMany({ sellerId: { $in: safeIds } });
    await db.collection("shops").deleteMany({ ownerId: { $in: safeIds } });
    await db.collection("users").deleteMany({ _id: { $in: safeIds } });
    if (await db.listCollections({ name: "refreshsessions" }).hasNext())
      await db.dropCollection("refreshsessions");
    await db.collection("users").updateMany({}, { $unset: { isActive: "" } });
    await db
      .collection("listings")
      .updateMany({}, { $unset: { searchText: "" } });
    console.log("Đã dọn. Backup: " + file);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
