// Các handler kiểm tra quyền trực tiếp; không dùng factory hoặc middleware ownership riêng.
import express, { Router } from "express";
import mongoose from "mongoose";
import { PDFDocument } from "pdf-lib";
import Listing from "../models/Listing.js";
import Shop from "../models/Shop.js";
import User from "../models/User.js";
import SubOrder from "../models/SubOrder.js";
import DigitalOrder from "../models/DigitalOrder.js";
import { requireLogin, requireAdmin, requireUser } from "../middleware/auth.js";
import { escapeRegex, readListing, listingResponse } from "../utils/listing.js";
import {
  resolveEdition,
  offerFields,
  suggestEditions,
} from "../utils/catalog.js";
import { catalogFilters } from "../utils/catalog-search.js";
import { canPublishShopBooks } from "../utils/shop.js";
import { getRecommendations } from "../utils/recommendations.js";
import { EbookAccess } from "../models/index.js";
import { hasEbookAccess } from "../utils/ebook-access.js";
import { readPagination } from "../utils/pagination.js";
import {
  readPrivateFile,
  removePrivateFile,
  savePrivateFile,
} from "../utils/private-files.js";
const router = Router();
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const imageUpload = express.raw({ type: [...imageTypes], limit: "8mb" });
const pdfUpload = express.raw({ type: "application/pdf", limit: "100mb" });

// Hai URL riêng cho dữ liệu riêng tư, giúp GET công khai không cần xử lý token.
router.get("/mine", requireLogin, requireUser, listListings);
router.get("/admin", requireLogin, requireAdmin, listListings);
router.get("/", listListings);

