// Ảnh bìa và PDF được lưu ngoài MongoDB; database chỉ giữ ID tệp.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const storageRoot = process.env.BOOKMARKET_STORAGE_DIR
  ? path.resolve(process.env.BOOKMARKET_STORAGE_DIR)
  : fileURLToPath(new URL("../../storage/", import.meta.url));

function storagePath(folder, id) {
  if (
    !new Set(["images", "ebooks"]).has(folder) ||
    typeof id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(id)
  ) {
    throw new Error("ID tệp không hợp lệ.");
  }
  return path.join(storageRoot, folder, id);
}

function useMongoStorage() {
  return process.env.FILE_STORAGE === "mongodb";
}

function mongoBucket() {
  if (!mongoose.connection.db)
    throw new Error("MongoDB chua san sang de luu tep.");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "privateFiles",
  });
}

function missingFileError() {
  const error = new Error("Tep khong ton tai.");
  error.code = "ENOENT";
  return error;
}

export async function savePrivateFile(folder, buffer) {
  const id = randomUUID();
  if (useMongoStorage()) {
    await new Promise((resolve, reject) => {
      const upload = mongoBucket().openUploadStreamWithId(id, id, {
        metadata: { folder },
      });
      upload.once("error", reject);
      upload.once("finish", resolve);
      upload.end(buffer);
    });
    return id;
  }
  const target = storagePath(folder, id);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer, { flag: "wx" });
  return id;
}

export async function readPrivateFile(folder, id) {
  storagePath(folder, id); // Kiem tra folder va ID truoc khi doc.
  if (useMongoStorage()) {
    const file = await mongoose.connection.db
      .collection("privateFiles.files")
      .findOne({ _id: id, "metadata.folder": folder });
    if (!file) throw missingFileError();
    const chunks = [];
    await new Promise((resolve, reject) => {
      const download = mongoBucket().openDownloadStream(id);
      download.on("data", (chunk) => chunks.push(chunk));
      download.once("error", reject);
      download.once("end", resolve);
    });
    return Buffer.concat(chunks);
  }
  return readFile(storagePath(folder, id));
}

export async function removePrivateFile(folder, id) {
  if (!id) return;
  storagePath(folder, id);
  if (useMongoStorage()) {
    await mongoBucket().delete(id).catch((error) => {
      if (error.code !== "ENOENT" && error.code !== "FileNotFound") throw error;
    });
    return;
  }
  await unlink(storagePath(folder, id)).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}
