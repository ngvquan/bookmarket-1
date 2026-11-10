// Chuyển dữ liệu cũ sang chín collection; giữ nguyên ID listing/seller và mật khẩu.
import mongoose from "mongoose";
import { allModels, Admin, User, Shop, Listing } from "../models/index.js";
import { resolveEdition, editionDetails } from "../utils/catalog.js";
export async function normalizeDatabase() {
  const db = mongoose.connection.db;
  // Tính năng theo dõi shop đã bỏ: backup được tạo bởi scripts/migrate.js trước khi drop.
  if (await db.listCollections({ name: "follows" }).hasNext())
    await db.dropCollection("follows");
  if (await db.listCollections({ name: "suborders" }).hasNext())
    await db.collection("suborders").updateMany({}, { $unset: { shopId: "" } });
  if (await db.listCollections({ name: "digitalorders" }).hasNext()) {
    for (const order of await db.collection("digitalorders").find().toArray()) {
      const items = (order.items || []).map((item) => {
        const { shopId, ...snapshot } = item;
        return snapshot;
      });
      await db
        .collection("digitalorders")
        .updateOne({ _id: order._id }, { $set: { items } });
    }
  }
  for (const model of allModels) await model.init();
  const oldAdmins = await db
    .collection("users")
    .find({
      role: "admin",
    })
    .toArray();
  // Không tự xóa tài khoản admin cũ nếu còn sở hữu dữ liệu bán hàng.
  for (const admin of oldAdmins) {
    if (
      (await Shop.exists({
        ownerId: admin._id,
      })) ||
      (await Listing.exists({
        sellerId: admin._id,
      }))
    ) {
      throw new Error(
        "Admin cũ còn shop/tin bán. Cần chuyển quyền sở hữu trước khi tách tài khoản.",
      );
    }
    const existing = await Admin.findOne({
      email: admin.email,
    });
    if (existing && String(existing._id) !== String(admin._id)) {
      throw new Error("Email admin bị trùng ID; migration đã dừng.");
    }
  }
  const legacy = await db
    .collection("listings")
    .find({
      editionId: {
        $exists: false,
      },
    })
    .toArray();
  for (const listing of legacy) {
    const editionId = await resolveEdition(listing);
    await db.collection("listings").updateOne(
      {
        _id: listing._id,
      },
      {
        $set: {
          editionId,
        },
      },
    );
  }
  // Kiểm tra đầy đủ các liên kết trước khi bỏ field cũ.
  const listings = await Listing.find();
  for (const listing of listings) {
    await editionDetails(listing.editionId);
    if (
      !(await User.exists({
        _id: listing.sellerId,
      }))
    ) {
      throw new Error("Tin có sellerId không tồn tại.");
    }
    if (
      listing.shopId &&
      !(await Shop.exists({
        _id: listing.shopId,
        ownerId: listing.sellerId,
      }))
    ) {
      throw new Error("Tin liên kết sai chủ shop.");
    }
  }
  for (const admin of oldAdmins) {
    await Admin.updateOne(
      {
        _id: admin._id,
      },
      {
        $setOnInsert: {
          name: admin.name,
          email: admin.email,
          passwordHash: admin.passwordHash,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        },
      },
      {
        upsert: true,
        timestamps: false,
      },
    );
    const copied = await Admin.findById(admin._id).select("+passwordHash");
    if (copied.passwordHash !== admin.passwordHash) {
      throw new Error("Hash admin chưa được sao chép đúng; migration đã dừng.");
    }
  }
  for (const admin of oldAdmins)
    await db.collection("users").deleteOne({
      _id: admin._id,
      role: "admin",
    });
  await db.collection("users").updateMany(
    {},
    {
      $unset: {
        role: "",
        isActive: "",
      },
    },
  );
  const obsolete = [
    "title",
    "author",
    "isbn",
    "publisher",
    "year",
    "binding",
    "category",
    "titleSearch",
    "authorSearch",
    "publisherSearch",
    "searchText",
    "style",
    "coverTitle",
    "subtitle",
    "original",
    "rating",
    "reviews",
  ];
  const unset = {};
  for (const field of obsolete) unset[field] = "";
  await db.collection("listings").updateMany(
    {},
    {
      $unset: unset,
    },
  );
  const indexes = await db.collection("listings").indexes();
  for (const index of indexes) {
    if (index.name === "isbn_1") {
      await db.collection("listings").dropIndex(index.name);
    }
  }
  // Refresh token đã bỏ khỏi ứng dụng; dữ liệu collection này nằm trong backup trước migration.
  if (
    await db
      .listCollections({
        name: "refreshsessions",
      })
      .hasNext()
  ) {
    await db.dropCollection("refreshsessions");
  }
  const counts = {};
  for (const model of allModels)
    counts[model.collection.name] = await model.countDocuments();
  return {
    convertedListings: legacy.length,
    movedAdmins: oldAdmins.length,
    counts,
  };
}
