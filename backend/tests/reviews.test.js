// Kiểm tra quyền mua thật trên database riêng, không chạm dữ liệu ứng dụng.
import "dotenv/config";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import app from "../src/app.js";
import {
  allModels,
  User,
  Admin,
  Listing,
  Review,
  SubOrder,
} from "../src/models/index.js";
import { resolveEdition } from "../src/utils/catalog.js";

const uri =
  process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27018/bookmarket_test_reviews?replicaSet=bookmarket-rs";
if (!/^bookmarket_test(?:_[a-z0-9]+)?$/i.test(new URL(uri).pathname.slice(1)))
  throw new Error("Chỉ dùng database test cho đánh giá.");
process.env.JWT_SECRET = randomBytes(48).toString("hex");
let seller, buyer, outsider, admin, listing;
const address = {
  receiverName: "Bạn đọc",
  receiverPhone: "0901234567",
  receiverAddress: "12 Đường Sách",
};
beforeAll(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  for (const Model of allModels) await Model.init();
});
beforeEach(async () => {
  for (const Model of allModels) await Model.deleteMany({});
  seller = await account("seller");
  buyer = await account("buyer");
  outsider = await account("outsider");
  admin = await account("admin", true);
  const editionId = await resolveEdition({
    title: "Sách đánh giá",
    author: "Tác giả",
    category: "Văn học",
  });
  listing = await Listing.create({
    sellerId: seller.id,
    editionId,
    type: "new",
    stock: 30,
    price: 50000,
    description: "Sách kiểm thử",
    status: "approved",
  });
});
afterAll(async () => {
  if (mongoose.connection.readyState === 1)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function account(name, isAdmin = false) {
  const user = await (isAdmin ? Admin : User).create({
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
function postReview(who = buyer, changes = {}) {
  return request(app)
    .post("/reviews")
    .auth(who.token, { type: "bearer" })
    .send({
      listingId: listing.id,
      rating: 5,
      comment: " Sách hay, đóng gói cẩn thận. ",
      ...changes,
    });
}
function permission(who = buyer) {
  return request(app)
    .get("/reviews/eligibility?listingId=" + listing.id)
    .auth(who.token, { type: "bearer" });
}
async function purchase(who = buyer) {
  const response = await request(app)
    .post("/orders")
    .auth(who.token, { type: "bearer" })
    .send({
      ...address,
      idempotencyKey: randomUUID(),
      items: [{ listingId: listing.id, quantity: 1 }],
    });
  expect(response.status).toBe(201);
  return response.body.order.subOrders[0];
}
async function step(id, action, who = seller) {
  const response = await request(app)
    .patch(`/sub-orders/${id}/${action}`)
    .auth(who.token, { type: "bearer" });
  expect(response.status).toBe(200);
}
async function shipping(id, status) {
  const response = await request(app)
    .patch(`/admin/sub-orders/${id}/shipping`)
    .auth(admin.token, { type: "bearer" })
    .send({ status });
  expect(response.status).toBe(200);
}
async function complete(who = buyer) {
  const sub = await purchase(who);
  await step(sub._id, "confirm");
  await step(sub._id, "ship");
  await shipping(sub._id, "delivered");
  await step(sub._id, "received", who);
  return sub;
}

it("chỉ người mua có đơn completed được đánh giá, không chỉ cần đặt hoặc giao thành công", async () => {
  expect((await request(app).post("/reviews").send({})).status).toBe(401);
  expect((await postReview(admin)).status).toBe(403);
  expect((await postReview()).status).toBe(403);
  expect((await permission()).body.canReview).toBe(false);
  const sub = await purchase();
  for (const action of [null, "confirm", "ship", "delivered"]) {
    if (action === "delivered") await shipping(sub._id, action);
    else if (action) await step(sub._id, action);
    expect((await postReview()).status).toBe(403);
    expect((await permission()).body.canReview).toBe(false);
  }
  await step(sub._id, "received", buyer);
  expect((await permission()).body.canReview).toBe(true);
  expect((await postReview(outsider)).status).toBe(403);
  expect((await postReview(seller)).status).toBe(403);
  expect((await postReview()).status).toBe(201);
});

it("lưu liên kết đơn thật, chặn đánh giá lại và chỉ công khai tên/sao/nội dung", async () => {
  const sub = await complete();
  expect((await postReview(buyer, { buyerId: outsider.id })).status).toBe(400);
  const response = await postReview();
  expect(response.status).toBe(201);
  const saved = await Review.findOne().lean();
  expect(String(saved.buyerId)).toBe(buyer.id);
  expect(String(saved.sellerId)).toBe(seller.id);
  expect(String(saved.subOrderId)).toBe(sub._id);
  expect(String(saved.orderId)).toBe(sub.orderId);
  expect(saved.comment).toBe("Sách hay, đóng gói cẩn thận.");
  expect((await postReview()).status).toBe(409);
  expect((await permission()).body).toMatchObject({
    canReview: false,
    alreadyReviewed: true,
  });
  const publicData = await request(app).get("/reviews?listingId=" + listing.id);
  expect(publicData.body).toMatchObject({
    total: 1,
    average: 5,
    page: 1,
    pages: 1,
  });
  expect(Object.keys(publicData.body.items[0]).sort()).toEqual(
    [
      "id",
      "buyerName",
      "rating",
      "comment",
      "createdAt",
      "verifiedPurchase",
      "reply",
    ].sort(),
  );
  expect(JSON.stringify(publicData.body)).not.toContain("example.com");
});

it("người bán xem và trả lời đánh giá của mình; người khác không được sửa", async () => {
  await complete();
  await postReview();
  const review = await Review.findOne();
  const path = `/reviews/${review.id}/reply`;
  expect(
    (
      await request(app)
        .put(path)
        .auth(outsider.token, { type: "bearer" })
        .send({ text: "Không có quyền" })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .put(path)
        .auth(seller.token, { type: "bearer" })
        .send({ text: " Cảm ơn bạn đã ủng hộ. " })
    ).status,
  ).toBe(200);
  const shopList = await request(app)
    .get("/reviews/shop?replied=yes")
    .auth(seller.token, { type: "bearer" });
  expect(shopList.body).toMatchObject({ total: 1, unreplied: 0 });
  expect(shopList.body.items[0]).toMatchObject({
    bookTitle: "Sách đánh giá",
    reply: { text: "Cảm ơn bạn đã ủng hộ." },
  });
  const publicData = await request(app).get("/reviews?listingId=" + listing.id);
  expect(publicData.body.items[0].reply).toMatchObject({
    text: "Cảm ơn bạn đã ủng hộ.",
    shopName: "seller",
  });
  expect(
    (await request(app).delete(path).auth(seller.token, { type: "bearer" }))
      .status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get("/reviews/shop?replied=no")
        .auth(seller.token, { type: "bearer" })
    ).body.unreplied,
  ).toBe(1);
});

it("hai request đánh giá đồng thời chỉ lưu một bản ghi", async () => {
  await complete();
  const results = await Promise.all([
    postReview(),
    postReview(buyer, { rating: 4 }),
  ]);
  expect(results.map((item) => item.status).sort()).toEqual([201, 409]);
  expect(await Review.countDocuments()).toBe(1);
});

it("kiểm tra số sao, nội dung, field giả và phân trang không hợp lệ", async () => {
  await complete();
  for (const changes of [
    { rating: 0 },
    { rating: 6 },
    { rating: 1.5 },
    { rating: "5" },
    { rating: {} },
    { comment: "  " },
    { comment: 1 },
    { comment: "x".repeat(2001) },
    { listingId: {} },
    { listingId: " " },
    { subOrderId: new mongoose.Types.ObjectId().toString() },
    { status: "completed" },
  ]) {
    expect((await postReview(buyer, changes)).status).toBe(400);
  }
  for (const query of [
    "",
    "listingId[]=a",
    "listingId=a&listingId=b",
    "listingId=a&page=0",
    "listingId=a&page=1.5",
  ]) {
    expect((await request(app).get("/reviews?" + query)).status).toBe(400);
  }
  expect(
    (
      await request(app)
        .get("/reviews/eligibility?listingId[x]=a")
        .auth(buyer.token, { type: "bearer" })
    ).status,
  ).toBe(400);
  expect(await Review.countDocuments()).toBe(0);
});

it("sách cũ đã sold/hết kho vẫn đánh giá được từ đơn hoàn tất; đơn hoàn/hủy không được", async () => {
  await Listing.updateOne(
    { _id: listing.id },
    { $set: { type: "used", stock: 1 } },
  );
  const sub = await complete();
  expect((await Listing.findById(listing.id)).status).toBe("sold");
  expect((await postReview()).status).toBe(201);
  await shipping(sub._id, "returned");
  // Đánh giá đã gửi được giữ làm lịch sử; đơn hoàn không được tạo đánh giá mới.
  expect(await Review.countDocuments()).toBe(1);
  const next = await complete(outsider);
  await shipping(next._id, "returned");
  expect((await postReview(outsider)).status).toBe(403);
  const cancelled = await purchase(outsider);
  await step(cancelled._id, "cancel", outsider);
  expect((await postReview(outsider)).status).toBe(403);
});

it("điểm trung bình tính trên toàn bộ đánh giá trước phân trang và không lẫn sách khác", async () => {
  for (let index = 0; index < 12; index++) {
    const customer = await account("customer" + index);
    await complete(customer);
    expect(
      (await postReview(customer, { rating: index < 6 ? 5 : 3 })).status,
    ).toBe(201);
  }
  const first = await request(app).get("/reviews?listingId=" + listing.id);
  const next = await request(app).get(
    "/reviews?listingId=" + listing.id + "&page=2",
  );
  expect(first.body).toMatchObject({ total: 12, average: 4, pages: 2 });
  expect(first.body.items).toHaveLength(10);
  expect(next.body.items).toHaveLength(2);
  expect(
    new Set(
      [...first.body.items, ...next.body.items].map((review) => review.id),
    ).size,
  ).toBe(12);
  expect(
    (await request(app).get("/reviews?listingId=other-book")).body,
  ).toMatchObject({ items: [], total: 0, average: 0 });
  expect(await SubOrder.countDocuments({ status: "completed" })).toBe(12);
});
