// Sao lưu trước, rồi chuyển schema. Không chạy migration tự động khi server khởi động.
import "dotenv/config";
import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDatabase } from "../src/migrations/normalize-database.js";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
await mongoose.connect(process.env.MONGO_URI);
try {
  const db = mongoose.connection.db;
  const backup = {
    database: db.databaseName,
    createdAt: new Date().toISOString(),
    collections: [],
  };
  for (const { name } of await db
    .listCollections(
      {},
      {
        nameOnly: true,
      },
    )
    .toArray()) {
    if (name.startsWith("system.")) {
      continue;
    }
    backup.collections.push({
      name,
      indexes: await db.collection(name).indexes(),
      documents: mongoose.mongo.BSON.EJSON.serialize(
        await db.collection(name).find().toArray(),
        {
          relaxed: false,
        },
      ),
    });
  }
  const directory = path.join(root, "exports", "backups");
  await fs.mkdir(directory, {
    recursive: true,
  });
  const file = path.join(
    directory,
    "migration-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json",
  );
  await fs.writeFile(file, JSON.stringify(backup, null, 2));
  // Đọc lại để chắc bản sao lưu được ghi đầy đủ trước khi chuyển dữ liệu.
  if (
    JSON.parse(await fs.readFile(file, "utf8")).collections.length !==
    backup.collections.length
  ) {
    throw new Error("Không xác minh được backup.");
  }
  console.log("Backup: " + file);
  console.log(JSON.stringify(await normalizeDatabase()));
} finally {
  await mongoose.disconnect();
}
