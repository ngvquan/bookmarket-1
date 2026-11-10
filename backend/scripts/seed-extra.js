// Bổ sung catalog demo bằng các ID cố định; chỉ thêm, không sửa/xóa bản ghi đã có.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  User,
  Shop,
  Author,
  Publisher,
  Category,
  Book,
  Edition,
  Listing,
  allModels,
} from "../src/models/index.js";
import { normalize } from "../src/utils/text.js";
import { extraBooks, extraEbooks } from "../../frontend/src/data/extraBooks.js";
import { seedEbookLibrary } from "./seed-ebook-library.js";

const shopProfiles = [
  [
    "Tiệm Sách Ánh Dương",
    "Hà Nội",
    "Văn học và những lựa chọn cho tủ sách gia đình.",
  ],
  [
    "Nhà Sách Trang Mới",
    "TP. Hồ Chí Minh",
    "Sách mới thuộc nhiều thể loại, thông tin theo từng phiên bản.",
  ],
  [
    "Hiệu Sách Mộc",
    "Đà Nẵng",
    "Một gian hàng nhỏ dành cho những người thích đọc chậm.",
  ],
  [
    "Tủ Sách Tháng Tư",
    "Hải Phòng",
    "Văn học, tâm lý và sách dành cho bạn đọc trẻ.",
  ],
  [
    "Góc Đọc Cuối Tuần",
    "Cần Thơ",
    "Sách cho những buổi cuối tuần và các chuyến đi.",
  ],
  [
    "Sách Và Cà Phê",
    "Đà Lạt",
    "Những cuốn sách phù hợp để đọc cùng một tách cà phê.",
  ],
  [
    "Nhà Sách Hạt Mầm",
    "Huế",
    "Sách thiếu nhi và những câu chuyện cho gia đình.",
  ],
  [
    "Hiệu Sách Bên Sông",
    "Hội An",
    "Kết nối bạn đọc qua văn học và những trang sách cũ.",
  ],
  [
    "Trạm Sách Tri Thức",
    "Biên Hòa",
    "Kinh tế, kỹ năng và các chủ đề phát triển bản thân.",
  ],
  [
    "Tiệm Sách Nắng Mai",
    "Nha Trang",
    "Những đầu sách quen thuộc từ nhiều người viết.",
  ],
  [
    "Nhà Sách Cánh Diều",
    "Vũng Tàu",
    "Sách dành cho bạn đọc nhỏ và những người thích khám phá.",
  ],
  [
    "Gác Sách Bình Yên",
    "Quy Nhơn",
    "Tâm lý, văn học và những lựa chọn để đọc mỗi ngày.",
  ],
];
const readers = [
  "Ngọc Hà",
  "Quang Huy",
  "Thùy Dương",
  "Gia Bảo",
  "Hoài An",
  "Thanh Trúc",
  "Minh Khang",
  "Bảo Ngọc",
  "Đức Phúc",
  "Khánh Vy",
  "Tuấn Kiệt",
  "Mai Chi",
];
const states = ["Như mới", "Còn tốt", "Đã cũ"];
const conditionNotes = [
  "Sách được giữ sạch, gáy chắc và không ghi chú.",
  "Bìa có dấu sử dụng nhẹ, ruột sách đầy đủ và dễ đọc.",
  "Bìa có vết gấp, giấy ngả màu và một vài ghi chú; vẫn đủ trang.",
];
const oid = (key) =>
  new mongoose.Types.ObjectId(
    createHash("sha256")
      .update(`bookmarket-extra:${key}`)
      .digest("hex")
      .slice(0, 24),
  );
function isbnFor(code) {
  const stem = `97800001${String(code).padStart(4, "0")}`;
  const sum = [...stem].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  return stem + ((10 - (sum % 10)) % 10);
}
async function findOrCreate(Model, filter, fields) {
  const existing = await Model.findOne(filter);
  if (existing) return existing;
  try {
    return await Model.create(fields);
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrent = await Model.findOne(filter);
    if (!concurrent) throw error;
    return concurrent;
  }
}