// Danh sách người bán chỉ lấy ID seller có tin công khai, không gửi cả catalog cho frontend.
router.get("/sellers", async (req, res) => {
  const pagination = readPagination(req.query);
  const q = req.query.q || "";
  if (!pagination || typeof q !== "string" || q.length > 200) {
    return res.status(400).json({
      message: "Bộ lọc hoặc phân trang không hợp lệ.",
    });
  }
  const { page, limit } = pagination;
  const publicFilter = {
    type: { $in: ["new", "used", "digital"] },
    status: "approved",
    $or: [
      {
        type: {
          $nin: ["new", "used"],
        },
      },
      {
        stock: {
          $gt: 0,
        },
      },
    ],
  };
  const sellerIds = await Listing.distinct("sellerId", publicFilter);
  const userFilter = {
    _id: {
      $in: sellerIds,
    },
  };
  if (q.trim()) {
    const nameFilter = {
      $regex: escapeRegex(q.trim()),
      $options: "i",
    };
    const shops = await Shop.find({
      name: nameFilter,
    }).select("ownerId");
    userFilter.$or = [
      {
        name: nameFilter,
      },
      {
        _id: {
          $in: shops.map((shop) => shop.ownerId),
        },
      },
    ];
  }
  const total = await User.countDocuments(userFilter);
  const users = await User.find(userFilter)
    .select("name")
    .sort({
      name: 1,
      _id: 1,
    })
    .skip((page - 1) * limit)
    .limit(limit);
  const items = [];
  for (const user of users) {
    const shop = await Shop.findOne({
      ownerId: user._id,
    });
    const filter = {
      ...publicFilter,
      sellerId: user._id,
    };
    const first = await Listing.findOne(filter).select("location");
    items.push({
      id: user.id,
      name: shop?.name || user.name,
      location: first?.location || "Việt Nam",
      total: await Listing.countDocuments(filter),
    });
  }
  res.json({
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

// Lọc trên MongoDB rồi skip/limit, không tải cả catalog về trình duyệt.
async function listListings(req, res) {
  const q = req.query;
  const page = Number(q.page || 1);
  const limit = Number(q.limit || 10);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    return res.status(400).json({
      message: "page phải >= 1, limit từ 1 đến 50.",
    });
  }
  const filter = { type: { $in: ["new", "used", "digital"] } };
  const conditions = [];
  if (q.group !== undefined && q.group !== "edition") {
    return res.status(400).json({ message: "Cách gộp sách không hợp lệ." });
  }
  if (q.edition !== undefined) {
    if (typeof q.edition !== "string" || !mongoose.isValidObjectId(q.edition)) {
      return res.status(400).json({ message: "ID phiên bản không hợp lệ." });
    }
    conditions.push({ editionId: new mongoose.Types.ObjectId(q.edition) });
  }
  if (req.path === "/mine") {
    filter.sellerId = new mongoose.Types.ObjectId(req.user.id);
  } else if (req.path === "/admin") {
    if (q.status) {
      if (
        !["pending", "approved", "rejected", "hidden", "sold"].includes(
          q.status,
        )
      ) {
        return res.status(400).json({
          message: "Trạng thái không hợp lệ.",
        });
      }
      filter.status = q.status;
    }
  } else {
    filter.status = "approved";
    conditions.push({
      $or: [
        {
          type: {
            $nin: ["new", "used"],
          },
        },
        {
          stock: {
            $gt: 0,
          },
        },
      ],
    });
  }
  if (q.type && q.type !== "all") {
    if (!["physical", "new", "used", "digital"].includes(q.type)) {
      return res.status(400).json({
        message: "Loại tin không hợp lệ",
      });
    }
    filter.type = q.type === "physical" ? { $in: ["new", "used"] } : q.type;
  }
  for (const field of [
    "category",
    "binding",
    "condition",
    "seller",
    "q",
    "author",
    "title",
    "isbn",
    "publisher",
  ]) {
    if (
      q[field] !== undefined &&
      (typeof q[field] !== "string" || q[field].length > 200)
    ) {
      return res.status(400).json({
        message: "Bộ lọc không hợp lệ.",
      });
    }
  }
  if (q.condition === "Mới") {
    conditions.push({
      type: "new",
    });
  } else if (q.condition) {
    filter.condition = q.condition;
  }
  if (q.seller) {
    if (!mongoose.isValidObjectId(q.seller)) {
      return res.status(400).json({
        message: "ID người bán không hợp lệ.",
      });
    }
    if (req.path === "/mine" && q.seller !== req.user.id) {
      return res.status(403).json({
        message: "Không được xem tin riêng của người khác.",
      });
    }
    filter.sellerId = new mongoose.Types.ObjectId(q.seller);
  }
  const min = q.min === undefined ? undefined : Number(q.min);
  const max = q.max === undefined ? undefined : Number(q.max);
  if (
    (min !== undefined && (!Number.isFinite(min) || min < 0)) ||
    (max !== undefined && (!Number.isFinite(max) || max < 0)) ||
    (min !== undefined && max !== undefined && min > max)
  ) {
    return res.status(400).json({
      message: "Khoảng giá không hợp lệ.",
    });
  }
  if (min !== undefined || max !== undefined) {
    filter.price = {};
    if (min !== undefined) {
      filter.price.$gte = min;
    }
    if (max !== undefined) {
      filter.price.$lte = max;
    }
  }
  const catalog = await catalogFilters(q);
  if (catalog.editions !== null) {
    filter.editionId = {
      $in: catalog.editions,
    };
  }
  if (catalog.general) {
    conditions.push(catalog.general);
  }
  if (conditions.length) {
    filter.$and = conditions;
  }
  let sort = {
    createdAt: -1,
    _id: 1,
  };
  if (q.sort === "title") {
    sort = {
      title: 1,
      _id: 1,
    };
  } else if (q.sort === "price-up") {
    sort = {
      price: 1,
      _id: 1,
    };
  } else if (q.sort === "price-down") {
    sort = {
      price: -1,
      _id: 1,
    };
  } else if (q.sort && q.sort !== "featured") {
    return res.status(400).json({
      message: "Cách sắp xếp không hợp lệ.",
    });
  }
  // Gộp trước khi đếm/phân trang sách mới/cũ; ebook giữ từng tin.
  // Khu quản lý vẫn trả đầy đủ tin của chủ tài khoản.
  if (q.group === "edition" && !["/mine", "/admin"].includes(req.path)) {
    const pipeline = [
      { $match: filter },
      { $sort: { price: 1, _id: 1 } },
      {
        $group: {
          _id: {
            $cond: [{ $in: ["$type", ["new", "used"]] }, "$editionId", "$_id"],
          },
          listing: { $first: "$$ROOT" },
          offerCount: { $sum: 1 },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$listing", { offerCount: "$offerCount" }],
          },
        },
      },
    ];
    if (q.sort === "title") {
      pipeline.push(
        {
          $lookup: {
            from: "editions",
            localField: "editionId",
            foreignField: "_id",
            as: "edition",
          },
        },
        {
          $lookup: {
            from: "books",
            localField: "edition.bookId",
            foreignField: "_id",
            as: "book",
          },
        },
      );
    }
    pipeline.push(
      { $sort: q.sort === "title" ? { "book.title": 1, _id: 1 } : sort },
      {
        $facet: {
          totals: [{ $count: "count" }],
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
    );
    const [result] = await Listing.aggregate(pipeline);
    const total = result.totals[0]?.count || 0;
    const ids = result.items.map((item) => item._id);
    const documents = await Listing.find({ _id: { $in: ids } });
    const byId = new Map(documents.map((item) => [String(item._id), item]));
    const items = await Promise.all(
      result.items.map(async (item) => ({
        ...(await listingResponse(byId.get(String(item._id)))),
        offerCount: item.offerCount,
      })),
    );
    return res.json({
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  }
  const total = await Listing.countDocuments(filter);
  let listings;
  if (q.sort === "title") {
    // Join hai quan he de MongoDB sap xep ten sach truoc khi skip/limit.
    const pageItems = await Listing.aggregate([
      {
        $match: filter,
      },
      {
        $lookup: {
          from: "editions",
          localField: "editionId",
          foreignField: "_id",
          as: "edition",
        },
      },
      {
        $unwind: "$edition",
      },
      {
        $lookup: {
          from: "books",
          localField: "edition.bookId",
          foreignField: "_id",
          as: "book",
        },
      },
      {
        $unwind: "$book",
      },
      {
        $sort: {
          "book.title": 1,
          _id: 1,
        },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
      },
    ]);
    const documents = await Listing.find({
      _id: { $in: pageItems.map((item) => item._id) },
    });
    const byId = new Map(documents.map((item) => [String(item._id), item]));
    listings = pageItems.map((item) => byId.get(String(item._id)));
  } else {
    listings = await Listing.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
  }
  // Metadata cua tung sach doc doc lap; chay song song de tranh cong don do tre Atlas.
  const items = await Promise.all(listings.map(listingResponse));
  res.json({
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
router.get("/suggestions", requireLogin, requireUser, async (req, res) => {
  const { isbn = "", title = "", author = "", type = "used" } = req.query;
  if (
    [isbn, title, author, type].some((value) => typeof value !== "string") ||
    isbn.length > 30 ||
    title.length > 180 ||
    author.length > 180 ||
    !["new", "used", "digital"].includes(type)
  ) {
    return res
      .status(400)
      .json({ message: "Thông tin tìm phiên bản không hợp lệ." });
  }
  res.json({ items: await suggestEditions({ isbn, title, author, type }) });
});
router.patch("/:id/visibility", requireLogin, requireUser, async (req, res) => {
  if (
    typeof req.body?.hidden !== "boolean" ||
    Object.keys(req.body).some((key) => key !== "hidden")
  )
    return res
      .status(400)
      .json({ message: "Yêu cầu ẩn/hiện tin không hợp lệ." });
  const listing = await Listing.findById(req.params.id);
  if (!listing)
    return res.status(404).json({ message: "Không tìm thấy tin đăng." });
  if (String(listing.sellerId) !== req.user.id)
    return res.status(403).json({ message: "Bạn không phải chủ tin." });
  if (req.body.hidden) {
    if (listing.status === "hidden" && listing.hiddenBy === "seller")
      return res.json({ listing: await listingResponse(listing) });
    if (listing.status !== "approved")
      return res.status(409).json({
        message:
          listing.status === "hidden"
            ? "Tin đã bị quản trị viên ẩn."
            : "Chỉ có thể ẩn tin đang hiển thị.",
      });
    listing.status = "hidden";
    listing.hiddenBy = "seller";
  } else {
    if (listing.status === "approved")
      return res.json({ listing: await listingResponse(listing) });
    if (listing.status === "hidden" && listing.hiddenBy !== "seller")
      return res.status(403).json({ message: "Tin bị quản trị viên ẩn." });
    if (listing.status !== "hidden")
      return res
        .status(409)
        .json({ message: "Chỉ có thể hiện lại tin do bạn tự ẩn." });
    listing.status = "approved";
    listing.hiddenBy = undefined;
  }
  await listing.save();
  res.json({ listing: await listingResponse(listing) });
});

// Ảnh bìa có thể xem công khai; MongoDB chỉ giữ ID và loại nội dung.
router.get("/:id/images/:imageId", async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  const image = listing?.images.find((item) => item.id === req.params.imageId);
  if (!image) return res.status(404).json({ message: "Không tìm thấy ảnh." });
  try {
    const buffer = await readPrivateFile("images", image.id);
    res.set({
      "Content-Type": image.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400",
    });
    res.send(buffer);
  } catch (error) {
    if (error.code === "ENOENT")
      return res.status(404).json({ message: "Tệp ảnh không còn tồn tại." });
    throw error;
  }
});

router.get("/:id/preview", async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (
    !listing ||
    listing.type !== "digital" ||
    listing.status !== "approved" ||
    !listing.ebookFileId
  )
    return res
      .status(404)
      .json({ message: "Không tìm thấy ebook để đọc thử." });
  try {
    const original = await PDFDocument.load(
      await readPrivateFile("ebooks", listing.ebookFileId),
    );
    const preview = await PDFDocument.create();
    const pages = await preview.copyPages(
      original,
      Array.from(
        { length: Math.min(2, original.getPageCount()) },
        (_, index) => index,
      ),
    );
    pages.forEach((page) => preview.addPage(page));
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="ebook-preview.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(Buffer.from(await preview.save()));
  } catch (error) {
    if (error.code === "ENOENT")
      return res.status(404).json({ message: "Tệp ebook không còn tồn tại." });
    throw error;
  }
});

router.get("/:id/ebook", requireLogin, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing || listing.type !== "digital" || !listing.ebookFileId)
    return res.status(404).json({ message: "Không tìm thấy ebook." });
  if (
    req.accountType !== "user" ||
    !(await hasEbookAccess(req.user.id, listing.id))
  )
    return res.status(403).json({
      message: "Chỉ người đã thanh toán hoặc chủ ebook được đọc toàn bộ file.",
    });
  try {
    const buffer = await readPrivateFile("ebooks", listing.ebookFileId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="ebook.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(buffer);
  } catch (error) {
    if (error.code === "ENOENT")
      return res.status(404).json({ message: "Tệp ebook không còn tồn tại." });
    throw error;
  }
});

router.post(
  "/:id/images",
  requireLogin,
  requireUser,
  imageUpload,
  async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing)
      return res.status(404).json({ message: "Không tìm thấy tin đăng." });
    if (String(listing.sellerId) !== req.user.id)
      return res.status(403).json({ message: "Bạn không phải chủ tin." });
    const contentType = String(req.headers["content-type"] || "")
      .split(";")[0]
      .toLowerCase();
    if (
      !imageTypes.has(contentType) ||
      !Buffer.isBuffer(req.body) ||
      !validImage(req.body, contentType)
    )
      return res
        .status(400)
        .json({ message: "Ảnh phải là JPEG, PNG hoặc WebP hợp lệ." });
    if (listing.images.length >= 5)
      return res
        .status(400)
        .json({ message: "Mỗi tin đăng được tải tối đa 5 ảnh." });
    const id = await savePrivateFile("images", req.body);
    try {
      const changed = await Listing.findOneAndUpdate(
        {
          _id: listing.id,
          sellerId: req.user.id,
          $expr: { $lt: [{ $size: { $ifNull: ["$images", []] } }, 5] },
        },
        { $push: { images: { id, contentType } } },
        { new: true, runValidators: true },
      );
      if (!changed) {
        await removePrivateFile("images", id);
        return res
          .status(409)
          .json({ message: "Danh sách ảnh vừa thay đổi; vui lòng thử lại." });
      }
      res.status(201).json({ listing: await listingResponse(changed) });
    } catch (error) {
      await removePrivateFile("images", id);
      throw error;
    }
  },
);

router.delete(
  "/:id/images/:imageId",
  requireLogin,
  requireUser,
  async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing)
      return res.status(404).json({ message: "Không tìm thấy tin đăng." });
    if (String(listing.sellerId) !== req.user.id)
      return res.status(403).json({ message: "Bạn không phải chủ tin." });
    const image = listing.images.find((item) => item.id === req.params.imageId);
    if (!image) return res.status(404).json({ message: "Không tìm thấy ảnh." });
    listing.images = listing.images.filter((item) => item.id !== image.id);
    await listing.save();
    await removePrivateFile("images", image.id);
    res.json({ listing: await listingResponse(listing) });
  },
);

router.put(
  "/:id/ebook",
  requireLogin,
  requireUser,
  pdfUpload,
  async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing)
      return res.status(404).json({ message: "Không tìm thấy tin đăng." });
    if (String(listing.sellerId) !== req.user.id)
      return res.status(403).json({ message: "Bạn không phải chủ tin." });
    if (listing.type !== "digital")
      return res
        .status(400)
        .json({ message: "Chỉ tin ebook mới nhận file PDF." });
    if (
      !Buffer.isBuffer(req.body) ||
      req.body.length < 5 ||
      req.body.subarray(0, 5).toString("ascii") !== "%PDF-"
    )
      return res
        .status(400)
        .json({ message: "File ebook phải là PDF hợp lệ." });
    if (
      listing.ebookFileId &&
      (await EbookAccess.exists({ listingId: listing.id }))
    )
      return res
        .status(409)
        .json({ message: "Không thể thay PDF sau khi ebook đã có người mua." });
    let document;
    try {
      document = await PDFDocument.load(req.body);
    } catch {
      return res
        .status(400)
        .json({ message: "Không đọc được PDF hoặc file đang được mã hóa." });
    }
    if (!document.getPageCount())
      return res
        .status(400)
        .json({ message: "PDF phải có ít nhất một trang." });
    const previousFileId = listing.ebookFileId;
    const fileId = await savePrivateFile("ebooks", req.body);
    try {
      listing.ebookFileId = fileId;
      listing.ebookPageCount = document.getPageCount();
      if (listing.status === "pending") listing.status = "approved";
      await listing.save();
    } catch (error) {
      await removePrivateFile("ebooks", fileId);
      throw error;
    }
    await removePrivateFile("ebooks", previousFileId);
    res.json({ listing: await listingResponse(listing) });
  },
);

