// Tạo cấu hình local; chỉ thêm JWT_SECRET nếu chuyển từ bản cũ, không ghi đè cấu hình đã có.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "backend", ".env");
if (fs.existsSync(target)) {
  let current = fs.readFileSync(target, "utf8");
  const additions = [];
  if (!/^JWT_SECRET=.+/m.test(current)) additions.push("JWT_SECRET=" + randomBytes(48).toString("hex"));
  for (const line of ["PAYMENT_BANK_ID=", "PAYMENT_BANK_NAME=", "PAYMENT_ACCOUNT_NO=", "PAYMENT_ACCOUNT_NAME=", "PAYMENT_QR_TEMPLATE=compact2", "PAYMENT_WEBHOOK_SECRET="]) {
    const key = line.split("=")[0];
    if (!new RegExp(`^${key}=`, "m").test(current)) additions.push(line);
  }
  if (additions.length) fs.appendFileSync(target, "\n" + additions.join("\n") + "\n");
  console.log(additions.length ? "Added missing environment keys; existing values preserved." : "backend/.env already exists; preserved.");
} else {
  const lines = [
    "PORT=4000", "MONGO_URI=mongodb://127.0.0.1:27018/bookmarket_foundation?replicaSet=bookmarket-rs",
    "JWT_SECRET=" + randomBytes(48).toString("hex"),
    "CLIENT_URL=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5180,http://127.0.0.1:5180",
    "NODE_ENV=development", "SEED_PASSWORD=BookMarket123!",
    "PAYMENT_BANK_ID=", "PAYMENT_BANK_NAME=", "PAYMENT_ACCOUNT_NO=", "PAYMENT_ACCOUNT_NAME=",
    "PAYMENT_QR_TEMPLATE=compact2", "PAYMENT_WEBHOOK_SECRET=",
    "TEST_MONGO_URI=mongodb://127.0.0.1:27018/bookmarket_test_simple?replicaSet=bookmarket-rs",
  ];
  fs.writeFileSync(target, lines.join("\n") + "\n");
  console.log("Created backend/.env with a random JWT secret. Secret value omitted.");
}
