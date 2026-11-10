import "dotenv/config";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import mongoose from "mongoose";
import fs from "node:fs/promises";
import {
  allModels,
  User,
  Shop,
  Listing,
  Order,
  SubOrder,
  Book,
  Edition,
  Message,
  DigitalOrder,
  EbookAccess,
} from "../src/models/index.js";
import { resolveEdition } from "../src/utils/catalog.js";
import { registrationData } from "./fixtures/shop-registration.js";
import { hardenDatabase } from "../src/migrations/harden-database.js";
import { removeExchange } from "../src/migrations/remove-exchange.js";

const uri =
  process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27018/bookmarket_test_database?replicaSet=bookmarket-rs";
if (!/^bookmarket_test(?:_[a-z0-9]+)?$/i.test(new URL(uri).pathname.slice(1)))
  throw new Error("Chỉ chạy kiểm thử migration trên database test.");
let seller;
beforeAll(async () => {
  await mongoose.connect(uri);
  for (const Model of allModels) await Model.init();
});
beforeEach(async () => {
  for (const Model of allModels) await Model.deleteMany({});
  seller = await User.create({
    name: "Người bán",
    email: "seller@example.com",
    passwordHash: "test-only",
  });
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function listing(changes = {}) {
  const editionId = await resolveEdition({
    title: "Sách test schema",
    author: "Tác giả",
    category: "Văn học",
  });
  return Listing.create({
    sellerId: seller._id,
    editionId,
    type: "new",
    price: 50000,
    stock: 2,
    description: "Sách kiểm thử",
    status: "approved",
    ...changes,
  });
}
const orderData = (buyerId) => ({
  buyerId,
  receiverName: "Người nhận",
  receiverPhone: "0901234567",
  receiverAddress: "12 Đường Sách",
  itemsTotal: 50000,
  shippingTotal: 25000,
  total: 75000,
});

it("harden hiểu unique partial đơn ebook và kiểm tra quyền liên kết paid", async () => {
  const book = await listing({ type: "digital", stock: undefined });
  const reader = await User.create({
    name: "Bạn đọc",
    email: "read@example.com",
    passwordHash: "test",
  });
  const orders = [];
  for (let index = 1; index <= 2; index++)
    orders.push(
      await DigitalOrder.create({
        buyerId: reader._id,
        cartKey: "same-cart",
        items: [
          {
            listingId: book.id,
            editionId: book.editionId,
            sellerId: seller._id,
            title: "Ebook",
            author: "Tác giả",
            price: 50000,
          },
        ],
        total: 50000,
        status: "paid",
        transferCode: "BM" + String(index).padStart(10, "0"),
        bankTransactionId: "transaction-" + index,
        paidAmount: 50000,
        paidAt: new Date(),
        expiresAt: new Date(),
      }),
    );
  const access = await EbookAccess.create({
    buyerId: reader._id,
    listingId: book.id,
    editionId: book.editionId,
    digitalOrderId: orders[0]._id,
  });
  expect((await hardenDatabase()).issues).toEqual([]);
  await EbookAccess.updateOne(
    { _id: access._id },
    { $set: { buyerId: seller._id } },
  );
  expect(
    (await hardenDatabase()).issues.some(
      (issue) => issue.collection === "ebookaccesses",
    ),
  ).toBe(true);
});

it("bỏ trao đổi: dry-run không ghi, apply có backup và chạy lại an toàn", async () => {
  const book = await listing();
  await Listing.collection.updateOne(
    { _id: book.id },
    { $set: { wanted: "Dữ liệu cũ" } },
  );
  await Listing.collection.insertOne({
    _id: "old-exchange",
    type: "exchange",
    wanted: "Sách khác",
  });
  expect(await removeExchange()).toMatchObject({ deleted: 1, cleaned: 1 });
  expect(await Listing.countDocuments()).toBe(2);
  const result = await removeExchange({ apply: true });
  expect(result.backup).toBeTruthy();
  expect(await Listing.countDocuments()).toBe(1);
  expect(
    (await Listing.collection.findOne({ _id: book.id })).wanted,
  ).toBeUndefined();
  expect(await removeExchange({ apply: true })).toEqual({
    mode: "apply",
    deleted: 0,
    cleaned: 0,
  });
});

it("schema từ chối kho âm/lẻ, giá lẻ, trạng thái sai và shop hoàn tất giả", async () => {
  const valid = await listing();
  for (const changes of [
    { stock: -1 },
    { stock: 1.5 },
    { type: "used", stock: 2 },
    { price: 12.5 },
    { status: "fake" },
  ]) {
    const data = valid.toObject();
    delete data._id;
    await expect(
      new Listing({ ...data, ...changes }).validate(),
    ).rejects.toThrow();
  }
  await expect(
    new Shop({
      ownerId: seller._id,
      name: "Shop",
      description: "Shop chưa đủ hồ sơ",
      isRegistrationComplete: true,
    }).validate(),
  ).rejects.toThrow();
  await expect(
    new Shop({
      ownerId: seller._id,
      name: "Shop",
      description: "Shop chưa đủ hồ sơ",
      contactPhone: "sai",
    }).validate(),
  ).rejects.toThrow();
  await expect(
    new Book({
      title: "Sách",
      authorIds: [],
      categoryId: new mongoose.Types.ObjectId(),
      titleSearch: "sach",
      catalogKey: "x",
    }).validate(),
  ).rejects.toThrow();
  await expect(
    new Edition({
      bookId: new mongoose.Types.ObjectId(),
      year: 1399,
    }).validate(),
  ).rejects.toThrow();
  await expect(
    new Order({ ...orderData(seller._id), total: 1 }).validate(),
  ).rejects.toThrow();
  await expect(
    new Message({
      conversationId: new mongoose.Types.ObjectId(),
      senderId: seller._id,
      recipientId: seller._id,
      sequence: 1.5,
      clientId: "test",
      text: "Tin nhắn",
    }).validate(),
  ).rejects.toThrow();
});

it("unique index trong MongoDB chặn cùng buyer/key, vẫn cho người mua khác", async () => {
  const first = await Order.create({
    ...orderData(seller._id),
    idempotencyKey: "same-key-123456789",
  });
  await expect(
    Order.create({
      ...orderData(seller._id),
      idempotencyKey: first.idempotencyKey,
    }),
  ).rejects.toMatchObject({ code: 11000 });
  await expect(
    Order.create({
      ...orderData(new mongoose.Types.ObjectId()),
      idempotencyKey: first.idempotencyKey,
    }),
  ).resolves.toBeTruthy();
});

it("migration dry-run không ghi; apply sao lưu, giữ ID và chạy lại không đổi dữ liệu", async () => {
  const oldShopId = new mongoose.Types.ObjectId();
  await Shop.collection.insertOne({
    _id: oldShopId,
    ownerId: seller._id,
    name: "Shop cũ",
    description: "Thiếu liên hệ",
  });
  const buyer = await User.create({
    name: "Bạn đọc",
    email: "reader@example.com",
    passwordHash: "test-only",
  });
  const complete = registrationData();
  delete complete.registrationConfirmed;
  // Dữ liệu từ phiên bản cũ: migration phải gỡ tài khoản ngân hàng riêng của shop.
  complete.paymentBank = {
    bankId: "970415",
    bankName: "Ngân hàng cũ",
    accountNo: "123456789",
    accountName: "CHU SHOP",
  };
  await Shop.collection.insertOne({ ...complete, ownerId: buyer._id });
  const oldListing = await listing({ type: "used", stock: 1, status: "sold" });
  const oldOrderId = new mongoose.Types.ObjectId();
  await Order.collection.insertOne({
    _id: oldOrderId,
    ...orderData(buyer._id),
  });
  await Listing.collection.createIndex({ sellerId: 1 });
  const before = await hardenDatabase();
  expect(before.issues).toEqual([]);
  expect(before.updates).toBe(4);
  expect(
    (await Shop.collection.findOne({ _id: oldShopId })).isRegistrationComplete,
  ).toBeUndefined();
  expect((await Listing.findById(oldListing.id)).stock).toBe(1);
  const done = await hardenDatabase({ apply: true });
  const backup = JSON.parse(await fs.readFile(done.backup, "utf8"));
  expect(
    backup.collections.find((row) => row.name === "listings").documents[0]
      .stock,
  ).toEqual({ $numberInt: "1" });
  expect((await Shop.findById(oldShopId)).isRegistrationComplete).toBe(false);
  const migratedShop = await Shop.collection.findOne({ ownerId: buyer._id });
  expect(migratedShop.isRegistrationComplete).toBe(true);
  expect(migratedShop.paymentBank).toBeUndefined();
  expect((await Listing.findById(oldListing.id)).stock).toBe(0);
  expect((await Order.findById(oldOrderId)).idempotencyKey).toBe(
    `legacy_${oldOrderId}`,
  );
  expect(
    (await Listing.collection.indexes()).some(
      (index) => index.name === "sellerId_1",
    ),
  ).toBe(false);
  const again = await hardenDatabase();
  expect(again.updates).toBe(0);
  expect(again.issues).toEqual([]);
  expect(
    again.indexes.every((row) => !row.toDrop.length && !row.toCreate.length),
  ).toBe(true);
});

it("migration dừng trước khi ghi nếu có duplicate hoặc ref sai", async () => {
  await Shop.collection.insertOne({
    ownerId: new mongoose.Types.ObjectId(),
    name: "Shop mồ côi",
    description: "Không có chủ tài khoản",
  });
  await Order.collection.dropIndex("buyerId_1_idempotencyKey_1");
  await Order.collection.insertMany(
    [1, 2].map(() => ({
      ...orderData(seller._id),
      idempotencyKey: "duplicate-key-123456",
    })),
  );
  const report = await hardenDatabase({ apply: true });
  expect(
    report.issues.some((row) => row.message.includes("Trùng unique index")),
  ).toBe(true);
  expect(
    report.issues.some((row) => row.message.includes("ownerId không tồn tại")),
  ).toBe(true);
  expect(report.backup).toBeUndefined();
  expect(
    (await Shop.collection.findOne({ name: "Shop mồ côi" }))
      .isRegistrationComplete,
  ).toBeUndefined();
  await Order.deleteMany({});
  await Order.syncIndexes();
});