router.get("/:id/recommendations", async (req, res) => {
  const limit = req.query.limit === undefined ? 3 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 12)
    return res.status(400).json({ message: "limit phải từ 1 đến 12." });
  const listing = await Listing.findById(req.params.id);
  if (
    !listing ||
    listing.status !== "approved" ||
    (["new", "used"].includes(listing.type) && listing.stock <= 0)
  )
    return res
      .status(404)
      .json({ message: "Tin không còn bán hoặc đã bị ẩn." });
  res.json(await getRecommendations(listing, limit));
});
router.get("/:id", async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (
    !listing ||
    !["new", "used", "digital"].includes(listing.type) ||
    listing.status !== "approved" ||
    (["new", "used"].includes(listing.type) && listing.stock <= 0)
  ) {
    return res.status(404).json({
      message: "Tin không còn bán hoặc đã bị ẩn.",
    });
  }
  res.json({
    listing: await listingResponse(listing),
  });
});
router.post("/", requireLogin, requireUser, async (req, res) => {
  const result = readListing(req.body, {}, { requireIsbn: true });
  if (result.message) {
    return res.status(400).json({
      message: result.message,
    });
  }
  const shop = await Shop.findOne({
    ownerId: req.user.id,
  });
  if (
    ["new", "digital"].includes(result.data.type) &&
    !canPublishShopBooks(shop)
  ) {
    return res.status(400).json({
      message:
        "Hãy hoàn tất đăng ký shop: thông tin liên hệ và địa chỉ lấy hàng trước khi đăng sách mới hoặc ebook.",
    });
  }
  const listing = await Listing.create({
    ...offerFields(result.data),
    editionId: await resolveEdition(result.data),
    sellerId: req.user.id,
    shopId: shop?._id || null,
    status: result.data.type === "digital" ? "pending" : "approved",
  });
  res.status(201).json({
    listing: await listingResponse(listing),
  });
});
router.patch("/:id", requireLogin, requireUser, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({
      message: "Không tìm thấy tin đăng.",
    });
  }
  if (String(listing.sellerId) !== req.user.id) {
    return res.status(403).json({
      message: "Bạn không phải chủ tin.",
    });
  }
  if (listing.status === "sold") {
    return res.status(409).json({
      message: "Tin đã bán không được sửa.",
    });
  }
  if (
    await SubOrder.exists({
      "items.listingId": listing.id,
      status: { $in: ["pending", "confirmed", "shipping", "delivered"] },
    })
  ) {
    return res.status(409).json({
      message:
        "Tin đang gắn với đơn chưa kết thúc; hãy xử lý đơn trước khi sửa.",
    });
  }
  const result = readListing(req.body, await listingResponse(listing));
  if (
    listing.type === "digital" &&
    req.body.type &&
    req.body.type !== "digital" &&
    (await DigitalOrder.exists({
      "items.listingId": listing.id,
      status: "paid",
    }))
  )
    return res
      .status(409)
      .json({ message: "Ebook đã có người mua không được đổi loại." });
  if (result.message) {
    return res.status(400).json({
      message: result.message,
    });
  }
  // Đơn đã hoàn tất vẫn có thể hoàn hàng: giữ đúng loại tin để hoàn kho.
  if (
    result.data.type !== listing.type &&
    (await SubOrder.exists({
      "items.listingId": listing.id,
      status: "completed",
    }))
  ) {
    return res.status(409).json({
      message:
        "Tin đã có đơn hoàn tất không được đổi loại sách; hãy tạo tin mới.",
    });
  }
  const shop = await Shop.findOne({
    ownerId: req.user.id,
  });
  if (
    ["new", "digital"].includes(result.data.type) &&
    !canPublishShopBooks(shop)
  ) {
    return res.status(400).json({
      message:
        "Hãy hoàn tất đăng ký shop: thông tin liên hệ và địa chỉ lấy hàng trước khi đăng sách mới hoặc ebook.",
    });
  }
  const editionId = await resolveEdition(
    {
      ...result.data,
      listingId: listing.id,
    },
    listing.editionId,
  );
  listing.depopulate("sellerId");
  listing.depopulate("shopId");
  const previousEbookFileId = listing.ebookFileId;
  Object.assign(listing, offerFields(result.data));
  listing.editionId = editionId;
  listing.shopId = shop?._id || null;
  if (result.data.type !== "digital") {
    listing.ebookFileId = null;
    listing.ebookPageCount = 0;
  }
  // Ebook mới chỉ công khai sau khi chủ shop tải PDF; tin admin đã ẩn vẫn giữ nguyên trạng thái.
  if (!["hidden", "rejected"].includes(listing.status))
    listing.status =
      result.data.type === "digital" && !listing.ebookFileId
        ? "pending"
        : "approved";
  await listing.save();
  if (previousEbookFileId && previousEbookFileId !== listing.ebookFileId)
    await removePrivateFile("ebooks", previousEbookFileId);
  res.json({
    listing: await listingResponse(listing),
  });
});
router.delete("/:id", requireLogin, requireUser, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({
      message: "Không tìm thấy tin đăng.",
    });
  }
  if (String(listing.sellerId) !== req.user.id) {
    return res.status(403).json({
      message: "Bạn không phải chủ tin.",
    });
  }
  if (
    await SubOrder.exists({
      "items.listingId": listing.id,
      status: {
        $in: ["pending", "confirmed", "shipping", "delivered", "completed"],
      },
    })
  ) {
    return res.status(409).json({
      message:
        "Tin đang gắn với đơn xử lý hoặc hoàn tất; cần giữ tin để hỗ trợ hoàn hàng.",
    });
  }
  if (
    listing.type === "digital" &&
    (await DigitalOrder.exists({
      "items.listingId": listing.id,
      status: "paid",
    }))
  )
    return res
      .status(409)
      .json({ message: "Ebook đã có người mua không được xóa." });
  const fileId = listing.ebookFileId;
  const imageIds = listing.images.map((image) => image.id);
  await listing.deleteOne();
  await Promise.all([
    removePrivateFile("ebooks", fileId),
    ...imageIds.map((id) => removePrivateFile("images", id)),
  ]);
  res.status(204).end();
});
router.patch("/:id/sold", requireLogin, requireUser, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({
      message: "Không tìm thấy tin đăng.",
    });
  }
  if (String(listing.sellerId) !== req.user.id) {
    return res.status(403).json({
      message: "Bạn không phải chủ tin.",
    });
  }
  if (listing.type !== "used") {
    return res.status(400).json({
      message: "Chỉ đánh dấu đã bán cho tin sách cũ.",
    });
  }
  if (!["approved", "sold"].includes(listing.status)) {
    return res.status(409).json({
      message: "Chỉ đánh dấu đã bán cho tin đang hiển thị.",
    });
  }
  listing.status = "sold";
  listing.stock = 0;
  await listing.save();
  res.json({
    listing: await listingResponse(listing),
  });
});
router.patch(
  "/:id/moderation",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    if (!["approved", "rejected", "hidden"].includes(req.body?.status)) {
      return res.status(400).json({
        message: "Trạng thái tin không hợp lệ.",
      });
    }
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({
        message: "Không tìm thấy tin đăng.",
      });
    }
    if (listing.status === "sold") {
      return res.status(409).json({
        message: "Không thay đổi trạng thái tin đã bán.",
      });
    }
    if (
      req.body.status === "approved" &&
      listing.type === "digital" &&
      !listing.ebookFileId
    )
      return res
        .status(409)
        .json({ message: "Ebook cần có file PDF trước khi hiển thị." });
    listing.status = req.body.status;
    listing.hiddenBy = req.body.status === "hidden" ? "admin" : undefined;
    await listing.save();
    res.json({
      listing: await listingResponse(listing),
    });
  },
);

function validImage(buffer, contentType) {
  if (buffer.length < 12) return false;
  if (contentType === "image/jpeg")
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === "image/png")
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/webp")
    return (
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  return false;
}
export default router;
