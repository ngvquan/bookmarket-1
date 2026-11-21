import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

// Sao lưu cả dữ liệu BSON và index trước khi migration sửa bất kỳ bản ghi nào.
export async function backupDatabase(db, prefix = "hardening") {
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
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  const directory = path.join(root, "exports", "backups");
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(
    directory,
    `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  const text = JSON.stringify(backup, null, 2);
  await fs.writeFile(file, text, { encoding: "utf8", flag: "wx" });
  if ((await fs.readFile(file, "utf8")) !== text)
    throw new Error("Không xác minh được file sao lưu; dừng migration.");
  return file;
}
