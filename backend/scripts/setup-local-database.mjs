// Ho tro BAT: doc cau hinh an toan va chi nhap/seed khi database dang rong.
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
dotenv.config({ path: path.join(root, "backend/.env") });
const mode = process.argv[2];
let client;
try {
  const uri = process.env.MONGO_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri))
    throw new Error("MONGO_URI trong backend/.env khong hop le.");
  const parsed = new URL(uri);
  const name = decodeURIComponent(parsed.pathname.slice(1));
  const port = Number(process.env.PORT || 4000);
  if (!name || ["admin", "local", "config"].includes(name))
    throw new Error("MONGO_URI phai chi ro ten database ung dung.");
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 5173)
    throw new Error("PORT backend khong hop le hoac trung frontend 5173.");
  if (mode === "config") {
    // Khong in URI/JWT secret; PowerShell chi can cong va co khoi dong MongoDB local khong.
    console.log(
      JSON.stringify({
        port,
        startLocalMongo:
          ["127.0.0.1", "localhost"].includes(parsed.hostname) &&
          parsed.port === "27018",
      }),
    );
  } else {
    if (!["setup", "check"].includes(mode))
      throw new Error("Chi ho tro config, setup hoac check.");
    client = new mongoose.mongo.MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    const hello = await client.db("admin").command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid")
      throw new Error(
        "Database can replica set de xu ly don hang. Xem backend/.env va docs/HARDENING.md.",
      );
    if (mode === "setup") {
      const db = client.db(name);
      const collections = await db
        .listCollections({}, { nameOnly: true })
        .toArray();
      const marker = path.join(root, ".local/database-import-pending.json");
      let pending;
      try {
        pending = JSON.parse(await fs.readFile(marker, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (pending?.database === name)
        throw new Error(
          "Lan nhap database truoc bi gian doan. Chon ten database moi trong backend/.env roi chay setup.bat lai.",
        );
      if (collections.length) {
        console.log(
          "Database da co du lieu/cau truc. Giu nguyen, khong nhap lai hoac seed.",
        );
      } else {
        const backup = path.join(root, "database");
        const hasBackup = await fs
          .access(path.join(backup, "schema.json"))
          .then(
            () => true,
            (error) => {
              if (error.code === "ENOENT") return false;
              throw error;
            },
          );
        if (hasBackup) {
          await fs.mkdir(path.dirname(marker), { recursive: true });
          await fs.writeFile(marker, JSON.stringify({ database: name }));
          execFileSync(
            process.execPath,
            [
              path.join(root, "backend/scripts/restore-packaged-database.mjs"),
              uri,
              backup,
            ],
            { cwd: root, env: process.env, stdio: "inherit" },
          );
          await fs.unlink(marker);
        } else {
          console.log(
            "Khong co database dong goi. Them du lieu mau cho database rong.",
          );
          execFileSync(
            process.execPath,
            [path.join(root, "backend/scripts/seed.js")],
            { cwd: root, env: process.env, stdio: "inherit" },
          );
        }
      }
    } else console.log("Ket noi MongoDB thanh cong.");
  }
} catch (error) {
  console.error(
    "Database setup failed: " +
      error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, "[MongoDB URI]"),
  );
  process.exitCode = 1;
} finally {
  await client?.close();
}