async function snapshot() {
  const result = new Map();
  for (const Model of allModels) {
    const documents = await Model.find().select("+passwordHash").lean();
    result.set(
      Model.collection.name,
      new Map(
        documents.map((document) => [
          String(document._id),
          createHash("sha256").update(JSON.stringify(document)).digest("hex"),
        ]),
      ),
    );
  }
  return result;
}

export async function seedExtra() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Không seed dữ liệu demo vào production.");
  const dryRun = process.argv.includes("--dry-run");
  const runStartedAt = Date.now();
  const before = await snapshot();
  const plannedIds = extraBooks
    .flatMap((book, index) => [
      `extra:${book.slug}:new-a`,
      `extra:${book.slug}:new-b`,
      `extra:${book.slug}:used`,
      ...(index % 10 === 0 ? [`extra:${book.slug}:pending`] : []),
    ])
    .concat(extraEbooks.map((book) => `extra:${book.slug}:digital`));
  const existingCount = await Listing.countDocuments({
    _id: { $in: plannedIds },
  });
  console.log(
    JSON.stringify({
      database: mongoose.connection.name,
      mode: dryRun ? "dry-run" : "insert-only",
      plannedListings: plannedIds.length,
      existingListings: existingCount,
      toInsert: plannedIds.length - existingCount,
    }),
  );
  if (dryRun) return;
  for (const Model of allModels) await Model.init();
  const passwordHash = await bcrypt.hash(
    process.env.SEED_PASSWORD || "BookMarket123!",
    12,
  );
  const sellers = [];
  for (let index = 0; index < shopProfiles.length; index++) {
    const [name, location, description] = shopProfiles[index];
    const email = `extra-shop-${String(index + 1).padStart(2, "0")}@bookmarket.local`;
    const user = await findOrCreate(
      User,
      { email },
      { _id: oid(email), name, email, passwordHash },
    );
    const shop = await findOrCreate(
      Shop,
      { ownerId: user._id },
      {
        _id: oid(`shop:${email}`),
        ownerId: user._id,
        name,
        description,
        contactName: name,
        contactPhone: `0910000${String(index + 1).padStart(3, "0")}`,
        contactEmail: email,
        pickupAddress: {
          province: location,
          ward: "Phường trung tâm",
          detail: `${index + 1} Đường Sách`,
        },
        isRegistrationComplete: true,
        registrationCompletedAt: new Date(),
      },
    );
    sellers.push({ user, shop, location });
  }
  const individuals = [];
  for (let index = 0; index < readers.length; index++) {
    const email = `extra-reader-${String(index + 1).padStart(2, "0")}@bookmarket.local`;
    const user = await findOrCreate(
      User,
      { email },
      { _id: oid(email), name: readers[index], email, passwordHash },
    );
    individuals.push({ user, shop: null, location: shopProfiles[index][1] });
  }
  const inserted = [];
  async function ensureEdition(data, digital = false) {
    const isbn = isbnFor(data.code);
    const existing = await Edition.findOne({ isbn });
    if (existing) {
      const work = await Book.findById(existing.bookId);
      if (!work || normalize(work.title) !== normalize(data.title))
        throw new Error(`ISBN demo bị trùng: ${isbn}`);
      return existing._id;
    }
    const authorIds = [];
    for (const name of data.author.split(";").map((name) => name.trim())) {
      const author = await findOrCreate(
        Author,
        { nameSearch: normalize(name) },
        { name, nameSearch: normalize(name) },
      );
      authorIds.push(author._id);
    }
    const category = await findOrCreate(
      Category,
      { nameSearch: normalize(data.category) },
      { name: data.category, nameSearch: normalize(data.category) },
    );
    const publisherName = digital
      ? "BookMarket Studio"
      : "Nhà xuất bản mẫu BookMarket";
    const publisher = await findOrCreate(
      Publisher,
      { nameSearch: normalize(publisherName) },
      { name: publisherName, nameSearch: normalize(publisherName) },
    );
    const catalogKey = JSON.stringify([
      normalize(data.title),
      authorIds.map(String).sort(),
      String(category._id),
    ]);
    const work = await findOrCreate(
      Book,
      { catalogKey },
      {
        title: data.title,
        titleSearch: normalize(data.title),
        authorIds,
        categoryId: category._id,
        description: data.description,
        catalogKey,
      },
    );
    const edition = await findOrCreate(
      Edition,
      { isbn },
      {
        bookId: work._id,
        isbn,
        publisherId: publisher._id,
        year: 2025,
        binding: digital ? "PDF" : data.code % 4 === 0 ? "Bìa cứng" : "Bìa mềm",
      },
    );
    return edition._id;
  }
  async function addListing(data, suffix, account, fields) {
    const listingId = `extra:${data.slug}:${suffix}`;
    if (await Listing.exists({ _id: listingId })) return;
    const editionId = await ensureEdition(data, fields.type === "digital");
    const listedAt = new Date(
      runStartedAt - ((data.code * 17) % 61) * 15 * 60000,
    );
    const listing = new Listing({
      _id: listingId,
      editionId,
      sellerId: account.user._id,
      shopId: account.shop?._id || null,
      description: data.description,
      location: account.location,
      status: "approved",
      createdAt: listedAt,
      updatedAt: listedAt,
      ...fields,
    });
    await listing.save();
    inserted.push(listingId);
  }
  for (let index = 0; index < extraBooks.length; index++) {
    const data = extraBooks[index];
    const first = sellers[index % sellers.length];
    const second = sellers[(index + 5) % sellers.length];
    const individual = individuals[index % individuals.length];
    const condition = index % states.length;
    await addListing(data, "new-a", first, {
      type: "new",
      price: data.price,
      stock: 5 + (index % 24),
      description: `${data.description} Sách mới, chưa sử dụng. Thông tin giá và xuất bản là dữ liệu minh họa cho đồ án.`,
    });
    await addListing(data, "new-b", second, {
      type: "new",
      price:
        Math.round((data.price * (0.92 + (index % 5) * 0.03)) / 1000) * 1000,
      stock: 3 + (index % 15),
      description: `${data.description} Sách mới từ một nhà bán khác; giá thuộc riêng tin đăng này.`,
    });
    await addListing(data, "used", individual, {
      type: "used",
      price:
        Math.round((data.price * (0.42 + (index % 5) * 0.05)) / 1000) * 1000,
      stock: 1,
      condition: states[condition],
      description: `${data.description} ${conditionNotes[condition]}`,
    });
    // Giữ ID mẫu cũ để không mất liên kết; tin được hiển thị ngay như các tin khác.
    if (index % 10 === 0)
      await addListing(data, "pending", sellers[(index + 2) % sellers.length], {
        type: "new",
        price: data.price + 5000,
        stock: 8,
        description: `${data.description} Một lựa chọn sách mới từ nhà bán khác.`,
      });
  }
  for (let index = 0; index < extraEbooks.length; index++) {
    await addListing(
      extraEbooks[index],
      "digital",
      sellers[index % sellers.length],
      { type: "digital", price: extraEbooks[index].price },
    );
  }
  const demoReader = await User.findOne({ email: "reader@bookmarket.local" });
  if (demoReader) await seedEbookLibrary(demoReader);
  const after = await snapshot();
  for (const [collection, oldDocuments] of before) {
    for (const [id, hash] of oldDocuments) {
      if (after.get(collection).get(id) !== hash)
        throw new Error(`Bản ghi cũ đã thay đổi: ${collection}/${id}`);
    }
  }
  const counts = Object.fromEntries(
    [...after].map(([name, documents]) => [name, documents.size]),
  );
  const report = {
    database: mongoose.connection.name,
    insertedListings: inserted.length,
    preservedExistingDocuments: [...before.values()].reduce(
      (sum, documents) => sum + documents.size,
      0,
    ),
    counts,
    listingIds: inserted,
  };
  const directory = fileURLToPath(
    new URL("../../exports/seed-extra/", import.meta.url),
  );
  await mkdir(directory, { recursive: true });
  const reportFile = `${directory}seed-${new Date().toISOString().replaceAll(":", "-")}.json`;
  await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({ ...report, listingIds: undefined, reportFile }, null, 2),
  );
  return report;
}

if (!process.env.MONGO_URI)
  throw new Error("Thiếu MONGO_URI trong backend/.env.");
await mongoose.connect(process.env.MONGO_URI);
try {
  await seedExtra();
} finally {
  await mongoose.disconnect();
}
