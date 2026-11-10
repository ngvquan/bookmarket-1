import "dotenv/config";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import app from "../src/app.js";
import {
  allModels,
  User,
  Admin,
  Shop,
  Listing,
  DigitalOrder,
  EbookAccess,
  BankTransaction,
} from "../src/models/index.js";
import { resolveEdition } from "../src/utils/catalog.js";
import { hasEbookAccess } from "../src/utils/ebook-access.js";
import { removePrivateFile } from "../src/utils/private-files.js";
const uri =
  process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27018/bookmarket_test_digital?replicaSet=bookmarket-rs";
if (!/^bookmarket_test(?:_[a-z0-9]+)?$/i.test(new URL(uri).pathname.slice(1)))
  throw new Error("Chỉ dùng DB test.");
process.env.JWT_SECRET = randomBytes(48).toString("hex");
const secret = "digital-tests-only-secret-with-more-than-32-characters";
let buyer, seller, other, admin, book;
beforeAll(async () => {
  await mongoose.connect(uri);
  for (const Model of allModels) await Model.init();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  for (const Model of allModels) await Model.deleteMany({});
  Object.assign(process.env, {
    PAYMENT_BANK_ID: "970415",
    PAYMENT_BANK_NAME: "Ngân hàng sàn",
    PAYMENT_ACCOUNT_NO: "123456789",
    PAYMENT_ACCOUNT_NAME: "BOOKMARKET",
    PAYMENT_QR_TEMPLATE: "compact2",
    PAYMENT_WEBHOOK_SECRET: secret,
  });
  buyer = await account("buyer");
  seller = await account("seller");
  other = await account("other");
  admin = await account("admin", true);
  await Shop.create({
    ownerId: seller.id,
    name: "Shop ebook",
    description: "Shop dùng trong kiểm thử",
  });
  const editionId = await resolveEdition({
    title: "Ebook test",
    author: "Tác giả",
    category: "Văn học",
    binding: "PDF",
  });
  book = await Listing.create({
    editionId,
    sellerId: seller.id,
    type: "digital",
    price: 7000,
    description: "Ebook test",
    status: "approved",
  });
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
async function account(name, isAdmin = false) {
  const user = await (isAdmin ? Admin : User).create({
    name,
    email: name + "@example.com",
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
function create(who = buyer, ids = [book.id], extra = {}) {
  return request(app)
    .post("/digital-orders")
    .auth(who.token, { type: "bearer" })
    .send({ listingIds: ids, ...extra });
}
function hook(order, extra = {}, auth = "Apikey " + secret) {
  return request(app)
    .post("/webhooks/bank-transaction")
    .set("Authorization", auth)
    .send({
      id: "bank-123",
      transferType: "in",
      accountNumber: "123456789",
      transferAmount: order.total,
      content: order.transferCode,
      ...extra,
    });
}
function status(order, who = buyer) {
  return request(app)
    .get(`/digital-orders/${order._id}/status`)
    .auth(who.token, { type: "bearer" });
}
function manual(order, who = admin, extra = {}) {
  return request(app)
    .patch(`/admin/digital-orders/${order._id}/mark-paid`)
    .auth(who.token, { type: "bearer" })
    .send({
      bankTransactionId: "manual-123",
      paidAmount: order.total,
      ...extra,
    });
}
it("upload ảnh/PDF, đọc thử hai trang và chỉ cấp file đầy đủ sau thanh toán", async () => {
  const pdfDocument = await PDFDocument.create();
  pdfDocument.addPage();
  pdfDocument.addPage();
  pdfDocument.addPage();
  const pdf = Buffer.from(await pdfDocument.save());
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+axtsAAAAASUVORK5CYII=",
    "base64",
  );
  let imageId, fileId;
  try {
    expect(
      (
        await request(app)
          .post(`/listings/${book.id}/images`)
          .auth(other.token, { type: "bearer" })
          .set("Content-Type", "image/png")
          .send(image)
      ).status,
    ).toBe(403);
    const uploadedImage = await request(app)
      .post(`/listings/${book.id}/images`)
      .auth(seller.token, { type: "bearer" })
      .set("Content-Type", "image/png")
      .send(image);
    expect(uploadedImage.status).toBe(201);
    imageId = uploadedImage.body.listing.imageIds[0];
    const uploadedPdf = await request(app)
      .put(`/listings/${book.id}/ebook`)
      .auth(seller.token, { type: "bearer" })
      .set("Content-Type", "application/pdf")
      .send(pdf);
    expect(uploadedPdf.status).toBe(200);
    expect(uploadedPdf.body.listing).toMatchObject({
      hasEbook: true,
      imageIds: [imageId],
    });
    fileId = (await Listing.findById(book.id)).ebookFileId;
    expect(
      (await request(app).get(`/listings/${book.id}/images/${imageId}`)).status,
    ).toBe(200);
    const preview = await request(app).get(`/listings/${book.id}/preview`);
    expect(preview.status).toBe(200);
    expect((await PDFDocument.load(preview.body)).getPageCount()).toBe(2);
    expect(
      (
        await request(app)
          .get(`/listings/${book.id}/ebook`)
          .auth(other.token, { type: "bearer" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get(`/listings/${book.id}/ebook`)
          .auth(seller.token, { type: "bearer" })
      ).status,
    ).toBe(200);
    const order = (await create()).body.order;
    await hook(order);
    const full = await request(app)
      .get(`/listings/${book.id}/ebook`)
      .auth(buyer.token, { type: "bearer" });
    expect(full.status).toBe(200);
    expect((await PDFDocument.load(full.body)).getPageCount()).toBe(3);
    expect(
      (
        await request(app)
          .put(`/listings/${book.id}/ebook`)
          .auth(seller.token, { type: "bearer" })
          .set("Content-Type", "application/pdf")
          .send(pdf)
      ).status,
    ).toBe(409);
  } finally {
    await Promise.all([
      removePrivateFile("images", imageId),
      removePrivateFile("ebooks", fileId),
    ]);
  }
});
it("giá/snapshot từ DB và QR chỉ là link, tạo đơn chưa cấp quyền", async () => {
  const result = await create(buyer, [book.id], {
    total: 1,
    price: 1,
    buyerId: other.id,
    status: "paid",
  });
  expect(result.status).toBe(201);
  expect(result.body.order).toMatchObject({
    total: 7000,
    status: "pending_payment",
  });
  expect(result.body.order.buyerId).toBeUndefined();
  expect(result.body.order.cartKey).toBeUndefined();
  expect(result.body.order.bankTransactionId).toBeUndefined();
  expect(result.body.order.items[0]).toMatchObject({
    listingId: book.id,
    title: "Ebook test",
    price: 7000,
  });
  const qr = new URL(result.body.qrImageUrl);
  expect(qr.hostname).toBe("img.vietqr.io");
  expect(qr.searchParams.get("amount")).toBe("7000");
  expect(qr.searchParams.get("addInfo")).toBe(result.body.transferCode);
  expect(result.body.transferCode).toMatch(/^BM[A-Z0-9]{10}$/);
  expect(await EbookAccess.countDocuments()).toBe(0);
});
it("chặn không đăng nhập/admin, tự mua, sai loại, ẩn, ID trùng và mua lại", async () => {
  expect((await request(app).post("/digital-orders").send({})).status).toBe(
    401,
  );
  expect((await create(admin)).status).toBe(403);
  expect((await create(seller)).status).toBe(403);
  for (const ids of [[], [book.id, book.id], [{}]])
    expect((await create(buyer, ids)).status).toBe(400);
  await Listing.updateOne(
    { _id: book.id },
    { $set: { type: "new", stock: 2 } },
  );
  expect((await create()).status).toBe(400);
  await Listing.updateOne(
    { _id: book.id },
    { $set: { type: "digital", status: "hidden" } },
  );
  expect((await create()).status).toBe(400);
  await Listing.updateOne({ _id: book.id }, { $set: { status: "approved" } });
  const order = (await create()).body.order;
  await hook(order);
  expect((await create()).status).toBe(409);
});
it("bấm đồng thời hoặc gửi lại cùng bộ sách chỉ tạo một đơn pending", async () => {
  const results = await Promise.all([create(), create(), create()]);
  expect(results.every((result) => result.status === 201)).toBe(true);
  expect(new Set(results.map((result) => result.body.order._id)).size).toBe(1);
  expect(await DigitalOrder.countDocuments()).toBe(1);
});
it("thiếu tài khoản sàn trả 503, sai/thiếu secret không thanh toán", async () => {
  delete process.env.PAYMENT_ACCOUNT_NO;
  expect((await create()).status).toBe(503);
  process.env.PAYMENT_ACCOUNT_NO = "123456789";
  const order = (await create()).body.order;
  expect((await hook(order, {}, "Apikey wrong")).status).toBe(401);
  expect((await hook(order, {}, "Bearer " + secret)).status).toBe(401);
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  expect((await hook(order)).status).toBe(503);
  expect(await EbookAccess.countDocuments()).toBe(0);
});
it("ebook của nhiều shop nằm trong một đơn và dùng tài khoản chung của sàn", async () => {
  await Shop.create({
    ownerId: other.id,
    name: "Shop khác",
    description: "Shop thứ hai",
  });
  const second = await Listing.create({
    editionId: book.editionId,
    sellerId: other.id,
    type: "digital",
    price: 9000,
    description: "Ebook shop khác",
    status: "approved",
  });
  const mixed = await create(buyer, [book.id, second.id]);
  expect(mixed.status).toBe(201);
  expect(mixed.body.order.items).toHaveLength(2);
  expect(mixed.body).toMatchObject({
    total: 16000,
    bank: { id: "970415", accountNo: "123456789", accountName: "BOOKMARKET" },
  });
});
it("webhook đúng cấp quyền trong transaction và gửi lặp/đồng thời không cấp hai lần", async () => {
  const order = (await create()).body.order;
  const results = await Promise.all([hook(order), hook(order)]);
  expect(
    results.every((result) => result.status === 200 && result.body.success),
  ).toBe(true);
  expect((await hook(order)).body.duplicate).toBe(true);
  expect(await EbookAccess.countDocuments()).toBe(1);
  expect((await DigitalOrder.findById(order._id)).status).toBe("paid");
  expect(await hasEbookAccess(buyer.id, book.id)).toBe(true);
  expect(await hasEbookAccess(seller.id, book.id)).toBe(true);
  expect(await hasEbookAccess(other.id, book.id)).toBe(false);
});
it("webhook SePay dùng field code vẫn khớp đơn khi content không chứa mã", async () => {
  const order = (await create()).body.order;
  const result = await hook(order, {
    id: "sepay-code-field",
    content: "Thanh toan ebook",
    code: order.transferCode,
  });
  expect(result.body).toMatchObject({ success: true, matched: true });
  expect((await DigitalOrder.findById(order._id)).status).toBe("paid");
});
it("thiếu tiền, sai mã, tiền ra hoặc sai tài khoản không cấp quyền", async () => {
  const order = (await create()).body.order;
  for (const extra of [
    { transferAmount: 6999 },
    { content: "SAI MA" },
    { transferType: "out" },
    { accountNumber: "wrong" },
  ]) {
    const result = await hook(order, extra);
    expect(result.status).toBe(200);
    expect(result.body.matched).toBe(false);
  }
  expect(await EbookAccess.countDocuments()).toBe(0);
});
it("thiếu accountNumber không cấp quyền; giao dịch lệch được lưu một lần", async () => {
  const order = (await create()).body.order;
  const missingAccount = await hook(order, {
    id: "missing-account",
    accountNumber: undefined,
  });
  expect(missingAccount.body.matched).toBe(false);
  await hook(order, { id: "missing-account", accountNumber: undefined });
  expect(
    await BankTransaction.countDocuments({
      transactionId: "missing-account",
      reason: "wrong_account",
    }),
  ).toBe(1);
  await hook(order, { id: "short-payment", transferAmount: 6999 });
  await hook(order, { id: "wrong-account", accountNumber: "000000000" });
  expect(await BankTransaction.countDocuments()).toBe(3);
  expect(
    (await BankTransaction.findOne({ transactionId: "short-payment" })).reason,
  ).toBe("not_enough");
  expect(
    (await BankTransaction.findOne({ transactionId: "wrong-account" })).reason,
  ).toBe("wrong_account");
  expect(await EbookAccess.countDocuments()).toBe(0);
});
it("mã chữ thường/thêm dấu cách và alias payload vẫn khớp", async () => {
  const order = (await create()).body.order;
  const result = await request(app)
    .post("/webhooks/bank-transaction")
    .set("Authorization", "Apikey " + secret)
    .send({
      referenceCode: "ref-alias",
      amount: 7000,
      accountNumber: "123456789",
      description: order.transferCode.toLowerCase().split("").join(" "),
    });
  expect(result.body).toMatchObject({ success: true, matched: true });
  expect(await EbookAccess.countDocuments()).toBe(1);
});
it("đơn hết hạn tự đổi trạng thái nhưng nhận tiền muộn vẫn cấp quyền", async () => {
  const order = (await create()).body.order;
  await DigitalOrder.updateOne(
    { _id: order._id },
    { $set: { expiresAt: new Date(0) } },
  );
  expect((await status(order)).body.status).toBe("expired");
  expect((await hook(order)).body.matched).toBe(true);
  expect((await status(order)).body.status).toBe("paid");
});
it("chỉ chủ đơn được xem/hủy; hủy đơn pending không cấp quyền khi nhận webhook", async () => {
  const order = (await create()).body.order;
  expect((await status(order, other)).status).toBe(403);
  expect(
    (
      await request(app)
        .post(`/digital-orders/${order._id}/cancel`)
        .auth(other.token, { type: "bearer" })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post(`/digital-orders/${order._id}/cancel`)
        .auth(buyer.token, { type: "bearer" })
    ).status,
  ).toBe(200);
  expect((await hook(order)).body.matched).toBe(false);
  expect(await EbookAccess.countDocuments()).toBe(0);
  expect((await manual(order)).status).toBe(409);
});
it("library/mine chỉ trả dữ liệu của chính mình và quyền tồn tại qua lần đọc lại", async () => {
  const order = (await create()).body.order;
  await hook(order);
  for (const [who, count] of [
    [buyer, 1],
    [other, 0],
  ]) {
    expect(
      (await request(app).get("/library").auth(who.token, { type: "bearer" }))
        .body.items,
    ).toHaveLength(count);
    expect(
      (
        await request(app)
          .get("/digital-orders/mine")
          .auth(who.token, { type: "bearer" })
      ).body.total,
    ).toBe(count);
  }
});
it("mark-paid chỉ admin, bắt buộc giao dịch/số tiền đủ, không dùng lại mã ngân hàng", async () => {
  const order = (await create()).body.order;
  expect((await manual(order, buyer)).status).toBe(403);
  expect((await manual(order, admin, { bankTransactionId: "" })).status).toBe(
    400,
  );
  expect((await manual(order, admin, { paidAmount: 1 })).status).toBe(400);
  expect((await manual(order)).status).toBe(200);
  const another = (await create(other)).body.order;
  expect((await manual(another)).status).toBe(409);
  expect((await DigitalOrder.findById(another._id)).status).toBe(
    "pending_payment",
  );
});
it("admin gán giao dịch chưa khớp thì đánh dấu giao dịch đã xử lý", async () => {
  const order = (await create()).body.order;
  await hook(order, { id: "manual-from-unmatched", accountNumber: "wrong" });
  expect(
    (await BankTransaction.findOne({ transactionId: "manual-from-unmatched" }))
      .resolved,
  ).toBe(false);
  const result = await manual(order, admin, {
    bankTransactionId: "manual-from-unmatched",
    paidAmount: order.total,
  });
  expect(result.status).toBe(200);
  expect(
    (await BankTransaction.findOne({ transactionId: "manual-from-unmatched" }))
      .resolved,
  ).toBe(true);
  const list = await request(app)
    .get("/admin/bank-transactions?resolved=false")
    .auth(admin.token, { type: "bearer" });
  expect(list.status).toBe(200);
  expect(list.body.total).toBe(0);
});
it("ebook 0 đồng được cấp ngay, không cần QR hoặc cấu hình ngân hàng", async () => {
  const free = await Listing.create({
    editionId: book.editionId,
    sellerId: seller.id,
    type: "digital",
    price: 0,
    description: "Ebook miễn phí",
    status: "approved",
  });
  delete process.env.PAYMENT_ACCOUNT_NO;
  const result = await create(buyer, [free.id]);
  expect(result.status).toBe(201);
  expect(result.body.order).toMatchObject({
    total: 0,
    status: "paid",
    qrImageUrl: "",
    bank: null,
  });
  expect(result.body.order.bankTransactionId).toBeUndefined();
  expect(
    await EbookAccess.exists({ buyerId: buyer.id, listingId: free.id }),
  ).toBeTruthy();
  expect(
    (await DigitalOrder.findById(result.body.order._id)).bankTransactionId,
  ).toBe("FREE-" + result.body.order._id);
});
it("lỗi ghi quyền rollback cả paid; gửi lại cùng giao dịch vẫn xử lý được", async () => {
  const order = (await create()).body.order;
  vi.spyOn(EbookAccess, "updateOne").mockRejectedValueOnce(
    new Error("forced access failure"),
  );
  expect((await hook(order)).status).toBe(500);
  expect((await DigitalOrder.findById(order._id)).status).toBe(
    "pending_payment",
  );
  expect(await EbookAccess.countDocuments()).toBe(0);
  expect((await hook(order)).body.matched).toBe(true);
});
it("ebook đã paid không được xóa hoặc đổi loại", async () => {
  const order = (await create()).body.order;
  await hook(order);
  expect(
    (
      await request(app)
        .delete("/listings/" + book.id)
        .auth(seller.token, { type: "bearer" })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .patch("/listings/" + book.id)
        .auth(seller.token, { type: "bearer" })
        .send({ type: "used" })
    ).status,
  ).toBe(409);
});

it("hai giỏ chồng ebook thanh toán đồng thời không mất khoản thu hoặc cấp trùng", async () => {
  const second = await Listing.create({
    editionId: book.editionId,
    sellerId: seller.id,
    type: "digital",
    price: 3000,
    description: "Bản khác",
    status: "approved",
  });
  const first = (await create()).body.order;
  const next = (await create(buyer, [book.id, second.id])).body.order;
  const results = await Promise.all([
    hook(first),
    hook(next, { id: "bank-next" }),
  ]);
  expect(results.every((result) => result.status === 200)).toBe(true);
  expect(await DigitalOrder.countDocuments({ status: "paid" })).toBe(2);
  expect(await EbookAccess.countDocuments()).toBe(2);
});

it("tin bị gỡ lúc đang chờ không làm mất quyền khi tiền về", async () => {
  const order = (await create()).body.order;
  await Listing.deleteOne({ _id: book.id });
  await hook(order);
  const library = await request(app)
    .get("/library")
    .auth(buyer.token, { type: "bearer" });
  expect(library.body.items[0]).toMatchObject({
    id: book.id,
    type: "digital",
    title: "Ebook test",
  });
});
