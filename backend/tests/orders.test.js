// Kiểm chứng kho thật trên DB test riêng; giả lập lỗi ghi để thử đường hoàn kho.
import "dotenv/config";
import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
  vi,
} from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import app from "../src/app.js";
import {
  allModels,
  User,
  Admin,
  Shop,
  Listing,
  Book,
  Order,
  SubOrder,
  Notification,
} from "../src/models/index.js";
import * as catalog from "../src/utils/catalog.js";
import { withOrderTransaction } from "../src/utils/order-transaction.js";

const uri =
  process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27017/bookmarket_test_orders";
const database = new URL(uri).pathname.slice(1);
if (!/^bookmarket_test(?:_[a-z0-9]+)?$/i.test(database)) {
  throw new Error(
    "Chỉ được dùng database bookmarket_test hoặc bookmarket_test_*.",
  );
}
process.env.JWT_SECRET = randomBytes(48).toString("hex");
let passwordHash;
let buyer;
let sellerA;
let sellerB;
const address = {
  receiverName: " Bạn đọc ",
  receiverPhone: " +84 912345678 ",
  receiverAddress: " 12 Đường Sách, TP.HCM ",
};

beforeAll(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  for (const model of allModels) await model.init();
  passwordHash = await bcrypt.hash("BookMarket123!", 12);
});
beforeEach(async () => {
  for (const model of allModels) await model.deleteMany({});
  buyer = await makeUser("buyer@example.com");
  sellerA = await makeUser("seller-a@example.com");
  sellerB = await makeUser("seller-b@example.com");
  await Shop.create({
    ownerId: sellerA.id,
    name: "Shop A",
    description: "Sách của A",
  });
  await Shop.create({
    ownerId: sellerB.id,
    name: "Shop B",
    description: "Sách của B",
  });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  if (mongoose.connection.readyState === 1)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// Auth đã có suite riêng; tại đây vẫn dùng user thật và JWT được middleware đọc lại.
async function makeUser(email) {
  const user = await User.create({
    name: email.split("@")[0],
    email,
    passwordHash,
  });
  const token = jwt.sign(
    { id: user.id, accountType: "user" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
  return { id: user.id, token };
}

async function makeListing(seller, changes = {}) {
  const metadata = {
    title: "Nhà giả kim",
    author: "Paulo Coelho",
    isbn: "9780000000026",
    category: "Văn học",
    publisher: "NXB mẫu",
    binding: "Bìa mềm",
  };
  const editionId = await catalog.resolveEdition(metadata);
  const shop = await Shop.findOne({ ownerId: seller.id });
  return Listing.create({
    editionId,
    sellerId: seller.id,
    shopId: shop?._id || null,
    type: "new",
    price: 50000,
    stock: 10,
    description: "Sách test",
    status: "approved",
    ...changes,
  });
}

function checkout(account, items, extra = {}) {
  return request(app)
    .post("/orders")
    .auth(account.token, { type: "bearer" })
    .send({ ...address, idempotencyKey: randomUUID(), items, ...extra });
}

it("đặt nhiều seller: snapshot từ DB, một phí mỗi seller, bỏ giá/chủ/tổng giả", async () => {
  const first = await makeListing(sellerA);
  const second = await makeListing(sellerA, {
    type: "used",
    stock: 1,
    price: 30000,
  });
  const third = await makeListing(sellerB, { price: 70000 });
  const response = await checkout(
    buyer,
    [
      {
        listingId: first.id,
        quantity: 2,
        price: 1,
        sellerId: buyer.id,
        title: "Tên giả",
      },
      { listingId: second.id, quantity: 1 },
      { listingId: third.id, quantity: 1 },
    ],
    {
      buyerId: sellerA.id,
      itemsTotal: 1,
      shippingTotal: 0,
      total: 1,
      shippingFee: 0,
      services: { [sellerB.id]: "fast" },
    },
  );
  expect(response.status).toBe(201);
  const order = response.body.order;
  expect(order).toMatchObject({
    buyerId: buyer.id,
    receiverName: "Bạn đọc",
    receiverPhone: "+84 912345678",
    receiverAddress: "12 Đường Sách, TP.HCM",
    paymentMethod: "cod",
    itemsTotal: 200000,
    shippingTotal: 65000,
    total: 265000,
  });
  expect(order.subOrders).toHaveLength(2);
  const subA = order.subOrders.find((sub) => sub.sellerId === sellerA.id);
  expect(subA).toMatchObject({
    shopName: "Shop A",
    status: "pending",
    itemsTotal: 130000,
    shippingFee: 25000,
    shipment: { service: "standard", fee: 25000, trackingCode: "" },
  });
  expect(subA.items[0]).toMatchObject({
    listingId: first.id,
    type: "new",
    title: "Nhà giả kim",
    author: "Paulo Coelho",
    isbn: "9780000000026",
    price: 50000,
    quantity: 2,
  });
  expect(subA.shipment.events[0].status).toBe("pending");
  expect((await Listing.findById(first.id)).stock).toBe(8);
  expect((await Listing.findById(second.id)).status).toBe("sold");
  expect((await Listing.findById(second.id)).stock).toBe(0);
  expect((await Listing.findById(third.id)).stock).toBe(9);
  await Listing.updateOne({ _id: first.id }, { $set: { price: 99999 } });
  await Book.updateMany({}, { $set: { title: "Đã đổi tên sách" } });
  await Shop.updateOne(
    { ownerId: sellerA.id },
    { $set: { name: "Đã đổi tên shop" } },
  );
  const saved = await SubOrder.findById(subA._id);
  expect(saved.items[0].price).toBe(50000);
  expect(saved.items[0].title).toBe("Nhà giả kim");
  expect(saved.shopName).toBe("Shop A");
  expect(await Order.countDocuments()).toBe(1);
  expect(await SubOrder.countDocuments()).toBe(2);
});

it("POST orders yêu cầu user thật, không nhận token admin", async () => {
  expect((await request(app).post("/orders").send({})).status).toBe(401);
  const admin = await Admin.create({
    name: "Admin",
    email: "admin@example.com",
    passwordHash,
  });
  const token = jwt.sign(
    { id: admin.id, accountType: "admin" },
    process.env.JWT_SECRET,
  );
  expect(
    (
      await request(app)
        .post("/orders")
        .auth(token, { type: "bearer" })
        .send({})
    ).status,
  ).toBe(403);
  expect(await Order.countDocuments()).toBe(0);
});

it("validate tên/điện thoại/địa chỉ/items/quantity/dòng trùng trước khi trừ kho", async () => {
  const listing = await makeListing(sellerA);
  const item = { listingId: listing.id, quantity: 1 };
  const invalid = [
    { idempotencyKey: undefined },
    { idempotencyKey: "short" },
    { idempotencyKey: {} },
    { receiverName: "   " },
    { receiverName: 42 },
    { receiverName: "x".repeat(121) },
    { receiverPhone: "012" },
    { receiverPhone: "abc1234567" },
    { receiverPhone: "+++++++++" },
    { receiverPhone: "1".repeat(16) },
    { receiverAddress: "  " },
    { receiverAddress: "x".repeat(1001) },
    { items: [] },
    { items: null },
    { items: [{ listingId: {}, quantity: 1 }] },
    { items: [{ ...item, quantity: 0 }] },
    { items: [{ ...item, quantity: 100 }] },
    { items: [{ ...item, quantity: 1.5 }] },
    { items: [{ ...item, quantity: "1" }] },
    { items: [item, { ...item, listingId: " " + listing.id + " " }] },
    {
      items: Array.from({ length: 21 }, (_, i) => ({
        listingId: "id-" + i,
        quantity: 1,
      })),
    },
    { paymentMethod: "card" },
    { services: [] },
    { services: null },
    { services: { badId: "standard" } },
    { services: { [sellerA.id]: "toString" } },
    { services: { [sellerA.id]: { fee: 0 } } },
  ];
  for (const extra of invalid) {
    const result = await checkout(buyer, [item], extra);
    expect(result.status, JSON.stringify(extra)).toBe(400);
    expect(result.body.message).toBeTruthy();
  }
  expect((await Listing.findById(listing.id)).stock).toBe(10);
  expect(await Order.countDocuments()).toBe(0);
});

it("cùng key gửi nhiều lần đồng thời chỉ tạo một đơn và trừ kho một lần", async () => {
  const listing = await makeListing(sellerA);
  const key = randomUUID();
  const items = [{ listingId: listing.id, quantity: 2 }];
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      checkout(buyer, items, { idempotencyKey: key }),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([
    200, 200, 200, 200, 201,
  ]);
  expect(new Set(results.map((r) => r.body.order._id)).size).toBe(1);
  expect(await Order.countDocuments()).toBe(1);
  expect(await SubOrder.countDocuments()).toBe(1);
  expect(
    await Notification.countDocuments({
      userId: sellerA.id,
      status: "pending",
    }),
  ).toBe(1);
  expect((await Listing.findById(listing.id)).stock).toBe(8);
  const replay = await checkout(buyer, items, { idempotencyKey: key });
  expect(replay.status).toBe(200);
  expect(replay.body.replayed).toBe(true);
});

it("key cũ vẫn lấy lại đơn sách cũ đã hết kho/hủy; không làm trừ kho lần nữa", async () => {
  const listing = await makeListing(sellerA, { type: "used", stock: 1 });
  const key = randomUUID();
  const items = [{ listingId: listing.id, quantity: 1 }];
  const first = await checkout(buyer, items, { idempotencyKey: key });
  expect(first.status).toBe(201);
  expect((await checkout(buyer, items, { idempotencyKey: key })).status).toBe(
    200,
  );
  const id = first.body.order.subOrders[0]._id;
  expect((await patchSub(id, "cancel", buyer)).status).toBe(200);
  const replay = await checkout(buyer, items, { idempotencyKey: key });
  expect(replay.body.order.subOrders[0].status).toBe("cancelled");
  expect((await Listing.findById(listing.id)).stock).toBe(1);
  expect(await Order.countDocuments()).toBe(1);
});

it("cùng key khác nội dung bị 409; key giống nhau của hai người mua vẫn tách biệt", async () => {
  const a = await makeListing(sellerA);
  const b = await makeListing(sellerA);
  const key = randomUUID();
  const items = [{ listingId: a.id, quantity: 1 }];
  expect((await checkout(buyer, items, { idempotencyKey: key })).status).toBe(
    201,
  );
  expect(
    (
      await checkout(buyer, [{ listingId: b.id, quantity: 1 }], {
        idempotencyKey: key,
      })
    ).status,
  ).toBe(409);
  expect((await Listing.findById(b.id)).stock).toBe(10);
  expect((await checkout(sellerB, items, { idempotencyKey: key })).status).toBe(
    201,
  );
  expect((await Listing.findById(a.id)).stock).toBe(8);
});

it("cùng key nhưng mua hai tin khác nhau đồng thời: unique index hủy đơn thua và kho của nó", async () => {
  const a = await makeListing(sellerA);
  const b = await makeListing(sellerB);
  const key = randomUUID();
  const results = await Promise.all(
    [a, b].map((book) =>
      checkout(buyer, [{ listingId: book.id, quantity: 1 }], {
        idempotencyKey: key,
      }),
    ),
  );
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(await Order.countDocuments()).toBe(1);
  expect(await SubOrder.countDocuments()).toBe(1);
  const sold = (await SubOrder.findOne()).items[0].listingId;
  for (const book of [a, b])
    expect((await Listing.findById(book.id)).stock).toBe(
      book.id === sold ? 9 : 10,
    );
});

it("transaction lỗi không chiếm key; thử lại cùng key sau rollback tạo đúng một đơn", async () => {
  const book = await makeListing(sellerA);
  const key = randomUUID();
  const items = [{ listingId: book.id, quantity: 1 }];
  vi.spyOn(SubOrder.prototype, "save").mockRejectedValueOnce(
    new Error("save failure before commit"),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await checkout(buyer, items, { idempotencyKey: key })).status).toBe(
    500,
  );
  expect(await Order.countDocuments()).toBe(0);
  expect((await Listing.findById(book.id)).stock).toBe(10);
  expect((await checkout(buyer, items, { idempotencyKey: key })).status).toBe(
    201,
  );
  expect((await checkout(buyer, items, { idempotencyKey: key })).status).toBe(
    200,
  );
  expect((await Listing.findById(book.id)).stock).toBe(9);
});

it("không mua tin của chính mình", async () => {
  const listing = await makeListing(buyer);
  const response = await checkout(buyer, [
    { listingId: listing.id, quantity: 1 },
  ]);
  expect(response.status).toBe(403);
  expect((await Listing.findById(listing.id)).stock).toBe(10);
});

it("pending/rejected/hidden/sold/hết kho/không tồn tại đều bị chặn 409", async () => {
  for (const status of ["pending", "rejected", "hidden", "sold"]) {
    const listing = await makeListing(sellerA, { status });
    const response = await checkout(buyer, [
      { listingId: listing.id, quantity: 1 },
    ]);
    expect(response.status).toBe(409);
    expect(response.body.listingId).toBe(listing.id);
    expect((await Listing.findById(listing.id)).stock).toBe(10);
  }
  const empty = await makeListing(sellerA, { stock: 0 });
  const emptyUsed = await makeListing(sellerA, { type: "used", stock: 0 });
  for (const id of [empty.id, emptyUsed.id, "missing-listing"]) {
    expect(
      (await checkout(buyer, [{ listingId: id, quantity: 1 }])).status,
    ).toBe(409);
  }
  expect(await Order.countDocuments()).toBe(0);
});

it("ebook dùng luồng chuyển khoản riêng; sách cũ chỉ nhận quantity=1", async () => {
  for (const type of ["digital"]) {
    const listing = await makeListing(sellerA, { type });
    const response = await checkout(buyer, [
      { listingId: listing.id, quantity: 1 },
    ]);
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("/digital-orders");
  }
  const used = await makeListing(sellerA, { type: "used", stock: 1 });
  expect(
    (await checkout(buyer, [{ listingId: used.id, quantity: 2 }])).status,
  ).toBe(400);
  expect((await Listing.findById(used.id)).status).toBe("approved");
});

it("hai request mua đồng thời sách cũ: đúng một 201 và một 409", async () => {
  const listing = await makeListing(sellerA, { type: "used", stock: 1 });
  const items = [{ listingId: listing.id, quantity: 1 }];
  const results = await Promise.all([
    checkout(buyer, items),
    checkout(sellerB, items),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect((await Listing.findById(listing.id)).status).toBe("sold");
  expect(await Order.countDocuments()).toBe(1);
  expect(await SubOrder.countDocuments()).toBe(1);
});

it("hai request mua vượt kho sách mới: kho cuối không âm, chỉ ghi đơn thắng", async () => {
  const listing = await makeListing(sellerA, { stock: 3 });
  const items = [{ listingId: listing.id, quantity: 2 }];
  const results = await Promise.all([
    checkout(buyer, items),
    checkout(sellerB, items),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect((await Listing.findById(listing.id)).stock).toBe(1);
  expect(await Order.countDocuments()).toBe(1);
});

it("đơn nhiều dòng: dòng cuối thiếu hàng hoàn cả stock mới và trạng thái sách cũ", async () => {
  const first = await makeListing(sellerA, { stock: 5 });
  const second = await makeListing(sellerA, { type: "used", stock: 1 });
  const third = await makeListing(sellerB, { stock: 0 });
  const response = await checkout(buyer, [
    { listingId: first.id, quantity: 2 },
    { listingId: second.id, quantity: 1 },
    { listingId: third.id, quantity: 1 },
  ]);
  expect(response.status).toBe(409);
  expect(response.body.listingId).toBe(third.id);
  expect((await Listing.findById(first.id)).stock).toBe(5);
  expect((await Listing.findById(second.id)).status).toBe("approved");
  expect(await Order.countDocuments()).toBe(0);
  expect(await SubOrder.countDocuments()).toBe(0);
});

it("dòng ebook phía sau hoặc services sai seller cũng hoàn các dòng đã giữ kho", async () => {
  const first = await makeListing(sellerA);
  const digital = await makeListing(sellerB, { type: "digital" });
  const items = [{ listingId: first.id, quantity: 1 }];
  expect(
    (await checkout(buyer, [...items, { listingId: digital.id, quantity: 1 }]))
      .status,
  ).toBe(400);
  expect(
    (await checkout(buyer, items, { services: { [sellerB.id]: "fast" } }))
      .status,
  ).toBe(400);
  expect((await Listing.findById(first.id)).stock).toBe(10);
  expect(await Order.countDocuments()).toBe(0);
});

it("lỗi metadata sau khi giữ kho vẫn hoàn kho", async () => {
  const listing = await makeListing(sellerA, { type: "used", stock: 1 });
  vi.spyOn(catalog, "editionDetails").mockRejectedValueOnce(
    new Error("metadata test failure"),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await checkout(buyer, [
    { listingId: listing.id, quantity: 1 },
  ]);
  expect(response.status).toBe(500);
  expect((await Listing.findById(listing.id)).status).toBe("approved");
  expect(await Order.countDocuments()).toBe(0);
});

it("lỗi ghi Order hoàn kho và không để đơn con", async () => {
  const listing = await makeListing(sellerA);
  vi.spyOn(Order.prototype, "save").mockRejectedValueOnce(
    new Error("order test failure"),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await checkout(buyer, [
    { listingId: listing.id, quantity: 2 },
  ]);
  expect(response.status).toBe(500);
  expect((await Listing.findById(listing.id)).stock).toBe(10);
  expect(await Order.countDocuments()).toBe(0);
  expect(await SubOrder.countDocuments()).toBe(0);
});

it("lỗi ghi đơn con thứ hai dọn đơn mẹ/con đã ghi và hoàn cả hai seller", async () => {
  const first = await makeListing(sellerA);
  const second = await makeListing(sellerB, { type: "used", stock: 1 });
  const originalSave = SubOrder.prototype.save;
  vi.spyOn(SubOrder.prototype, "save")
    .mockImplementationOnce(originalSave)
    .mockRejectedValueOnce(new Error("suborder test failure"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await checkout(buyer, [
    { listingId: first.id, quantity: 1 },
    { listingId: second.id, quantity: 1 },
  ]);
  expect(response.status).toBe(500);
  expect((await Listing.findById(first.id)).stock).toBe(10);
  expect((await Listing.findById(second.id)).status).toBe("approved");
  expect(await Order.countDocuments()).toBe(0);
  expect(await SubOrder.countDocuments()).toBe(0);
});

it("lỗi hoàn kho ở dòng thứ hai hủy cả thay đổi trạng thái và dòng thứ nhất", async () => {
  const first = await makeListing(sellerA);
  const second = await makeListing(sellerA, { type: "used", stock: 1 });
  const order = (
    await checkout(buyer, [
      { listingId: first.id, quantity: 2 },
      { listingId: second.id, quantity: 1 },
    ])
  ).body.order;
  const sub = order.subOrders[0];
  const originalUpdate = Listing.updateOne;
  vi.spyOn(Listing, "updateOne")
    .mockImplementationOnce(function (...args) {
      return originalUpdate.apply(this, args);
    })
    .mockRejectedValueOnce(new Error("restore test failure"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await patchSub(sub._id, "cancel", buyer)).status).toBe(500);
  expect((await SubOrder.findById(sub._id)).status).toBe("pending");
  expect((await Listing.findById(first.id)).stock).toBe(8);
  expect((await Listing.findById(second.id)).stock).toBe(0);
  expect((await Listing.findById(second.id)).status).toBe("sold");
  expect((await patchSub(sub._id, "cancel", buyer)).status).toBe(200);
  expect((await Listing.findById(first.id)).stock).toBe(10);
  expect((await Listing.findById(second.id)).stock).toBe(1);
});

it("transaction đọc dữ liệu chưa commit không rò ra ngoài khi đặt thất bại", async () => {
  const listing = await makeListing(sellerA);
  await expect(
    withOrderTransaction(async (session) => {
      await Listing.updateOne(
        { _id: listing.id },
        { $inc: { stock: -1 } },
        { session },
      );
      expect((await Listing.findById(listing.id)).stock).toBe(10);
      throw new Error("abort test");
    }),
  ).rejects.toThrow("abort test");
  expect((await Listing.findById(listing.id)).stock).toBe(10);
});

it("hoàn hàng sau hoàn tất hoàn kho đúng một lần", async () => {
  const listing = await makeListing(sellerA);
  const order = (
    await checkout(buyer, [{ listingId: listing.id, quantity: 2 }])
  ).body.order;
  const id = order.subOrders[0]._id;
  await patchSub(id, "confirm", sellerA);
  await patchSub(id, "ship", sellerA);
  const token = await adminToken();
  const url = "/admin/sub-orders/" + id + "/shipping";
  expect(
    (
      await request(app)
        .patch(url)
        .auth(token, { type: "bearer" })
        .send({ status: "delivered" })
    ).status,
  ).toBe(200);
  expect((await patchSub(id, "received", buyer)).status).toBe(200);
  expect(
    (
      await request(app)
        .get("/sub-orders/shop?status=finished")
        .auth(sellerA.token, { type: "bearer" })
    ).body.total,
  ).toBe(1);
  expect(
    (
      await request(app)
        .get("/admin/orders?status=finished")
        .auth(token, { type: "bearer" })
    ).body.total,
  ).toBe(1);
  expect(
    (
      await request(app)
        .patch(url)
        .auth(token, { type: "bearer" })
        .send({ status: "returned" })
    ).status,
  ).toBe(200);
  expect((await Listing.findById(listing.id)).stock).toBe(10);
  expect(
    (
      await request(app)
        .patch(url)
        .auth(token, { type: "bearer" })
        .send({ status: "returned" })
    ).status,
  ).toBe(409);
  expect((await Listing.findById(listing.id)).stock).toBe(10);
  expect((await patchSub(id, "ship", sellerA)).status).toBe(409);
});

it("xem đơn: buyer/admin xem đủ, seller chỉ đơn con mình, người lạ bị 403", async () => {
  const a = await makeListing(sellerA);
  const b = await makeListing(sellerB);
  const created = await checkout(buyer, [
    { listingId: a.id, quantity: 1 },
    { listingId: b.id, quantity: 1 },
  ]);
  const id = created.body.order._id;
  const own = await request(app)
    .get("/orders/" + id)
    .auth(buyer.token, { type: "bearer" });
  expect(own.body.order.subOrders).toHaveLength(2);
  const seller = await request(app)
    .get("/orders/" + id)
    .auth(sellerA.token, { type: "bearer" });
  expect(seller.body.order.subOrders).toHaveLength(1);
  expect(seller.body.order.subOrders[0].sellerId).toBe(sellerA.id);
  expect(seller.body.order.total).toBeUndefined();
  const stranger = await makeUser("stranger@example.com");
  expect(
    (
      await request(app)
        .get("/orders/" + id)
        .auth(stranger.token, { type: "bearer" })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .get("/admin/orders")
        .auth(buyer.token, { type: "bearer" })
    ).status,
  ).toBe(403);
  const admin = await Admin.create({
    name: "Admin",
    email: "admin@example.com",
    passwordHash,
  });
  const token = jwt.sign(
    { id: admin.id, accountType: "admin" },
    process.env.JWT_SECRET,
  );
  expect(
    (
      await request(app)
        .get("/orders/" + id)
        .auth(token, { type: "bearer" })
    ).body.order.subOrders,
  ).toHaveLength(2);
  expect(
    (await request(app).get("/admin/orders").auth(token, { type: "bearer" }))
      .body.total,
  ).toBe(1);
});

it("tab người mua lọc đúng phần đơn nhiều shop và số đếm không lộ dữ liệu tài khoản khác", async () => {
  const a = await makeListing(sellerA);
  const b = await makeListing(sellerB);
  const order = (
    await checkout(buyer, [
      { listingId: a.id, quantity: 1 },
      { listingId: b.id, quantity: 1 },
    ])
  ).body.order;
  const subA = order.subOrders.find((sub) => sub.sellerId === sellerA.id);
  const subB = order.subOrders.find((sub) => sub.sellerId === sellerB.id);
  expect((await patchSub(subA._id, "confirm", sellerA)).status).toBe(200);
  expect((await patchSub(subB._id, "cancel", buyer)).status).toBe(200);
  const query = (tab, account = buyer) =>
    request(app)
      .get("/orders/mine")
      .auth(account.token, { type: "bearer" })
      .query({ tab });
  const all = await query("all");
  expect(all.body.items[0].subOrders).toHaveLength(2);
  expect(all.body.counts).toEqual({
    all: 1,
    pending: 0,
    "to-ship": 1,
    "to-receive": 0,
    completed: 0,
    cancelled: 1,
  });
  const shipping = await query("to-ship");
  expect(shipping.body.total).toBe(1);
  expect(shipping.body.items[0].subOrders.map((sub) => sub._id)).toEqual([
    subA._id,
  ]);
  const cancelled = await query("cancelled");
  expect(cancelled.body.items[0].subOrders.map((sub) => sub._id)).toEqual([
    subB._id,
  ]);
  expect((await query("pending")).body.total).toBe(0);
  const other = await query("all", sellerA);
  expect(other.body.items).toEqual([]);
  expect(Object.values(other.body.counts).every((count) => count === 0)).toBe(
    true,
  );
  for (const url of [
    "/orders/mine?tab=refund",
    "/orders/mine?tab=pending&status=shipping",
    "/orders/mine?tab=pending&tab=completed",
  ]) {
    expect(
      (await request(app).get(url).auth(buyer.token, { type: "bearer" }))
        .status,
    ).toBe(400);
  }
});

it("tab nhận hàng gộp shipping/delivered/completed, đếm trước phân trang và không lặp đơn", async () => {
  const a = await makeListing(sellerA);
  const b = await makeListing(sellerB);
  const mixed = (
    await checkout(buyer, [
      { listingId: a.id, quantity: 1 },
      { listingId: b.id, quantity: 1 },
    ])
  ).body.order;
  const next = (await checkout(buyer, [{ listingId: a.id, quantity: 1 }])).body
    .order;
  for (const sub of [...mixed.subOrders, ...next.subOrders]) {
    const owner = sub.sellerId === sellerA.id ? sellerA : sellerB;
    await patchSub(sub._id, "confirm", owner);
    await patchSub(sub._id, "ship", owner);
  }
  const delivered = mixed.subOrders.find((sub) => sub.sellerId === sellerB.id);
  const token = await adminToken();
  await request(app)
    .patch("/admin/sub-orders/" + delivered._id + "/shipping")
    .auth(token, { type: "bearer" })
    .send({ status: "delivered" });
  const response = await request(app)
    .get("/orders/mine?tab=to-receive&limit=1&page=2")
    .auth(buyer.token, { type: "bearer" });
  expect(response.body).toMatchObject({
    total: 2,
    page: 2,
    pages: 2,
    counts: { all: 2, "to-receive": 2 },
  });
  expect(response.body.items[0].subOrders).toHaveLength(2);
  expect(
    new Set(response.body.items[0].subOrders.map((sub) => sub.status)),
  ).toEqual(new Set(["shipping", "delivered"]));
  await patchSub(delivered._id, "received", buyer);
  const completed = await request(app)
    .get("/orders/mine?tab=completed")
    .auth(buyer.token, { type: "bearer" });
  expect(completed.body.counts).toMatchObject({
    all: 2,
    "to-receive": 2,
    completed: 1,
  });
  expect(completed.body.items[0].subOrders.map((sub) => sub._id)).toEqual([
    delivered._id,
  ]);
  const nextSub = next.subOrders[0];
  await request(app)
    .patch("/admin/sub-orders/" + nextSub._id + "/shipping")
    .auth(token, { type: "bearer" })
    .send({ status: "delivered" });
  await patchSub(nextSub._id, "received", buyer);
  const merged = await request(app)
    .get("/orders/mine?tab=to-receive")
    .auth(buyer.token, { type: "bearer" });
  expect(merged.body).toMatchObject({
    total: 2,
    counts: { "to-receive": 2, completed: 2 },
  });
  expect(merged.body.items.flatMap((order) => order.subOrders)).toHaveLength(3);
  expect(
    new Set(
      merged.body.items.flatMap((order) =>
        order.subOrders.map((sub) => sub.status),
      ),
    ),
  ).toEqual(new Set(["shipping", "completed"]));
});

it("phân trang đơn mine/shop độc lập theo tài khoản và lọc status", async () => {
  const listing = await makeListing(sellerA);
  for (let i = 0; i < 3; i++)
    expect(
      (await checkout(buyer, [{ listingId: listing.id, quantity: 1 }])).status,
    ).toBe(201);
  const page = await request(app)
    .get("/orders/mine?page=2&limit=1")
    .auth(buyer.token, { type: "bearer" });
  expect(page.body).toMatchObject({ total: 3, page: 2, pages: 3 });
  expect(page.body.items).toHaveLength(1);
  expect(
    (
      await request(app)
        .get("/orders/mine")
        .auth(sellerB.token, { type: "bearer" })
    ).body.total,
  ).toBe(0);
  expect(
    (
      await request(app)
        .get("/sub-orders/shop?status=pending&limit=2")
        .auth(sellerA.token, { type: "bearer" })
    ).body.total,
  ).toBe(3);
  expect(
    (
      await request(app)
        .get("/sub-orders/shop")
        .auth(sellerB.token, { type: "bearer" })
    ).body.total,
  ).toBe(0);
  expect(
    (
      await request(app)
        .get("/orders/mine?limit=0")
        .auth(buyer.token, { type: "bearer" })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .get("/sub-orders/shop?status=bad")
        .auth(sellerA.token, { type: "bearer" })
    ).status,
  ).toBe(400);
});

it("buyer hủy pending đúng một lần kể cả gọi đồng thời, hoàn mới và cũ", async () => {
  const a = await makeListing(sellerA);
  const b = await makeListing(sellerA, { type: "used", stock: 1 });
  const order = (
    await checkout(buyer, [
      { listingId: a.id, quantity: 2 },
      { listingId: b.id, quantity: 1 },
    ])
  ).body.order;
  const path = "/sub-orders/" + order.subOrders[0]._id + "/cancel";
  const results = await Promise.all([
    request(app).patch(path).auth(buyer.token, { type: "bearer" }).send({}),
    request(app).patch(path).auth(buyer.token, { type: "bearer" }).send({}),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  expect((await Listing.findById(a.id)).stock).toBe(10);
  expect((await Listing.findById(b.id)).status).toBe("approved");
  expect(
    (await SubOrder.findById(order.subOrders[0]._id)).shipment.events,
  ).toHaveLength(2);
  expect(
    (
      await request(app)
        .patch(path)
        .auth(buyer.token, { type: "bearer" })
        .send({})
    ).status,
  ).toBe(409);
  expect((await Listing.findById(a.id)).stock).toBe(10);
});

it("seller hủy cần lý do; buyer không hủy confirmed, người khác không hủy được", async () => {
  const listing = await makeListing(sellerA);
  const order = (
    await checkout(buyer, [{ listingId: listing.id, quantity: 1 }])
  ).body.order;
  const sub = order.subOrders[0];
  const path = "/sub-orders/" + sub._id + "/cancel";
  expect(
    (
      await request(app)
        .patch(path)
        .auth(sellerB.token, { type: "bearer" })
        .send({ reason: "x" })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(path)
        .auth(sellerA.token, { type: "bearer" })
        .send({})
    ).status,
  ).toBe(400);
  await SubOrder.updateOne({ _id: sub._id }, { $set: { status: "confirmed" } });
  expect(
    (
      await request(app)
        .patch(path)
        .auth(buyer.token, { type: "bearer" })
        .send({})
    ).status,
  ).toBe(409);
  const cancelled = await request(app)
    .patch(path)
    .auth(sellerA.token, { type: "bearer" })
    .send({ reason: " Hết sách do hỏng " });
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.subOrder.cancelReason).toBe("Hết sách do hỏng");
  expect((await Listing.findById(listing.id)).stock).toBe(10);
});

async function adminToken() {
  const admin = await Admin.create({
    name: "Admin",
    email: "admin@example.com",
    passwordHash,
  });
  return jwt.sign(
    { id: admin.id, accountType: "admin" },
    process.env.JWT_SECRET,
  );
}
function patchSub(id, action, account, body = {}) {
  return request(app)
    .patch("/sub-orders/" + id + "/" + action)
    .auth(account.token, { type: "bearer" })
    .send(body);
}

it("dịch vụ công khai dùng đúng cấu hình; toàn bộ luồng giao thành công có timeline", async () => {
  const services = await request(app).get("/shipping/services");
  expect(services.status).toBe(200);
  expect(services.body.items).toEqual([
    { id: "standard", name: "Tiết kiệm", fee: 25000, days: "3–5 ngày" },
    { id: "fast", name: "Nhanh", fee: 40000, days: "1–2 ngày" },
  ]);
  const listing = await makeListing(sellerA);
  const order = (
    await checkout(buyer, [{ listingId: listing.id, quantity: 1 }])
  ).body.order;
  const id = order.subOrders[0]._id;
  const newOrderNotifications = await request(app)
    .get("/notifications")
    .auth(sellerA.token, { type: "bearer" });
  expect(newOrderNotifications.body.items).toHaveLength(1);
  expect(newOrderNotifications.body.items[0]).toMatchObject({
    status: "pending",
    title: "Bạn có đơn hàng mới",
  });
  const confirmed = await patchSub(id, "confirm", sellerA);
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.subOrder.shipment.trackingCode).toMatch(
    /^BM[A-F0-9]{8}$/,
  );
  expect((await patchSub(id, "ship", sellerA)).status).toBe(200);
  const token = await adminToken();
  const delivered = await request(app)
    .patch("/admin/sub-orders/" + id + "/shipping")
    .auth(token, { type: "bearer" })
    .send({ status: "delivered", note: " Giao tận tay " });
  expect(delivered.status).toBe(200);
  expect(delivered.body.subOrder.shipment.events.at(-1).note).toBe(
    "Giao tận tay",
  );
  expect((await patchSub(id, "received", buyer)).status).toBe(200);
  const stored = await SubOrder.findById(id);
  expect(stored.status).toBe("completed");
  expect(stored.shipment.events.map((event) => event.status)).toEqual([
    "pending",
    "confirmed",
    "shipping",
    "delivered",
    "completed",
  ]);
  expect((await Listing.findById(listing.id)).stock).toBe(9);
  const buyerNotifications = await request(app)
    .get("/notifications")
    .auth(buyer.token, { type: "bearer" });
  expect(buyerNotifications.body.unread).toBe(3);
  expect(buyerNotifications.body.items.map((item) => item.status)).toEqual([
    "delivered",
    "shipping",
    "confirmed",
  ]);
  const sellerNotifications = await request(app)
    .get("/notifications")
    .auth(sellerA.token, { type: "bearer" });
  expect(sellerNotifications.body.items.map((item) => item.status)).toEqual([
    "completed",
    "delivered",
    "pending",
  ]);
  expect(
    (
      await request(app)
        .patch(`/notifications/${buyerNotifications.body.items[0].id}/read`)
        .auth(buyer.token, { type: "bearer" })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .patch("/notifications/read-all")
        .auth(buyer.token, { type: "bearer" })
    ).body.unread,
  ).toBe(0);
});

it("quyền và chuyển sai bị chặn, confirmed lặp không sinh mã vận đơn mới", async () => {
  const listing = await makeListing(sellerA);
  const order = (
    await checkout(buyer, [{ listingId: listing.id, quantity: 1 }])
  ).body.order;
  const id = order.subOrders[0]._id;
  expect((await patchSub(id, "confirm", sellerB)).status).toBe(403);
  expect((await patchSub(id, "confirm", buyer)).status).toBe(403);
  expect((await patchSub(id, "ship", sellerA)).status).toBe(409);
  expect((await patchSub(id, "received", buyer)).status).toBe(409);
  const confirmed = await patchSub(id, "confirm", sellerA);
  expect((await patchSub(id, "confirm", sellerA)).status).toBe(409);
  expect((await SubOrder.findById(id)).shipment.trackingCode).toBe(
    confirmed.body.subOrder.shipment.trackingCode,
  );
  expect((await patchSub(id, "ship", sellerB)).status).toBe(403);
  expect((await patchSub(id, "received", sellerA)).status).toBe(403);
  expect(
    (
      await request(app)
        .patch("/admin/sub-orders/" + id + "/shipping")
        .auth(buyer.token, { type: "bearer" })
        .send({ status: "delivered" })
    ).status,
  ).toBe(403);
  const token = await adminToken();
  expect(
    (
      await request(app)
        .patch("/admin/sub-orders/" + id + "/shipping")
        .auth(token, { type: "bearer" })
        .send({ status: "delivered" })
    ).status,
  ).toBe(409);
  await patchSub(id, "ship", sellerA);
  expect(
    (await patchSub(id, "cancel", sellerA, { reason: "Muộn" })).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .patch("/admin/sub-orders/" + id + "/shipping")
        .auth(token, { type: "bearer" })
        .send({ status: "completed" })
    ).status,
  ).toBe(400);
});

it("hoàn hàng đồng thời chỉ hoàn kho một lần cho cả sách mới/cũ", async () => {
  const a = await makeListing(sellerA);
  const b = await makeListing(sellerA, { type: "used", stock: 1 });
  const order = (
    await checkout(buyer, [
      { listingId: a.id, quantity: 2 },
      { listingId: b.id, quantity: 1 },
    ])
  ).body.order;
  const id = order.subOrders[0]._id;
  await patchSub(id, "confirm", sellerA);
  await patchSub(id, "ship", sellerA);
  const token = await adminToken();
  const path = "/admin/sub-orders/" + id + "/shipping";
  const results = await Promise.all([
    request(app)
      .patch(path)
      .auth(token, { type: "bearer" })
      .send({ status: "returned" }),
    request(app)
      .patch(path)
      .auth(token, { type: "bearer" })
      .send({ status: "returned" }),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  expect((await Listing.findById(a.id)).stock).toBe(10);
  expect((await Listing.findById(b.id)).status).toBe("approved");
  expect(
    (await SubOrder.findById(id)).shipment.events.map((event) => event.status),
  ).toEqual(["pending", "confirmed", "shipping", "returned"]);
  expect((await patchSub(id, "received", buyer)).status).toBe(409);
  expect(
    (
      await request(app)
        .get("/admin/sub-orders?status=returned&limit=1")
        .auth(token, { type: "bearer" })
    ).body.total,
  ).toBe(1);
  expect(
    (
      await request(app)
        .get("/admin/orders?status=shipping")
        .auth(token, { type: "bearer" })
    ).body.total,
  ).toBe(0);
});

it("không sửa/xóa tin khi đơn còn xử lý, hủy xong mới cho xóa", async () => {
  const listing = await makeListing(sellerA);
  const order = (
    await checkout(buyer, [{ listingId: listing.id, quantity: 1 }])
  ).body.order;
  expect(
    (
      await request(app)
        .patch("/listings/" + listing.id)
        .auth(sellerA.token, { type: "bearer" })
        .send({ price: 100 })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .delete("/listings/" + listing.id)
        .auth(sellerA.token, { type: "bearer" })
    ).status,
  ).toBe(409);
  await patchSub(order.subOrders[0]._id, "cancel", buyer);
  expect(
    (
      await request(app)
        .delete("/listings/" + listing.id)
        .auth(sellerA.token, { type: "bearer" })
    ).status,
  ).toBe(204);
  expect((await SubOrder.findById(order.subOrders[0]._id)).items[0].title).toBe(
    "Nhà giả kim",
  );
});

it("script cleanup cần xác nhận, backup trước xóa và giữ tài khoản có đơn", async () => {
  const listing = await makeListing(sellerA);
  const disposable = await makeListing(sellerB);
  await checkout(buyer, [{ listingId: listing.id, quantity: 1 }]);
  await User.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(buyer.id) },
    { $set: { isActive: true } },
  );
  await Listing.collection.updateOne(
    { _id: listing.id },
    { $set: { searchText: "legacy" } },
  );
  await mongoose.connection.db
    .collection("refreshsessions")
    .insertOne({ tokenHash: "unused" });
  const run = promisify(execFile);
  const env = { ...process.env, MONGO_URI: uri, NODE_ENV: "development" };
  const skipped = await run(
    process.execPath,
    ["scripts/clean-test-data.js", "--confirm=WRONG"],
    { env, timeout: 15000 },
  );
  expect(skipped.stdout).toContain("không sửa dữ liệu");
  expect(await User.countDocuments()).toBe(3);
  const done = await run(
    process.execPath,
    ["scripts/clean-test-data.js", "--confirm=" + database],
    { env, timeout: 15000 },
  );
  expect(done.stdout).toContain("Backup:");
  expect(await User.findById(sellerB.id)).toBeNull();
  expect(await Shop.findOne({ ownerId: sellerB.id })).toBeNull();
  expect(await Listing.findById(disposable.id)).toBeNull();
  expect(await User.findById(buyer.id)).not.toBeNull();
  expect(await User.findById(sellerA.id)).not.toBeNull();
  expect(
    (
      await User.collection.findOne({
        _id: new mongoose.Types.ObjectId(buyer.id),
      })
    ).isActive,
  ).toBeUndefined();
  expect(
    (await Listing.collection.findOne({ _id: listing.id })).searchText,
  ).toBeUndefined();
  expect(
    await mongoose.connection.db
      .listCollections({ name: "refreshsessions" })
      .hasNext(),
  ).toBe(false);
  expect(await Order.countDocuments()).toBe(1);
});
