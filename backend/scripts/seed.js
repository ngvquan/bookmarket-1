// Thêm dữ liệu mẫu theo ID ổn định; không xóa hay ghi đè tài khoản/tin đã có.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import User from "../src/models/User.js";
import Admin from "../src/models/Admin.js";
import { allModels } from "../src/models/index.js";
import Shop from "../src/models/Shop.js";
import Listing from "../src/models/Listing.js";
import { resolveEdition, offerFields } from "../src/utils/catalog.js";
import { initialBooks } from "../../frontend/src/data/books.js";
import { seedEbookLibrary } from "./seed-ebook-library.js";
const id = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 24);
export const seedPassword = process.env.SEED_PASSWORD || "BookMarket123!";
// Giữ ID tin cũ để giỏ và yêu thích đang lưu tiếp tục tham chiếu được.
export async function seedDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed demo is only allowed outside production");
  }
  for (const model of allModels) await model.init();
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const adminPasswordHash = await bcrypt.hash("123456", 12);
  const admin = await Admin.findOneAndUpdate(
    {
      email: "admin@bookmarket.local",
    },
    {
      $set: {
        name: "Quản trị BookMarket",
        passwordHash: adminPasswordHash,
      },
      $setOnInsert: {
        _id: id("admin"),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
  const reader = await User.findOneAndUpdate(
    {
      email: "reader@bookmarket.local",
    },
    {
      $setOnInsert: {
        _id: id("reader"),
        name: "Bạn đọc",
        passwordHash,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
  const raw = initialBooks.map((book, index) => {
    const stem = `97800000${String(index + 1).padStart(4, "0")}`;
    const sum = [...stem].reduce(
      (s, d, i) => s + Number(d) * (i % 2 ? 3 : 1),
      0,
    );
    return {
      ...book,
      isbn: stem + ((10 - (sum % 10)) % 10),
      publisher: book.type === "digital" ? "BookMarket Studio" : "NXB Văn học",
      year: 2024 - (index % 4),
      binding:
        book.type === "digital"
          ? "PDF"
          : index % 4 === 3
            ? "Bìa cứng"
            : "Bìa mềm",
    };
  });
  const alchemist = raw.find((b) => b.id === "b2");
  raw.push(
    {
      ...alchemist,
      id: "offer-b2-muathu",
      shop: "Tiệm sách Mùa Thu",
      price: 74000,
      stock: 6,
      location: "Đà Nẵng",
    },
    {
      ...alchemist,
      id: "offer-b2-old",
      shop: "Gác sách An Nhiên",
      type: "used",
      price: 42000,
      stock: 1,
      condition: "Còn tốt",
    },
  );
  const sellers = new Map();
  const shopNames = [
    ...new Set(raw.filter((b) => b.owner !== "me").map((b) => b.shop)),
  ];
  for (const [shopIndex, name] of shopNames.entries()) {
    const email = `seller-${id(name).slice(0, 8)}@bookmarket.local`;
    const user = await User.findOneAndUpdate(
      {
        email,
      },
      {
        $setOnInsert: {
          _id: id(name),
          name,
          passwordHash,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
    let shop = null;
    if (
      raw.some((b) => b.shop === name && ["new", "digital"].includes(b.type))
    ) {
      shop = await Shop.findOneAndUpdate(
        {
          ownerId: user._id,
        },
        {
          $setOnInsert: {
            name,
            description: "Gian sách độc lập trên BookMarket.",
            contactName: name,
            contactPhone: `0900000${String(shopIndex + 1).padStart(3, "0")}`,
            contactEmail: email,
            pickupAddress: {
              province: "Thành phố Hồ Chí Minh",
              ward: "Phường Bến Thành",
              detail: `${shopIndex + 1} Đường Sách`,
            },
            isRegistrationComplete: true,
            registrationCompletedAt: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
    }
    sellers.set(name, {
      user,
      shop,
    });
  }
  for (const book of raw) {
    const account =
      book.owner === "me"
        ? {
            user: reader,
            shop: null,
          }
        : sellers.get(book.shop);
    // Giu tin da co; seed lai khong tao them edition cho sach chua ISBN.
    if (
      await Listing.exists({
        _id: book.id,
      })
    ) {
      continue;
    }
    const data = {
      ...book,
      stock:
        book.type === "used" ? 1 : book.type === "new" ? book.stock : undefined,
    };
    const editionId = await resolveEdition(data);
    await Listing.create({
      _id: book.id,
      ...offerFields(data),
      editionId,
      sellerId: account.user._id,
      shopId: ["new", "digital"].includes(book.type) ? account.shop?._id : null,
      status: "approved",
    });
  }
  await seedEbookLibrary(reader);
  console.log(
    `Seed ready: ${await User.countDocuments()} users, ${await Listing.countDocuments()} listings. Existing records preserved.`,
  );
  return {
    admin,
    reader,
    sellers,
  };
}
// Script chỉ chạy bằng npm run seed, đóng kết nối sau khi thêm dữ liệu mẫu.
if (!process.env.MONGO_URI) {
  throw new Error("Set MONGO_URI in backend/.env");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Seed demo is only allowed outside production");
}
await mongoose.connect(process.env.MONGO_URI);
try {
  await seedDatabase();
} finally {
  await mongoose.disconnect();
}
