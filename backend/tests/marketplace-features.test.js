import "dotenv/config";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import app from "../src/app.js";
import {
  allModels,
  User,
  Admin,
  Shop,
  Listing,
} from "../src/models/index.js";
import { resolveEdition } from "../src/utils/catalog.js";

const uri =
  process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27018/bookmarket_test_marketfeatures?replicaSet=bookmarket-rs";
if (!/^bookmarket_test(?:_[a-z0-9]+)?$/i.test(new URL(uri).pathname.slice(1)))
  throw new Error("Chỉ dùng database test cho tính năng marketplace.");
process.env.JWT_SECRET = randomBytes(48).toString("hex");
let seller, buyer, outsider, admin;

beforeAll(async () => {
  await mongoose.connect(uri);
  for (const model of allModels) await model.init();
});
beforeEach(async () => {
  for (const model of allModels) await model.deleteMany({});
  seller = await account("seller");
  buyer = await account("buyer");
  outsider = await account("outsider");
  admin = await account("admin", true);
  await Shop.create({
    ownerId: seller.id,
    name: "Tiệm sách thử",
    description: "Mô tả gian hàng",
  });
});
afterAll(async () => {
  if (mongoose.connection.readyState === 1)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function account(name, isAdmin = false) {
  const model = isAdmin ? Admin : User;
  const user = await model.create({
    name,
    email: `${name}@example.com`,
    passwordHash: "test-only",
  });
  return {
    id: user.id,
    token: jwt.sign(
      { id: user.id, accountType: isAdmin ? "admin" : "user" },
      process.env.JWT_SECRET,
    ),
  };
}
async function listing(title, author = "Tác giả A", category = "Văn học") {
  const editionId = await resolveEdition({ title, author, category });
  return Listing.create({
    editionId,
    sellerId: seller.id,
    shopId: (await Shop.findOne({ ownerId: seller.id }))._id,
    type: "new",
    price: 50000,
    stock: 5,
    description: "Sách kiểm thử",
    status: "approved",
  });
}

it("người bán tự ẩn/hiện tin nhưng không mở được tin do admin ẩn", async () => {
  const book = await listing("Sách quản lý hiển thị");
  const path = `/listings/${book.id}/visibility`;
  expect(
    (
      await request(app)
        .patch(path)
        .auth(outsider.token, { type: "bearer" })
        .send({ hidden: true })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(path)
        .auth(seller.token, { type: "bearer" })
        .send({ hidden: true })
    ).body.listing,
  ).toMatchObject({ status: "hidden", hiddenBy: "seller" });
  expect((await request(app).get(`/listings/${book.id}`)).status).toBe(404);
  expect(
    (
      await request(app)
        .patch(path)
        .auth(seller.token, { type: "bearer" })
        .send({ hidden: false })
    ).body.listing.status,
  ).toBe("approved");
  await request(app)
    .patch(`/listings/${book.id}/moderation`)
    .auth(admin.token, { type: "bearer" })
    .send({ status: "hidden" });
  expect(
    (
      await request(app)
        .patch(path)
        .auth(seller.token, { type: "bearer" })
        .send({ hidden: false })
    ).status,
  ).toBe(403);
});

it("gợi ý tách sách cùng tác giả và cùng thể loại, không trả lại chính sách đang xem", async () => {
  const source = await listing("Sách nguồn", "Tác giả A", "Văn học");
  const sameAuthor = await listing("Sách cùng tác giả", "Tác giả A", "Kỹ năng");
  const sameCategory = await listing(
    "Sách cùng thể loại",
    "Tác giả B",
    "Văn học",
  );
  const response = await request(app).get(
    `/listings/${source.id}/recommendations`,
  );
  expect(response.status).toBe(200);
  expect(response.body.sameAuthor.map((item) => item.id)).toContain(
    sameAuthor.id,
  );
  expect(response.body.sameCategory.map((item) => item.id)).toContain(
    sameCategory.id,
  );
  expect(JSON.stringify(response.body)).not.toContain(source.id);
});
