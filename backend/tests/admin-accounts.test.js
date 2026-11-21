import "dotenv/config";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { Admin, Shop, User, allModels } from "../src/models/index.js";

const uri = process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27018/bookmarket_test_admin_accounts?replicaSet=bookmarket-rs";
if (!/^bookmarket_test(?:_[a-z0-9]+)*$/i.test(new URL(uri).pathname.slice(1)))
  throw new Error("Chỉ được dùng database test.");
process.env.JWT_SECRET = randomBytes(48).toString("hex");

beforeAll(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  for (const model of allModels) await model.init();
});
beforeEach(async () => {
  for (const model of allModels) await model.deleteMany({});
});
afterAll(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

function token(user, accountType) {
  return jwt.sign({ id: user.id, accountType }, process.env.JWT_SECRET);
}

it("admin searches and filters accounts without exposing private profile fields", async () => {
  const admin = await Admin.create({ name: "Quản trị", email: "admin@example.com", passwordHash: "test-only" });
  const seller = await User.create({ name: "An Nguyễn", email: "an@example.com", passwordHash: "secret-hash" });
  const buyer = await User.create({ name: "Bình", email: "binh@example.com", passwordHash: "secret-hash" });
  await Shop.create({ ownerId: seller.id, name: "Rạp sách An", description: "Sách cũ" });
  const auth = { type: "bearer" };

  const all = await request(app).get("/admin/accounts").auth(token(admin, "admin"), auth);
  expect(all.status).toBe(200);
  expect(all.body.total).toBe(2);
  expect(all.body.items.find((item) => item.id === seller.id)?.shop?.name).toBe("Rạp sách An");
  expect(JSON.stringify(all.body)).not.toContain("secret-hash");
  expect(JSON.stringify(all.body)).not.toContain("addresses");

  const search = await request(app).get("/admin/accounts?search=AN@EXAMPLE.COM&scope=shop")
    .auth(token(admin, "admin"), auth);
  expect(search.status).toBe(200);
  expect(search.body.items.map((item) => item.id)).toEqual([seller.id]);

  const withoutShop = await request(app).get("/admin/accounts?scope=no_shop")
    .auth(token(admin, "admin"), auth);
  expect(withoutShop.body.items.map((item) => item.id)).toEqual([buyer.id]);

  expect((await request(app).get("/admin/accounts").auth(token(buyer, "user"), auth)).status).toBe(403);
  expect((await request(app).get("/admin/accounts")).status).toBe(401);
});
