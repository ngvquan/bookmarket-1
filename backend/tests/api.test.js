// Test quyền và dữ liệu chính trên DB test riêng; không xóa database ứng dụng.
import "dotenv/config";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Shop from "../src/models/Shop.js";
import Listing from "../src/models/Listing.js";
import {
  allModels,
  Admin,
  Edition,
  Book,
  Author,
  Publisher,
  Category,
} from "../src/models/index.js";
import { normalizeDatabase } from "../src/migrations/normalize-database.js";
import { registrationData } from "./fixtures/shop-registration.js";
import { publishPendingListings } from "../src/migrations/publish-listings.js";
const uri =
  process.env.TEST_MONGO_URI ||
  "mongodb://127.0.0.1:27017/bookmarket_test_simple";
const database = new URL(uri).pathname.slice(1);
if (!/^bookmarket_test(?:_[a-z0-9]+)?$/i.test(database)) {
  throw new Error(
    "Chỉ được dùng database bookmarket_test hoặc bookmarket_test_*.",
  );
}
process.env.JWT_SECRET = randomBytes(48).toString("hex");
beforeAll(async () => {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  for (const model of allModels) await model.init();
});
beforeEach(async () => {
  for (const model of allModels) await model.deleteMany({});
});
afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

// Tạo tài khoản thật qua API để mỗi test tự chuẩn bị dữ liệu độc lập.
async function register(email = "a@example.com") {
  const response = await request(app).post("/auth/register").send({
    name: "Bạn đọc",
    email,
    password: "abc123",
  });
  expect(response.status).toBe(201);
  return response.body;
}
async function makeAdmin() {
  await Admin.create({
    name: "Admin test",
    email: "admin@example.com",
    passwordHash: await bcrypt.hash("abc123", 12),
  });
  const response = await request(app).post("/admin/auth/login").send({
    email: "admin@example.com",
    password: "abc123",
  });
  expect(response.status).toBe(200);
  return response.body;
}
const usedBook = {
  type: "used",
  title: "Nhà giả kim",
  author: "Paulo Coelho",
  isbn: "9780000000026",
  category: "Văn học",
  description: "Sách sạch, đủ trang.",
  price: 42000,
  condition: "Còn tốt",
  binding: "Bìa mềm",
};
async function postBook(account, body = usedBook) {
  const response = await request(app)
    .post("/listings")
    .auth(account.token, {
      type: "bearer",
    })
    .send(body);
  expect(response.status).toBe(201);
  return response.body.listing;
}
it("đổi tên, quản lý tối đa 3 địa chỉ và lưu yêu thích theo tài khoản", async () => {
  const account = await register("profile@example.com");
  const auth = request(app);
  const headers = { Authorization: `Bearer ${account.token}` };
  const renamed = await auth
    .patch("/auth/profile")
    .set(headers)
    .send({ name: "Bạn đọc mới" });
  expect(renamed.status).toBe(200);
  expect(renamed.body.user.name).toBe("Bạn đọc mới");
  const base = (index) => ({
    label: `Địa chỉ ${index}`,
    receiverName: "Nguyễn An",
    phone: "0901234567",
    address: `${index} Đường Sách, TP.HCM`,
    isDefault: index === 1,
  });
  for (let index = 1; index <= 3; index++)
    expect(
      (await auth.post("/auth/addresses").set(headers).send(base(index)))
        .status,
    ).toBe(201);
  const duplicate = await auth
    .post("/auth/addresses")
    .set(headers)
    .send(base(2));
  expect(duplicate.status).toBe(200);
  expect(duplicate.body.duplicate).toBe(true);
  expect(
    (await auth.post("/auth/addresses").set(headers).send(base(4))).status,
  ).toBe(409);
  let me = await auth.get("/auth/me").set(headers);
  expect(me.body.user.addresses).toHaveLength(3);
  const second = me.body.user.addresses[1];
  const edited = await auth
    .patch(`/auth/addresses/${second.id}`)
    .set(headers)
    .send({ ...base(2), label: "Công ty", isDefault: true });
  expect(
    edited.body.user.addresses.find((item) => item.id === second.id),
  ).toMatchObject({ label: "Công ty", isDefault: true });
  expect(
    edited.body.user.addresses.filter((item) => item.isDefault),
  ).toHaveLength(1);
  expect(
    (await auth.delete(`/auth/addresses/${second.id}`).set(headers)).body.user
      .addresses,
  ).toHaveLength(2);
  const seller = await register("favorite-seller@example.com");
  const listing = await postBook(seller);
  expect(
    (await auth.put(`/auth/favorites/${listing.id}`).set(headers).send({})).body
      .favorites,
  ).toEqual([listing.id]);
  expect(
    (await auth.put(`/auth/favorites/${listing.id}`).set(headers).send({})).body
      .favorites,
  ).toEqual([listing.id]);
  me = await auth.get("/auth/me").set(headers);
  expect(me.body.user.favorites).toEqual([listing.id]);
  expect(
    (await auth.delete(`/auth/favorites/${listing.id}`).set(headers)).body
      .favorites,
  ).toEqual([]);
});
it("form rút gọn đăng/sửa sách cũ và trao đổi không cần condition hoặc binding, giữ phiên bản ISBN có sẵn", async () => {
  const seller = await register();
  const original = await postBook(seller, { ...usedBook, binding: "Bìa cứng" });
  const simplified = { ...usedBook, condition: undefined, binding: undefined };
  const used = await postBook(seller, simplified);
  expect(used.editionId).toBe(original.editionId);
  expect(used.binding).toBe("Bìa cứng");
  expect(used.condition).toBeUndefined();
  expect(used.stock).toBe(1);
  const edited = await request(app)
    .patch(`/listings/${used.id}`)
    .auth(seller.token, { type: "bearer" })
    .send({ price: 45000 });
  expect(edited.status).toBe(200);
  expect(edited.body.listing.editionId).toBe(original.editionId);
  expect(edited.body.listing.binding).toBe("Bìa cứng");
});
it("đăng ký: hash mật khẩu, email unique, JWT 7 ngày, không cấp role từ body", async () => {
  const account = await register(" A@EXAMPLE.COM ");
  const stored = await User.findById(account.user.id).select("+passwordHash");
  expect(stored.email).toBe("a@example.com");
  expect(await bcrypt.compare("abc123", stored.passwordHash)).toBe(true);
  expect(account.user.passwordHash).toBeUndefined();
  expect(account.user.role).toBe("user");
  const token = jwt.verify(account.token, process.env.JWT_SECRET);
  expect(token.exp - token.iat).toBe(7 * 86400);
  expect(
    (
      await request(app).post("/auth/register").send({
        name: "X",
        email: "a@example.com",
        password: "abc123",
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app).post("/auth/register").send({
        name: "X",
        email: "x@example.com",
        password: "abc123",
        role: "admin",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app).post("/auth/register").send({
        name: "   ",
        email: "x@example.com",
        password: "abc123",
      })
    ).status,
  ).toBe(400);
});
it("đăng nhập và me: nhận token đúng, từ chối sai mật khẩu/token hết hạn", async () => {
  const account = await register();
  const login = await request(app).post("/auth/login").send({
    email: "A@EXAMPLE.COM",
    password: "abc123",
  });
  expect(login.status).toBe(200);
  expect(
    (
      await request(app).get("/auth/me").auth(login.body.token, {
        type: "bearer",
      })
    ).body.user.id,
  ).toBe(account.user.id);
  expect(
    (
      await request(app).post("/auth/login").send({
        email: "a@example.com",
        password: "wrong1",
      })
    ).status,
  ).toBe(401);
  expect((await request(app).get("/auth/me")).status).toBe(401);
  const expired = jwt.sign(
    {
      id: account.user.id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: -1,
    },
  );
  expect(
    (
      await request(app).get("/auth/me").auth(expired, {
        type: "bearer",
      })
    ).status,
  ).toBe(401);
  expect((await request(app).post("/auth/refresh")).status).toBe(404);
});
it("seller A không sửa/xóa hoặc xem tin riêng của seller B", async () => {
  const a = await register();
  const b = await register("b@example.com");
  const book = await postBook(b);
  expect(
    (
      await request(app)
        .patch(`/listings/${book.id}`)
        .auth(a.token, {
          type: "bearer",
        })
        .send({
          title: "Đổi tên",
        })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app).delete(`/listings/${book.id}`).auth(a.token, {
        type: "bearer",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .get("/listings/mine")
        .auth(a.token, {
          type: "bearer",
        })
        .query({
          seller: b.user.id,
        })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(`/listings/${book.id}`)
        .auth(b.token, {
          type: "bearer",
        })
        .send({
          title: "Tên đã sửa",
        })
    ).body.listing.isbn,
  ).toBe(book.isbn);
});
it("đăng/sửa sách hiển thị ngay; user không tự bỏ trạng thái admin đã ẩn", async () => {
  const user = await register();
  const admin = await makeAdmin();
  const book = await postBook(user);
  expect(book.status).toBe("approved");
  expect((await request(app).get(`/listings/${book.id}`)).status).toBe(200);
  expect(
    (
      await request(app)
        .patch(`/listings/${book.id}/moderation`)
        .auth(user.token, {
          type: "bearer",
        })
        .send({
          status: "approved",
        })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app).get("/listings/admin").auth(user.token, {
        type: "bearer",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(`/listings/${book.id}/moderation`)
        .auth(admin.token, {
          type: "bearer",
        })
        .send({
          status: "approved",
        })
    ).status,
  ).toBe(200);
  expect((await request(app).get(`/listings/${book.id}`)).status).toBe(200);
  const edited = await request(app)
    .patch(`/listings/${book.id}`)
    .auth(user.token, {
      type: "bearer",
    })
    .send({
      description: "  Đã sửa mô tả.  ",
    });
  expect(edited.body.listing.status).toBe("approved");
  expect(edited.body.listing.description).toBe("Đã sửa mô tả.");
  expect((await request(app).get(`/listings/${book.id}`)).status).toBe(200);
  await request(app)
    .patch(`/listings/${book.id}/moderation`)
    .auth(admin.token, { type: "bearer" })
    .send({ status: "hidden" });
  const hiddenEdit = await request(app)
    .patch(`/listings/${book.id}`)
    .auth(user.token, { type: "bearer" })
    .send({ description: "Sửa tin đã ẩn" });
  expect(hiddenEdit.body.listing.status).toBe("hidden");
  expect((await request(app).get(`/listings/${book.id}`)).status).toBe(404);
});

it("bỏ hàng chờ cũ có backup, không mở tin đã ẩn/từ chối và chạy lại không đổi", async () => {
  const seller = await register();
  const pending = await postBook(seller);
  const hidden = await postBook(seller);
  const rejected = await postBook(seller);
  await Listing.updateOne({ _id: pending.id }, { status: "pending" });
  await Listing.updateOne({ _id: hidden.id }, { status: "hidden" });
  await Listing.updateOne({ _id: rejected.id }, { status: "rejected" });
  expect(await publishPendingListings()).toMatchObject({
    pending: 1,
    published: 0,
  });
  expect((await Listing.findById(pending.id)).status).toBe("pending");
  const result = await publishPendingListings({ apply: true });
  expect(result.backup).toBeTruthy();
  expect(result.published).toBe(1);
  expect((await Listing.findById(pending.id)).status).toBe("approved");
  expect((await Listing.findById(hidden.id)).status).toBe("hidden");
  expect((await Listing.findById(rejected.id)).status).toBe("rejected");
  expect((await publishPendingListings({ apply: true })).published).toBe(0);
});
it("ba seller cùng ISBN: tìm không dấu/prefix, lọc/sort/phân trang, loại tin không công khai", async () => {
  const admin = await makeAdmin();
  for (let i = 0; i < 3; i++) {
    const seller = await register(`seller${i}@example.com`);
    const book = await postBook(seller, {
      ...usedBook,
      price: 42000 + i * 10000,
    });
    await request(app)
      .patch(`/listings/${book.id}/moderation`)
      .auth(admin.token, {
        type: "bearer",
      })
      .send({
        status: "approved",
      });
  }
  const hidden = await postBook(await register("hidden@example.com"));
  await Listing.updateOne({ _id: hidden.id }, { status: "hidden" });
  const found = await request(app).get("/listings").query({
    q: "nha gia kim",
    sort: "price-up",
    page: 1,
    limit: 2,
  });
  expect(found.body.total).toBe(3);
  expect(found.body.pages).toBe(2);
  expect(found.body.items).toHaveLength(2);
  expect(found.body.items[0].price).toBe(42000);
  const sellers = await request(app).get("/listings/sellers").query({
    page: 1,
    limit: 2,
  });
  expect(sellers.body.total).toBe(3);
  expect(sellers.body.items).toHaveLength(2);
  expect(
    (
      await request(app).get("/listings").query({
        isbn: "978000",
        page: 2,
        limit: 2,
      })
    ).body.items,
  ).toHaveLength(1);
  expect(
    (
      await request(app).get("/listings").query({
        q: "9",
      })
    ).body.total,
  ).toBe(0);
  expect(
    (
      await request(app).get("/listings").query({
        author: "coelho",
        min: 50000,
        max: 60000,
        condition: "Còn tốt",
        binding: "Bìa mềm",
      })
    ).body.total,
  ).toBe(1);
  expect(
    (
      await request(app).get("/listings").query({
        seller: found.body.items[0].sellerId,
      })
    ).body.total,
  ).toBe(1);
});
it("catalog gộp theo phiên bản trước phân trang, chọn giá thấp nhất và giữ đủ offer trong chi tiết/quản lý", async () => {
  const seller = await register();
  const cheapest = await postBook(seller);
  await postBook(seller, { ...usedBook, price: 52000 });
  await postBook(seller, { ...usedBook, price: 62000 });
  const another = await postBook(seller, {
    ...usedBook,
    title: "A - Cuốn sách khác",
    isbn: "9780000000033",
    price: 70000,
  });
  const missingIsbn = await request(app)
    .post("/listings")
    .auth(seller.token, { type: "bearer" })
    .send({ ...usedBook, isbn: "", price: 80000 });
  expect(missingIsbn.status).toBe(400);
  expect(missingIsbn.body.message).toContain("ISBN là bắt buộc");
  await Listing.updateMany({}, { status: "approved" });
  const hidden = await postBook(seller, { ...usedBook, price: 1000 });
  await Listing.updateOne({ _id: hidden.id }, { status: "hidden" });
  const query = {
    type: "physical",
    group: "edition",
    sort: "price-up",
    limit: 1,
  };
  const ids = [];
  for (let page = 1; page <= 2; page++) {
    const response = await request(app)
      .get("/listings")
      .query({ ...query, page });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2, pages: 2, page });
    expect(response.body.items).toHaveLength(1);
    ids.push(response.body.items[0].editionId);
    if (page === 1)
      expect(response.body.items[0]).toMatchObject({
        id: cheapest.id,
        price: 42000,
        offerCount: 3,
      });
  }
  expect(new Set(ids).size).toBe(2);
  const filtered = await request(app)
    .get("/listings")
    .query({ ...query, min: 50000 });
  expect(filtered.body.items[0]).toMatchObject({ price: 52000, offerCount: 2 });
  const title = await request(app)
    .get("/listings")
    .query({ ...query, sort: "title" });
  expect(title.body.items[0].id).toBe(another.id);
  const details = await request(app)
    .get("/listings")
    .query({ edition: cheapest.editionId });
  expect(details.body.total).toBe(3);
  expect(
    details.body.items.every((item) => item.editionId === cheapest.editionId),
  ).toBe(true);
  const mine = await request(app)
    .get("/listings/mine")
    .auth(seller.token, { type: "bearer" })
    .query({ group: "edition", limit: 50 });
  expect(mine.body.total).toBe(5);
  expect(mine.body.items.every((item) => item.offerCount === undefined)).toBe(
    true,
  );
  expect(
    (await request(app).get("/listings").query({ group: "book" })).status,
  ).toBe(400);
  expect(
    (await request(app).get("/listings").query({ edition: "bad" })).status,
  ).toBe(400);
});

it("physical gộp sách mới và cũ trước phân trang, không gồm ebook, trao đổi hoặc tin hết hiệu lực", async () => {
  const seller = await register();
  await request(app)
    .post("/shops")
    .auth(seller.token, { type: "bearer" })
    .send(
      registrationData({
        name: "Shop test",
        description: "Sách giấy và ebook",
      }),
    );
  const used = await postBook(seller);
  const fresh = await postBook(seller, {
    ...usedBook,
    type: "new",
    stock: 3,
    condition: undefined,
    price: 60000,
  });
  const digital = await postBook(seller, {
    ...usedBook,
    type: "digital",
    isbn: "9780000000040",
    price: 10000,
  });
  const empty = await postBook(seller, {
    ...usedBook,
    type: "new",
    stock: 0,
    condition: undefined,
  });
  const sold = await postBook(seller);
  const hidden = await postBook(seller);
  await Listing.updateOne({ _id: hidden.id }, { status: "hidden" });
  await Listing.updateMany(
    { _id: { $in: [used.id, fresh.id, digital.id, empty.id] } },
    { status: "approved" },
  );
  await Listing.updateOne({ _id: sold.id }, { status: "sold" });
  const first = await request(app)
    .get("/listings")
    .query({ type: "physical", sort: "price-up", limit: 1 });
  expect(first.status).toBe(200);
  expect(first.body).toMatchObject({ total: 2, pages: 2, page: 1 });
  expect(first.body.items.map((book) => book.id)).toEqual([used.id]);
  const second = await request(app)
    .get("/listings")
    .query({ type: "physical", sort: "price-up", limit: 1, page: 2 });
  expect(second.body.items.map((book) => book.id)).toEqual([fresh.id]);
  for (const [condition, id] of [
    ["Mới", fresh.id],
    ["Còn tốt", used.id],
  ]) {
    const filtered = await request(app)
      .get("/listings")
      .query({ type: "physical", condition });
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items[0].id).toBe(id);
  }
});

it("tin sách cũ đã sold không được sửa và không còn công khai", async () => {
  const seller = await register();
  const admin = await makeAdmin();
  const book = await postBook(seller);
  await request(app)
    .patch(`/listings/${book.id}/moderation`)
    .auth(admin.token, {
      type: "bearer",
    })
    .send({
      status: "approved",
    });
  expect(
    (
      await request(app).patch(`/listings/${book.id}/sold`).auth(seller.token, {
        type: "bearer",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .patch(`/listings/${book.id}`)
        .auth(seller.token, {
          type: "bearer",
        })
        .send({
          price: 50000,
        })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .patch(`/listings/${book.id}/moderation`)
        .auth(admin.token, {
          type: "bearer",
        })
        .send({
          status: "approved",
        })
    ).status,
  ).toBe(409);
  expect((await request(app).get(`/listings/${book.id}`)).status).toBe(404);
});
it("shop một chủ, chỉ chủ xem/sửa; new/digital cần shop", async () => {
  const a = await register();
  const b = await register("b@example.com");
  const draft = {
    ...usedBook,
    type: "new",
    stock: 5,
    condition: undefined,
  };
  expect(
    (
      await request(app)
        .post("/listings")
        .auth(a.token, {
          type: "bearer",
        })
        .send(draft)
    ).status,
  ).toBe(400);
  const shop = await request(app)
    .post("/shops")
    .auth(a.token, {
      type: "bearer",
    })
    .send(
      registrationData({
        name: " Shop A ",
        description: " Tiệm sách nhỏ. ",
      }),
    );
  expect(shop.status).toBe(201);
  expect(shop.body.shop.name).toBe("Shop A");
  expect(
    (
      await request(app)
        .post("/shops")
        .auth(a.token, {
          type: "bearer",
        })
        .send(
          registrationData({
            name: "Khác",
            description: "Tiệm khác",
          }),
        )
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app).get(`/shops/${shop.body.shop.id}`).auth(b.token, {
        type: "bearer",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(`/shops/${shop.body.shop.id}`)
        .auth(b.token, {
          type: "bearer",
        })
        .send({
          name: "Chiếm shop",
        })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(`/shops/${shop.body.shop.id}`)
        .auth(a.token, {
          type: "bearer",
        })
        .send({
          name: "Tên mới",
        })
    ).status,
  ).toBe(200);
  expect((await postBook(a, draft)).shopId).toBe(shop.body.shop.id);
});
it("đăng ký shop yêu cầu hồ sơ đầy đủ và xác nhận; chuẩn hóa thông tin liên hệ", async () => {
  const account = await register();
  const post = (body) =>
    request(app)
      .post("/shops")
      .auth(account.token, { type: "bearer" })
      .send(body);
  expect(
    (await post({ name: "Shop mới", description: "Chỉ có thông tin cũ" }))
      .status,
  ).toBe(400);
  for (const changes of [
    { contactName: "" },
    { contactPhone: "123" },
    { contactEmail: "email sai" },
    { pickupAddress: { province: "Hà Nội" } },
    { registrationConfirmed: false },
    { ownerId: account.user.id },
    { isRegistrationComplete: true },
    { registrationCompletedAt: new Date().toISOString() },
  ]) {
    expect((await post(registrationData(changes))).status).toBe(400);
  }
  expect(await Shop.countDocuments()).toBe(0);
  const created = await post(
    registrationData({
      name: "  Tiệm sách mới  ",
      contactPhone: "+84 901 234 567",
      contactEmail: " SHOP@EXAMPLE.COM ",
    }),
  );
  expect(created.status).toBe(201);
  expect(created.body.shop).toMatchObject({
    name: "Tiệm sách mới",
    ownerId: account.user.id,
    contactPhone: "+84901234567",
    contactEmail: "shop@example.com",
  });
  expect(created.body.shop.registrationCompletedAt).toBeTruthy();
  expect(created.body.shop.isRegistrationComplete).toBe(true);
  const me = await request(app)
    .get("/auth/me")
    .auth(account.token, { type: "bearer" });
  expect(me.body.user.shop.pickupAddress.detail).toBe("12 Đường Sách");
  const changed = await request(app)
    .patch(`/shops/${created.body.shop.id}`)
    .auth(account.token, { type: "bearer" })
    .send({ contactPhone: "" });
  expect(changed.status).toBe(400);
});

it("hồ sơ đăng ký shop riêng tư và đăng ký đồng thời vẫn chỉ một shop", async () => {
  const owner = await register();
  const other = await register("other@example.com");
  const results = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post("/shops")
        .auth(owner.token, { type: "bearer" })
        .send(registrationData()),
    ),
  );
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(await Shop.countDocuments()).toBe(1);
  const shop = results.find((result) => result.status === 201).body.shop;
  expect(
    (
      await request(app)
        .get(`/shops/${shop.id}`)
        .auth(other.token, { type: "bearer" })
    ).status,
  ).toBe(403);
  expect((await request(app).get("/shops")).status).toBe(401);
  const listing = await postBook(owner, { ...usedBook, type: "new", stock: 2 });
  await Listing.updateOne({ _id: listing.id }, { status: "approved" });
  const publicListings = await request(app).get("/listings");
  const publicSellers = await request(app).get("/listings/sellers");
  const conversation = await request(app)
    .post("/conversations")
    .auth(other.token, { type: "bearer" })
    .send({ listingId: listing.id });
  for (const body of [
    publicListings.body,
    publicSellers.body,
    conversation.body,
  ]) {
    expect(JSON.stringify(body)).not.toContain("0901234567");
    expect(JSON.stringify(body)).not.toContain("shop@example.com");
    expect(JSON.stringify(body)).not.toContain("12 Đường Sách");
    expect(JSON.stringify(body)).not.toContain("123456789");
  }
});

it("shop cũ phải hoàn tất hồ sơ mới được đăng new/digital; sách cũ vẫn được đăng", async () => {
  const owner = await register();
  const legacy = await Shop.create({
    ownerId: owner.user.id,
    name: "Shop cũ",
    description: "Hồ sơ trước đăng ký riêng",
  });
  const changed = await request(app)
    .patch(`/shops/${legacy.id}`)
    .auth(owner.token, { type: "bearer" })
    .send({ name: "Shop cũ đổi tên", contactPhone: "0901234567" });
  expect(changed.status).toBe(200);
  expect(changed.body.shop.registrationCompletedAt).toBeNull();
  expect(changed.body.shop.name).toBe("Shop cũ đổi tên");
  expect(changed.body.shop.isRegistrationComplete).toBe(false);
  const used = await postBook(owner);
  for (const type of ["new", "digital"]) {
    const blocked = await request(app)
      .post("/listings")
      .auth(owner.token, { type: "bearer" })
      .send({ ...usedBook, type, stock: 2 });
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toContain("hoàn tất đăng ký shop");
    expect(
      (
        await request(app)
          .patch(`/listings/${used.id}`)
          .auth(owner.token, { type: "bearer" })
          .send({ type, stock: 2 })
      ).status,
    ).toBe(400);
  }
  const { registrationConfirmed, ...details } = registrationData();
  const completed = await request(app)
    .patch(`/shops/${legacy.id}`)
    .auth(owner.token, { type: "bearer" })
    .send(details);
  expect(completed.status).toBe(200);
  expect(completed.body.shop.isRegistrationComplete).toBe(true);
  expect(completed.body.shop.registrationCompletedAt).toBeTruthy();
  for (const type of ["new", "digital"])
    expect(
      (
        await postBook(owner, {
          ...usedBook,
          type,
          stock: 2,
          isbn: type === "digital" ? "9780000000040" : usedBook.isbn,
        })
      ).shopId,
    ).toBe(legacy.id);
});

it("validate thủ công: chống đổi owner, dữ liệu sai, hết kho; chuyển loại không sót giá/kho", async () => {
  const seller = await register();
  const admin = await makeAdmin();
  expect(
    (
      await request(app)
        .post("/listings")
        .auth(seller.token, {
          type: "bearer",
        })
        .send({
          ...usedBook,
          sellerId: admin.user.id,
        })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post("/listings")
        .auth(seller.token, {
          type: "bearer",
        })
        .send({
          ...usedBook,
          price: -1,
        })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app).get("/listings").query({
        page: 0,
      })
    ).status,
  ).toBe(400);
  const book = await postBook(seller);
  const changed = await request(app)
    .patch(`/listings/${book.id}`)
    .auth(seller.token, {
      type: "bearer",
    })
    .send({
      type: "exchange",
    });
  expect(changed.status).toBe(400);
  expect(changed.body.message).toBe("Loại tin không hợp lệ");
  await request(app)
    .post("/shops")
    .auth(seller.token, {
      type: "bearer",
    })
    .send(
      registrationData({
        name: "A",
        description: "Shop A",
      }),
    );
  const empty = await postBook(seller, {
    ...usedBook,
    type: "new",
    stock: 0,
  });
  await request(app)
    .patch(`/listings/${empty.id}/moderation`)
    .auth(admin.token, {
      type: "bearer",
    })
    .send({
      status: "approved",
    });
  expect((await request(app).get(`/listings/${empty.id}`)).status).toBe(404);
});
it("admin nằm riêng: cùng email vẫn không dùng user token để quản trị", async () => {
  const admin = await makeAdmin();
  expect(await User.countDocuments()).toBe(0);
  expect(await Admin.countDocuments()).toBe(1);
  expect(
    (
      await request(app).post("/auth/login").send({
        email: "admin@example.com",
        password: "abc123",
      })
    ).status,
  ).toBe(401);
  const user = await register("admin@example.com");
  expect((await User.findById(user.user.id)).role).toBeUndefined();
  expect(
    (
      await request(app).get("/admin/auth/me").auth(user.token, {
        type: "bearer",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app).get("/admin/auth/me").auth(admin.token, {
        type: "bearer",
      })
    ).body.user.accountType,
  ).toBe("admin");
  expect(
    (await request(app).post("/admin/auth/register").send({})).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post("/shops")
        .auth(admin.token, {
          type: "bearer",
        })
        .send({
          name: "X",
          description: "X",
        })
    ).status,
  ).toBe(403);
});
it("ba offer chung một edition; sửa metadata ISBN chung không tác động seller khác", async () => {
  const a = await register();
  const b = await register("b@example.com");
  const first = await postBook(a);
  const second = await postBook(b, {
    ...usedBook,
    price: 52000,
  });
  expect(first.editionId).toBe(second.editionId);
  expect(await Edition.countDocuments()).toBe(1);
  expect(await Book.countDocuments()).toBe(1);
  expect(await Author.countDocuments()).toBe(1);
  const raw = await mongoose.connection.db.collection("listings").findOne({
    _id: first.id,
  });
  expect(raw.title).toBeUndefined();
  expect(raw.isbn).toBeUndefined();
  expect(String(raw.editionId)).toBe(first.editionId);
  const changed = await request(app)
    .patch(`/listings/${first.id}`)
    .auth(a.token, {
      type: "bearer",
    })
    .send({
      title: "Tên không thuộc ISBN này",
    });
  expect(changed.status).toBe(409);
  const mine = await request(app).get("/listings/mine").auth(b.token, {
    type: "bearer",
  });
  expect(mine.body.items[0].title).toBe("Nhà giả kim");
  expect(
    (
      await request(app)
        .patch(`/listings/${first.id}`)
        .auth(a.token, {
          type: "bearer",
        })
        .send({
          price: 45000,
        })
    ).status,
  ).toBe(200);
});
it("hai phiên bản cùng tác phẩm; sửa một phiên bản không đổi tác phẩm của phiên bản khác", async () => {
  const a = await register();
  const first = await postBook(a);
  const second = await postBook(a, {
    ...usedBook,
    isbn: "9780000000033",
    binding: "Bìa cứng",
  });
  expect(second.bookId).toBe(first.bookId);
  expect(second.editionId).not.toBe(first.editionId);
  const changed = await request(app)
    .patch(`/listings/${second.id}`)
    .auth(a.token, {
      type: "bearer",
    })
    .send({
      title: "Một tác phẩm khác",
    });
  expect(changed.status).toBe(200);
  expect(changed.body.listing.bookId).not.toBe(first.bookId);
  const mine = await request(app).get("/listings/mine").auth(a.token, {
    type: "bearer",
  });
  expect(mine.body.items.find((item) => item.id === first.id).title).toBe(
    "Nhà giả kim",
  );
  const sorted = await request(app)
    .get("/listings/mine")
    .auth(a.token, {
      type: "bearer",
    })
    .query({
      sort: "title",
      page: 1,
      limit: 1,
    });
  expect(sorted.body.items[0].title).toBe("Một tác phẩm khác");
  expect(sorted.body.total).toBe(2);
  const filtered = await request(app)
    .get("/listings/mine")
    .auth(a.token, {
      type: "bearer",
    })
    .query({
      title: "nha gia",
      author: "coelho",
      category: "Văn học",
      binding: "Bìa mềm",
    });
  expect(filtered.body.total).toBe(1);
  const missing = await request(app)
    .post("/listings")
    .auth(a.token, { type: "bearer" })
    .send({ ...usedBook, isbn: "" });
  expect(missing.status).toBe(400);
  expect(missing.body.message).toContain("ISBN là bắt buộc");
});

it("gợi ý theo ISBN hoặc tên/tác giả và ghép tin mới vào phần so sánh giá", async () => {
  const firstSeller = await register();
  const secondSeller = await register("second@example.com");
  const first = await postBook(firstSeller);
  expect(
    (
      await request(app)
        .get("/listings/suggestions")
        .query({ title: "Nhà giả", type: "used" })
    ).status,
  ).toBe(401);
  const byTitle = await request(app)
    .get("/listings/suggestions")
    .auth(secondSeller.token, { type: "bearer" })
    .query({ title: "nha gia", author: "paulo", type: "used" });
  expect(byTitle.status).toBe(200);
  expect(byTitle.body.items[0]).toMatchObject({
    editionId: first.editionId,
    isbn: usedBook.isbn,
    title: usedBook.title,
    offerCount: 1,
  });
  const byIsbn = await request(app)
    .get("/listings/suggestions")
    .auth(secondSeller.token, { type: "bearer" })
    .query({ isbn: "978000", type: "used" });
  expect(byIsbn.body.items[0].editionId).toBe(first.editionId);
  const second = await postBook(secondSeller, { ...usedBook, price: 39000 });
  expect(second.editionId).toBe(first.editionId);
  const grouped = await request(app)
    .get("/listings")
    .query({ type: "physical", group: "edition" });
  expect(grouped.body.items[0]).toMatchObject({ price: 39000, offerCount: 2 });
});
it("migration giữ ID/hash/sold, tách admin và chạy lại không tạo trùng", async () => {
  const seller = await register();
  const oldAdmin = await register("old-admin@example.com");
  const oldHash = (
    await User.findById(oldAdmin.user.id).select("+passwordHash")
  ).passwordHash;
  await mongoose.connection.db.collection("users").updateOne(
    {
      _id: new mongoose.Types.ObjectId(oldAdmin.user.id),
    },
    {
      $set: {
        role: "admin",
        isActive: true,
      },
    },
  );
  await mongoose.connection.db.collection("listings").insertOne({
    _id: "legacy-sold",
    ...usedBook,
    sellerId: new mongoose.Types.ObjectId(seller.user.id),
    shopId: null,
    status: "sold",
    stock: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    style: "peace",
  });
  await mongoose.connection.db.collection("refreshsessions").insertOne({
    tokenHash: "old-unused-session",
  });
  const result = await normalizeDatabase();
  expect(result.convertedListings).toBe(1);
  expect(result.movedAdmins).toBe(1);
  expect(await User.findById(oldAdmin.user.id)).toBeNull();
  expect(
    (await Admin.findById(oldAdmin.user.id).select("+passwordHash"))
      .passwordHash,
  ).toBe(oldHash);
  const listing = await Listing.findById("legacy-sold");
  expect(listing.status).toBe("sold");
  expect(String(listing.sellerId)).toBe(seller.user.id);
  expect(
    (
      await mongoose.connection.db.collection("listings").findOne({
        _id: "legacy-sold",
      })
    ).isbn,
  ).toBeUndefined();
  expect(
    await mongoose.connection.db
      .listCollections({
        name: "refreshsessions",
      })
      .hasNext(),
  ).toBe(false);
  const second = await normalizeDatabase();
  expect(second.convertedListings).toBe(0);
  expect(second.movedAdmins).toBe(0);
  expect(second.counts).toEqual(result.counts);
});
