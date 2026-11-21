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
  Conversation,
  Message,
} from "../src/models/index.js";
import { resolveEdition } from "../src/utils/catalog.js";

const uri =
  process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27017/bookmarket_test_chat";
if (!/^bookmarket_test(?:_[a-z0-9]+)?$/i.test(new URL(uri).pathname.slice(1)))
  throw new Error("Chat chỉ kiểm thử trên database test riêng.");
process.env.JWT_SECRET = randomBytes(48).toString("hex");
let buyer, seller, outsider, listing;
const token = (user, accountType = "user") =>
  jwt.sign({ id: user.id, accountType }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
const call = (method, path, user = buyer) =>
  request(app)[method](path).auth(token(user), { type: "bearer" });
const send = (
  id,
  text = "Chào bạn, sách còn không?",
  user = buyer,
  clientId = randomUUID(),
) =>
  call("post", `/conversations/${id}/messages`, user).send({ text, clientId });
async function start(user = buyer) {
  const result = await call("post", "/conversations", user).send({
    listingId: listing.id,
  });
  expect(result.status).toBe(200);
  return result.body.conversation;
}
beforeAll(async () => {
  await mongoose.connect(uri);
  for (const Model of allModels) await Model.init();
});
beforeEach(async () => {
  for (const Model of allModels) await Model.deleteMany({});
  [buyer, seller, outsider] = await User.create(
    ["buyer", "seller", "outsider"].map((name) => ({
      name,
      email: `${name}@example.com`,
      passwordHash: "not-used-for-login",
    })),
  );
  const editionId = await resolveEdition({
    title: "Sách trò chuyện",
    author: "Tác giả mẫu",
    category: "Văn học",
  });
  listing = await Listing.create({
    sellerId: seller._id,
    editionId,
    type: "used",
    price: 50000,
    stock: 1,
    description: "Cuốn sách dùng để kiểm thử chat.",
    status: "approved",
  });
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

it("chỉ tài khoản user đăng nhập được dùng chat, không lấy email/hash ra hộp thư", async () => {
  expect((await request(app).get("/conversations")).status).toBe(401);
  const admin = await Admin.create({
    name: "Admin",
    email: "admin@example.com",
    passwordHash: "not-used",
  });
  expect(
    (
      await request(app)
        .get("/conversations")
        .auth(token(admin, "admin"), { type: "bearer" })
    ).status,
  ).toBe(403);
  const conversation = await start();
  expect(conversation.other).toEqual({ id: seller.id, name: seller.name });
  expect(conversation.book.title).toBe("Sách trò chuyện");
  expect(JSON.stringify(conversation)).not.toMatch(/email|passwordHash/);
  expect(
    (
      await call("post", "/conversations", seller).send({
        listingId: listing.id,
      })
    ).status,
  ).toBe(400);
});

it("tạo đồng thời vẫn chỉ một cuộc trò chuyện cho cặp người mua/người bán và giữ ngữ cảnh sách", async () => {
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      call("post", "/conversations").send({ listingId: listing.id }),
    ),
  );
  expect(responses.every((response) => response.status === 200)).toBe(true);
  expect(
    new Set(responses.map((response) => response.body.conversation.id)).size,
  ).toBe(1);
  const direct = await call("post", "/conversations").send({
    sellerId: seller.id,
  });
  expect(direct.body.conversation.id).toBe(responses[0].body.conversation.id);
  expect(await Conversation.countDocuments()).toBe(1);
  await Listing.deleteOne({ _id: listing.id });
  const history = await call(
    "get",
    `/conversations/${direct.body.conversation.id}/messages`,
  );
  expect(history.status).toBe(200);
  expect(history.body.conversation.book.title).toBe("Sách trò chuyện");
});

it("người ngoài không được đọc, gửi hoặc đánh dấu đọc; không tự gán người gửi", async () => {
  const conversation = await start();
  await send(conversation.id);
  const path = `/conversations/${conversation.id}`;
  expect((await call("get", `${path}/messages`, outsider)).status).toBe(404);
  expect((await send(conversation.id, "Đọc lén", outsider)).status).toBe(404);
  expect(
    (await call("post", `${path}/read`, outsider).send({ through: 1 })).status,
  ).toBe(404);
  expect(
    (
      await call("post", `${path}/messages`).send({
        text: "Giả người gửi",
        senderId: seller.id,
      })
    ).status,
  ).toBe(400);
  expect((await call("get", "/conversations", outsider)).body.total).toBe(0);
  expect((await call("get", "/conversations/unread", seller)).body.seller).toBe(
    1,
  );
});

it("gửi hai chiều, đọc đến đúng mốc và giữ tin mới chưa đọc; tách hộp thư mua/bán", async () => {
  const conversation = await start();
  const first = await send(conversation.id, "Tin thứ nhất");
  const second = await send(conversation.id, "Tin thứ hai");
  expect(first.status).toBe(201);
  expect(second.body.message.sequence).toBe(2);
  expect((await call("get", "/conversations/unread", seller)).body).toEqual({
    buyer: 0,
    seller: 2,
    total: 2,
  });
  expect(
    (
      await call("post", `/conversations/${conversation.id}/read`, seller).send(
        { through: 1 },
      )
    ).status,
  ).toBe(204);
  expect((await call("get", "/conversations/unread", seller)).body.total).toBe(
    1,
  );
  await send(conversation.id, "Shop còn sách nhé", seller);
  expect((await call("get", "/conversations/unread")).body.buyer).toBe(1);
  expect(
    (await call("get", "/conversations").query({ role: "buyer" })).body.total,
  ).toBe(1);
  expect(
    (await call("get", "/conversations").query({ role: "seller" })).body.total,
  ).toBe(0);
  expect(
    (await call("get", "/conversations", seller).query({ role: "seller" })).body
      .items[0].unread,
  ).toBe(1);
  const seen = await call("get", `/conversations/${conversation.id}/messages`);
  expect(seen.body.conversation.otherReadSequence).toBe(1);
  expect(seen.body.items.map((message) => message.text)).toEqual([
    "Tin thứ nhất",
    "Tin thứ hai",
    "Shop còn sách nhé",
  ]);
  expect(
    (
      await call("post", `/conversations/${conversation.id}/read`, seller).send(
        { through: 999 },
      )
    ).status,
  ).toBe(400);
  expect((await call("get", "/conversations/unread", seller)).body.total).toBe(
    1,
  );
});

it("gửi lại cùng clientId không nhân đôi, xung đột nội dung bị từ chối", async () => {
  const conversation = await start();
  const clientId = randomUUID();
  const results = await Promise.all([
    send(conversation.id, "Một lần thôi", buyer, clientId),
    send(conversation.id, "Một lần thôi", buyer, clientId),
  ]);
  expect(results.map((response) => response.status).sort()).toEqual([200, 201]);
  expect(results[0].body.message.id).toBe(results[1].body.message.id);
  expect(await Message.countDocuments()).toBe(1);
  expect(
    (await send(conversation.id, "Nội dung khác", buyer, clientId)).status,
  ).toBe(409);
  expect((await call("get", "/conversations/unread", seller)).body.total).toBe(
    1,
  );
});

it("phân trang tin cũ/mới không lặp và thứ tự gửi đồng thời luôn tăng", async () => {
  const conversation = await start();
  const results = await Promise.all(
    Array.from({ length: 7 }, (_, index) =>
      send(conversation.id, `Tin ${index}`),
    ),
  );
  expect(results.every((response) => response.status === 201)).toBe(true);
  const recent = await call(
    "get",
    `/conversations/${conversation.id}/messages`,
  ).query({ limit: 3 });
  expect(recent.body.items.map((message) => message.sequence)).toEqual([
    5, 6, 7,
  ]);
  expect(recent.body.hasMore).toBe(true);
  const older = await call(
    "get",
    `/conversations/${conversation.id}/messages`,
  ).query({ before: 5, limit: 3 });
  expect(older.body.items.map((message) => message.sequence)).toEqual([
    2, 3, 4,
  ]);
  const after = await call(
    "get",
    `/conversations/${conversation.id}/messages`,
  ).query({ after: 4, limit: 2 });
  expect(after.body.items.map((message) => message.sequence)).toEqual([5, 6]);
  expect(after.body.hasMore).toBe(true);
  const latest = await Message.findOne().sort({ sequence: -1 });
  const inbox = await call("get", "/conversations");
  expect(inbox.body.items[0].lastText).toBe(latest.text);
  expect(inbox.body.items[0].lastSequence).toBe(7);
});

it("từ chối nội dung trống/quá dài và tham số sai, chỉ bắt đầu chat từ tin đang hiển thị", async () => {
  const conversation = await start();
  for (const text of ["   ", "x".repeat(2001), 123])
    expect((await send(conversation.id, text)).status).toBe(400);
  expect(await Message.countDocuments()).toBe(0);
  for (const query of [
    { before: 2, after: 1 },
    { after: -1 },
    { limit: 51 },
    { before: "bad" },
  ]) {
    expect(
      (
        await call("get", `/conversations/${conversation.id}/messages`).query(
          query,
        )
      ).status,
    ).toBe(400);
  }
  expect(
    (await call("get", "/conversations").query({ role: "admin" })).status,
  ).toBe(400);
  await Listing.updateOne({ _id: listing.id }, { status: "hidden" });
  expect(
    (
      await call("post", "/conversations", outsider).send({
        listingId: listing.id,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await call("post", "/conversations", outsider).send({
        sellerId: seller.id,
      })
    ).status,
  ).toBe(404);
  expect((await send(conversation.id, "Hỏi tiếp về đơn đã mua")).status).toBe(
    201,
  );
});
