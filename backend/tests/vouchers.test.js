import "dotenv/config";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import app from "../src/app.js";
import { allModels, User, Shop, Listing, Voucher, DigitalOrder, BankTransaction } from "../src/models/index.js";
import { resolveEdition } from "../src/utils/catalog.js";

const uri = process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27018/bookmarket_test_vouchers?replicaSet=bookmarket-rs";
if (!/^bookmarket_test(?:_[a-z0-9]+)?$/i.test(new URL(uri).pathname.slice(1)))
  throw new Error("Chỉ được dùng database test.");
process.env.JWT_SECRET = randomBytes(48).toString("hex");
let seller, buyer, other, paper, ebook;

beforeAll(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  for (const model of allModels) await model.init();
});
beforeEach(async () => {
  for (const model of allModels) await model.deleteMany({});
  Object.assign(process.env, {
    PAYMENT_BANK_ID: "970415", PAYMENT_BANK_NAME: "Ngân hàng test",
    PAYMENT_ACCOUNT_NO: "123456789", PAYMENT_ACCOUNT_NAME: "BOOKMARKET",
    PAYMENT_QR_TEMPLATE: "compact2",
    PAYMENT_WEBHOOK_SECRET: "voucher-test-secret-longer-than-32-characters",
  });
  seller = await account("seller");
  buyer = await account("buyer");
  other = await account("other");
  await Shop.create({ ownerId: seller.id, name: "Shop voucher", description: "Sách test" });
  const editionId = await resolveEdition({
    title: "Sách voucher", author: "Tác giả", category: "Văn học", binding: "PDF",
  });
  paper = await Listing.create({
    editionId, sellerId: seller.id, type: "new", price: 50000,
    stock: 3, description: "Sách giấy", status: "approved",
  });
  ebook = await Listing.create({
    editionId, sellerId: seller.id, type: "digital", price: 7000,
    description: "Sách điện tử", status: "approved",
  });
});
afterAll(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function account(name) {
  const user = await User.create({ name, email: `${name}@example.com`, passwordHash: "test-only" });
  return {
    id: user.id,
    token: jwt.sign({ id: user.id, accountType: "user" }, process.env.JWT_SECRET),
  };
}
function as(who, method, path) {
  return request(app)[method](path).auth(who.token, { type: "bearer" });
}
async function issue(changes = {}) {
  const result = await as(seller, "post", "/vouchers/seller").send({
    buyerEmail: "buyer@example.com", kind: "fixed", value: 10000,
    minSubtotal: 30000, expiresAt: new Date(Date.now() + 86400000).toISOString(),
    ...changes,
  });
  expect(result.status).toBe(201);
  return result.body.voucher;
}
function paperOrder(who, voucherId, listingId = paper.id) {
  return as(who, "post", "/orders").send({
    idempotencyKey: randomUUID(),
    receiverName: "Người mua", receiverPhone: "0912345678",
    receiverAddress: "12 Đường Sách, TP.HCM",
    items: [{ listingId, quantity: 1 }],
    ...(voucherId ? { voucherId } : {}),
  });
}

it("seller sends distinct vouchers to several buyers in one request", async () => {
  const result = await as(seller, "post", "/vouchers/seller/bulk").send({
    buyerEmails: ["BUYER@example.com", "other@example.com"],
    kind: "fixed", value: 10000, minSubtotal: 30000,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  expect(result.status).toBe(201);
  expect(result.body.created).toBe(2);
  const vouchers = await Voucher.find({ sellerId: seller.id });
  expect(vouchers).toHaveLength(2);
  expect(new Set(vouchers.map((entry) => entry.code)).size).toBe(2);
  expect(new Set(vouchers.map((entry) => String(entry.buyerId)))).toEqual(new Set([buyer.id, other.id]));
});

it("bulk voucher request rejects missing, duplicate and self recipients without issuing any", async () => {
  const offer = {
    kind: "percent", value: 15, minSubtotal: 0,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const missing = await as(seller, "post", "/vouchers/seller/bulk").send({
    ...offer, buyerEmails: ["buyer@example.com", "missing@example.com"],
  });
  expect(missing.status).toBe(404);
  const duplicate = await as(seller, "post", "/vouchers/seller/bulk").send({
    ...offer, buyerEmails: ["buyer@example.com", "BUYER@example.com"],
  });
  expect(duplicate.status).toBe(400);
  const self = await as(seller, "post", "/vouchers/seller/bulk").send({
    ...offer, buyerEmails: ["buyer@example.com", "seller@example.com"],
  });
  expect(self.status).toBe(400);
  expect(await Voucher.countDocuments()).toBe(0);
});

it("seller selects prior buyers without copying their email addresses", async () => {
  expect((await paperOrder(buyer)).status).toBe(201);
  expect((await paperOrder(other)).status).toBe(201);
  const choices = await as(seller, "get", "/vouchers/seller/buyers");
  expect(choices.status).toBe(200);
  expect(new Set(choices.body.items.map((entry) => entry.id))).toEqual(new Set([buyer.id, other.id]));
  const sent = await as(seller, "post", "/vouchers/seller/bulk").send({
    buyerIds: [buyer.id, other.id], kind: "fixed", value: 5000,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  expect(sent.status).toBe(201);
  expect(sent.body.created).toBe(2);
  expect(await Voucher.countDocuments()).toBe(2);
});

it("buyer lookup works without a shop, while voucher creation still requires one", async () => {
  const choices = await as(buyer, "get", "/vouchers/seller/buyers");
  expect(choices.status).toBe(200);
  expect(choices.body.items).toEqual([]);

  const sent = await as(buyer, "post", "/vouchers/seller").send({
    buyerEmail: "other@example.com", kind: "fixed", value: 5000,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  expect(sent.status).toBe(403);
  expect(await Voucher.countDocuments()).toBe(0);
});

it("seller cannot send bulk vouchers to users who did not buy from their shop by ID", async () => {
  expect((await paperOrder(buyer)).status).toBe(201);
  const result = await as(seller, "post", "/vouchers/seller/bulk").send({
    buyerIds: [buyer.id, other.id], kind: "fixed", value: 5000,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  expect(result.status).toBe(403);
  expect(await Voucher.countDocuments()).toBe(0);
});

it("seller sends one-use voucher to buyer; server discounts only seller's order and returns it on cancellation", async () => {
  const voucher = await issue();
  const mine = await as(buyer, "get", "/vouchers/mine");
  expect(mine.body.items[0].code).toBe(voucher.code);
  const quote = await as(buyer, "post", "/vouchers/quote").send({
    voucherId: voucher._id, channel: "physical", items: [{ listingId: paper.id, quantity: 1 }],
  });
  expect(quote.body.discount).toBe(10000);
  expect((await paperOrder(other, voucher._id)).status).toBe(409);
  const first = await paperOrder(buyer, voucher._id);
  expect(first.status).toBe(201);
  expect(first.body.order.discountTotal).toBe(10000);
  expect(first.body.order.total).toBe(first.body.order.itemsTotal + first.body.order.shippingTotal - 10000);
  expect(first.body.order.subOrders[0].discountTotal).toBe(10000);
  expect((await paperOrder(buyer, voucher._id)).status).toBe(409);
  const cancelled = await as(buyer, "patch", `/sub-orders/${first.body.order.subOrders[0]._id}/cancel`).send({});
  expect(cancelled.status).toBe(200);
  expect((await Voucher.findById(voucher._id)).status).toBe("active");
  expect((await paperOrder(buyer, voucher._id)).status).toBe(201);
});

it("ebook QR amount includes voucher discount; cancelling releases it and paid webhook consumes it", async () => {
  const voucher = await issue({ kind: "percent", value: 50, minSubtotal: 0, maxDiscount: 0 });
  const create = () => as(buyer, "post", "/digital-orders").send({
    listingIds: [ebook.id], voucherId: voucher._id,
  });
  const first = await create();
  expect(first.status).toBe(201);
  expect(first.body.order.discountTotal).toBe(3500);
  expect(first.body.order.total).toBe(3500);
  expect(first.body.order.qrImageUrl).toContain("amount=3500");
  expect((await Voucher.findById(voucher._id)).status).toBe("reserved");
  expect((await as(buyer, "post", `/digital-orders/${first.body.order._id}/cancel`).send({})).status).toBe(200);
  expect((await Voucher.findById(voucher._id)).status).toBe("active");
  const second = await create();
  expect(second.status).toBe(201);
  const paid = await request(app).post("/webhooks/bank-transaction")
    .set("Authorization", `Apikey ${process.env.PAYMENT_WEBHOOK_SECRET}`)
    .send({ id: "voucher-bank-1", transferType: "in", accountNumber: "123456789",
      transferAmount: 3500, content: second.body.order.transferCode });
  expect(paid.body.matched).toBe(true);
  expect((await Voucher.findById(voucher._id)).status).toBe("used");
  const buyers = await as(seller, "get", "/vouchers/seller/buyers");
  expect(buyers.body.items.map((entry) => entry.id)).toContain(buyer.id);
});

it("two simultaneous orders cannot spend the same voucher twice", async () => {
  const voucher = await issue();
  const results = await Promise.all([
    paperOrder(buyer, voucher._id),
    paperOrder(buyer, voucher._id),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect((await Voucher.findById(voucher._id)).status).toBe("used");
});

it("expired ebook QR releases voucher when buyer views their vouchers", async () => {
  const voucher = await issue({ value: 1000, minSubtotal: 0 });
  const order = await as(buyer, "post", "/digital-orders").send({
    listingIds: [ebook.id], voucherId: voucher._id,
  });
  expect(order.status).toBe(201);
  await mongoose.connection.collection("digitalorders").updateOne(
    { _id: new mongoose.Types.ObjectId(order.body.order._id) },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  const mine = await as(buyer, "get", "/vouchers/mine");
  expect(mine.status).toBe(200);
  expect(mine.body.items[0].status).toBe("active");
});

it("voucher cannot discount another seller's books or a cart below its minimum", async () => {
  const voucher = await issue({ minSubtotal: 60000 });
  const otherSeller = await account("second-seller");
  const ownListing = await Listing.create({
    editionId: paper.editionId, sellerId: otherSeller.id, type: "new",
    price: 80000, stock: 2, description: "Sách shop khác", status: "approved",
  });
  const belowMinimum = await paperOrder(buyer, voucher._id);
  expect(belowMinimum.status).toBe(400);
  const wrongSeller = await paperOrder(buyer, voucher._id, ownListing.id);
  expect(wrongSeller.status).toBe(400);
  expect((await Voucher.findById(voucher._id)).status).toBe("active");
});

it("percent voucher respects its maximum discount", async () => {
  const voucher = await issue({ kind: "percent", value: 50, minSubtotal: 0, maxDiscount: 2000 });
  const order = await paperOrder(buyer, voucher._id);
  expect(order.status).toBe(201);
  expect(order.body.order.discountTotal).toBe(2000);
});

it("late ebook transfer is held for reconciliation if another order has used its released voucher", async () => {
  const voucher = await issue({ value: 1000, minSubtotal: 0 });
  const digital = await as(buyer, "post", "/digital-orders").send({
    listingIds: [ebook.id], voucherId: voucher._id,
  });
  expect(digital.status).toBe(201);
  await DigitalOrder.updateOne(
    { _id: digital.body.order._id },
    { $set: { expiresAt: new Date(0) } },
  );
  await as(buyer, "get", "/vouchers/mine");
  expect((await paperOrder(buyer, voucher._id)).status).toBe(201);
  const late = await request(app).post("/webhooks/bank-transaction")
    .set("Authorization", `Apikey ${process.env.PAYMENT_WEBHOOK_SECRET}`)
    .send({ id: "voucher-late-bank", transferType: "in", accountNumber: "123456789",
      transferAmount: digital.body.order.total, content: digital.body.order.transferCode });
  expect(late.body).toMatchObject({ success: true, matched: false });
  expect((await DigitalOrder.findById(digital.body.order._id)).status).toBe("expired");
  expect((await BankTransaction.findOne({ transactionId: "voucher-late-bank" })).reason).toBe("voucher_unavailable");
});

it("seller can send a voucher directly from their buyer's order", async () => {
  const body = {
    buyerId: buyer.id, kind: "fixed", value: 5000,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  expect((await as(seller, "post", "/vouchers/seller").send(body)).status).toBe(403);
  expect((await paperOrder(buyer)).status).toBe(201);
  const sent = await as(seller, "post", "/vouchers/seller").send(body);
  expect(sent.status).toBe(201);
  expect(sent.body.voucher.buyerId).toBe(buyer.id);
  expect((await as(buyer, "get", "/vouchers/mine")).body.items[0]._id).toBe(sent.body.voucher._id);
});
