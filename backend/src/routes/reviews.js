import { Router } from "express";
import mongoose from "mongoose";
import { Review, SubOrder, Listing, Shop, User } from "../models/index.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { editionDetails } from "../utils/catalog.js";

const router = Router();
const purchaseMessage =
  "Bạn chỉ được đánh giá khi đã mua sách này và đơn hàng đã hoàn thành.";
const duplicateMessage = "Bạn đã đánh giá sách này rồi.";
const validListing = (value) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= 100;
const replyResponse = (reply) =>
  reply
    ? {
        text: reply.text,
        repliedAt: reply.repliedAt,
        editedAt: reply.editedAt || null,
      }
    : null;

// Người bán chỉ thấy đánh giá của chính mình, có thể lọc các đánh giá chưa trả lời.
router.get("/shop", requireLogin, requireUser, async (req, res) => {
  const page = Number(req.query.page || 1),
    limit = 10;
  const replied = req.query.replied || "all";
  const rating =
    req.query.rating === undefined ? undefined : Number(req.query.rating);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !["all", "yes", "no"].includes(replied) ||
    (rating !== undefined &&
      (!Number.isInteger(rating) || rating < 1 || rating > 5))
  )
    return res.status(400).json({ message: "Bộ lọc đánh giá không hợp lệ." });
  const filter = { sellerId: req.user.id };
  if (rating !== undefined) filter.rating = rating;
  if (replied === "yes") filter.reply = { $exists: true, $ne: null };
  if (replied === "no")
    filter.$or = [{ reply: { $exists: false } }, { reply: null }];
  const unrepliedFilter = {
    sellerId: req.user.id,
    $or: [{ reply: { $exists: false } }, { reply: null }],
  };
  const [rows, total, unreplied] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("buyerId", "name")
      .lean(),
    Review.countDocuments(filter),
    Review.countDocuments(unrepliedFilter),
  ]);
  const listings = await Listing.find({
    _id: { $in: rows.map((row) => row.listingId) },
  });
  const titles = new Map();
  for (const listing of listings)
    titles.set(listing.id, (await editionDetails(listing.editionId)).title);
  res.json({
    items: rows.map((review) => ({
      id: String(review._id),
      listingId: review.listingId,
      bookTitle: titles.get(review.listingId) || "Sách không còn hiển thị",
      buyerName: review.buyerId?.name || "Khách hàng",
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      reply: replyResponse(review.reply),
    })),
    total,
    unreplied,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

// Danh sách công khai chỉ gửi tên người mua, không lộ email hoặc thông tin đơn hàng.
router.get("/", async (req, res) => {
  const page = Number(req.query.page || 1);
  if (
    !validListing(req.query.listingId) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000
  ) {
    return res
      .status(400)
      .json({ message: "Sách hoặc trang đánh giá không hợp lệ." });
  }
  const listingId = req.query.listingId.trim();
  const limit = 10;
  const [summary, reviews] = await Promise.all([
    Review.aggregate([
      { $match: { listingId } },
      {
        $group: { _id: null, total: { $sum: 1 }, average: { $avg: "$rating" } },
      },
    ]),
    Review.find({ listingId })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("buyerId", "name")
      .lean(),
  ]);
  const total = summary[0]?.total || 0;
  const sellerIds = [
    ...new Set(reviews.map((review) => String(review.sellerId))),
  ];
  const shops = sellerIds.length
    ? await Shop.find({ ownerId: { $in: sellerIds } })
        .select("ownerId name")
        .lean()
    : [];
  const sellerNames = new Map(
    shops.map((shop) => [String(shop.ownerId), shop.name]),
  );
  const missing = sellerIds.filter((id) => !sellerNames.has(id));
  const users = missing.length
    ? await User.find({ _id: { $in: missing } })
        .select("name")
        .lean()
    : [];
  for (const user of users) sellerNames.set(String(user._id), user.name);
  res.json({
    items: reviews.map((review) => ({
      id: String(review._id),
      buyerName: review.buyerId?.name || "Khách hàng",
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      verifiedPurchase: true,
      reply: review.reply
        ? {
            ...replyResponse(review.reply),
            shopName: sellerNames.get(String(review.sellerId)) || "Người bán",
          }
        : null,
    })),
    total,
    average: total ? Math.round(summary[0].average * 10) / 10 : 0,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

router.get("/eligibility", requireLogin, requireUser, async (req, res) => {
  if (!validListing(req.query.listingId))
    return res.status(400).json({ message: "Sách không hợp lệ." });
  const listingId = req.query.listingId.trim();
  if (await Review.exists({ buyerId: req.user.id, listingId })) {
    return res.json({
      canReview: false,
      alreadyReviewed: true,
      message: duplicateMessage,
    });
  }
  const purchased = await SubOrder.exists({
    buyerId: req.user.id,
    sellerId: { $ne: req.user.id },
    status: "completed",
    "items.listingId": listingId,
  });
  res.json({
    canReview: !!purchased,
    alreadyReviewed: false,
    message: purchased
      ? "Bạn đã mua sách này. Hãy chia sẻ đánh giá của bạn."
      : purchaseMessage,
  });
});

router.post("/", requireLogin, requireUser, async (req, res) => {
  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (key) => !["listingId", "rating", "comment"].includes(key),
    ) ||
    !validListing(body.listingId) ||
    !Number.isInteger(body.rating) ||
    body.rating < 1 ||
    body.rating > 5 ||
    typeof body.comment !== "string" ||
    !body.comment.trim() ||
    body.comment.trim().length > 2000
  ) {
    return res
      .status(400)
      .json({
        message:
          "Hãy chọn từ 1 đến 5 sao và nhập nhận xét từ 1 đến 2000 ký tự.",
      });
  }
  const listingId = body.listingId.trim();
  // Dùng tài khoản từ JWT và đơn thật trong DB; không tin thông tin mua hàng từ React.
  const subOrder = await SubOrder.findOne({
    buyerId: req.user.id,
    sellerId: { $ne: req.user.id },
    status: "completed",
    "items.listingId": listingId,
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  if (!subOrder) return res.status(403).json({ message: purchaseMessage });
  try {
    const review = await Review.create({
      buyerId: req.user.id,
      sellerId: subOrder.sellerId,
      listingId,
      orderId: subOrder.orderId,
      subOrderId: subOrder._id,
      rating: body.rating,
      comment: body.comment.trim(),
    });
    res
      .status(201)
      .json({
        review: {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
        },
      });
  } catch (error) {
    // Unique index ngăn đánh giá trùng, kể cả khi gửi hai request cùng lúc.
    if (error.code === 11000)
      return res.status(409).json({ message: duplicateMessage });
    throw error;
  }
});

router.put("/:id/reply", requireLogin, requireUser, async (req, res) => {
  if (
    !mongoose.isValidObjectId(req.params.id) ||
    typeof req.body?.text !== "string" ||
    !req.body.text.trim() ||
    req.body.text.trim().length > 1000 ||
    Object.keys(req.body).some((key) => key !== "text")
  )
    return res
      .status(400)
      .json({ message: "Phản hồi cần từ 1 đến 1000 ký tự." });
  const review = await Review.findById(req.params.id);
  if (!review)
    return res.status(404).json({ message: "Không tìm thấy đánh giá." });
  if (String(review.sellerId) !== req.user.id)
    return res
      .status(403)
      .json({ message: "Bạn không phải người bán của đánh giá này." });
  const now = new Date();
  review.reply = review.reply
    ? {
        text: req.body.text.trim(),
        repliedAt: review.reply.repliedAt,
        editedAt: now,
      }
    : { text: req.body.text.trim(), repliedAt: now };
  await review.save();
  res.json({ review: { id: review.id, reply: replyResponse(review.reply) } });
});

router.delete("/:id/reply", requireLogin, requireUser, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "ID đánh giá không hợp lệ." });
  const review = await Review.findById(req.params.id);
  if (!review)
    return res.status(404).json({ message: "Không tìm thấy đánh giá." });
  if (String(review.sellerId) !== req.user.id)
    return res
      .status(403)
      .json({ message: "Bạn không phải người bán của đánh giá này." });
  review.reply = undefined;
  await review.save();
  res.json({ review: { id: review.id, reply: null } });
});

export default router;
