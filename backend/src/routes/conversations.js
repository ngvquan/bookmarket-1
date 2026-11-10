import { Router } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { Conversation, Message, Listing, User, Shop } from "../models/index.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { editionDetails } from "../utils/catalog.js";

const router = Router();
router.use(requireLogin, requireUser);
const validBody = (body, fields) =>
  body &&
  typeof body === "object" &&
  !Array.isArray(body) &&
  Object.keys(body).every((key) => fields.includes(key));
const memberFilter = (userId) => ({
  $or: [{ buyerId: userId }, { sellerId: userId }],
});
const publicListing = {
  status: "approved",
  $or: [{ type: { $nin: ["new", "used"] } }, { stock: { $gt: 0 } }],
};
// Hoàn tất lưu tin trước khi cấp số thứ tự tiếp theo trong cùng cuộc trò chuyện.
const pendingWrites = new Map();
async function serializeWrite(id, work) {
  const previous = pendingWrites.get(id) || Promise.resolve();
  let release;
  const turn = new Promise((resolve) => {
    release = resolve;
  });
  pendingWrites.set(id, turn);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (pendingWrites.get(id) === turn) pendingWrites.delete(id);
  }
}

async function ownedConversation(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "Cuộc trò chuyện không hợp lệ." });
    return null;
  }
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    ...memberFilter(req.user._id),
  });
  if (!conversation)
    res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });
  return conversation;
}

async function conversationResponse(conversation, userId) {
  const buyer = String(conversation.buyerId) === String(userId);
  const otherId = buyer ? conversation.sellerId : conversation.buyerId;
  const [other, shop, unread] = await Promise.all([
    User.findById(otherId).select("name"),
    buyer ? Shop.findOne({ ownerId: otherId }).select("name") : null,
    Message.countDocuments({
      conversationId: conversation._id,
      recipientId: userId,
      readAt: null,
    }),
  ]);
  return {
    id: String(conversation._id),
    role: buyer ? "buyer" : "seller",
    other: {
      id: String(otherId),
      name: shop?.name || other?.name || "Tài khoản không còn hoạt động",
    },
    book: conversation.book?.title
      ? {
          listingId: conversation.book.listingId,
          title: conversation.book.title,
          author: conversation.book.author,
        }
      : null,
    lastText: conversation.lastText,
    lastMessageAt: conversation.lastMessageAt,
    lastSequence: conversation.lastSequence,
    otherReadSequence: buyer
      ? conversation.sellerReadSequence
      : conversation.buyerReadSequence,
    unread,
  };
}
const messageResponse = (message) => ({
  id: String(message._id),
  senderId: String(message.senderId),
  sequence: message.sequence,
  text: message.text,
  createdAt: message.createdAt,
  readAt: message.readAt,
});

router.get("/unread", async (req, res) => {
  const rows = await Message.aggregate([
    { $match: { recipientId: req.user._id, readAt: null } },
    {
      $lookup: {
        from: "conversations",
        localField: "conversationId",
        foreignField: "_id",
        as: "conversation",
      },
    },
    { $unwind: "$conversation" },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$conversation.buyerId", req.user._id] },
            "buyer",
            "seller",
          ],
        },
        count: { $sum: 1 },
      },
    },
  ]);
  const counts = { buyer: 0, seller: 0 };
  for (const row of rows) counts[row._id] = row.count;
  res.json({ ...counts, total: counts.buyer + counts.seller });
});

router.get("/", async (req, res) => {
  const { role = "buyer" } = req.query;
  const page = Number(req.query.page || 1),
    limit = Number(req.query.limit || 20);
  if (
    !["buyer", "seller"].includes(role) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    return res.status(400).json({ message: "Bộ lọc hộp thư không hợp lệ." });
  }
  const filter = { [role === "buyer" ? "buyerId" : "sellerId"]: req.user._id };
  const total = await Conversation.countDocuments(filter);
  const conversations = await Conversation.find(filter)
    .sort({ lastMessageAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const items = await Promise.all(
    conversations.map((conversation) =>
      conversationResponse(conversation, req.user._id),
    ),
  );
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

router.post("/", async (req, res) => {
  if (
    !validBody(req.body, ["listingId", "sellerId"]) ||
    Boolean(req.body.listingId) === Boolean(req.body.sellerId)
  ) {
    return res
      .status(400)
      .json({
        message: "Chọn một cuốn sách hoặc một người bán để bắt đầu chat.",
      });
  }
  let sellerId, book;
  if (req.body.listingId) {
    if (
      typeof req.body.listingId !== "string" ||
      req.body.listingId.length > 100
    )
      return res.status(400).json({ message: "Tin sách không hợp lệ." });
    const listing = await Listing.findOne({
      _id: req.body.listingId,
      ...publicListing,
    });
    if (!listing)
      return res.status(404).json({ message: "Tin sách không còn hiển thị." });
    sellerId = listing.sellerId;
    const details = await editionDetails(listing.editionId);
    book = {
      listingId: listing.id,
      title: details.title,
      author: details.author,
    };
  } else {
    if (
      typeof req.body.sellerId !== "string" ||
      !mongoose.isValidObjectId(req.body.sellerId)
    )
      return res.status(400).json({ message: "Người bán không hợp lệ." });
    sellerId = new mongoose.Types.ObjectId(req.body.sellerId);
    if (!(await Listing.exists({ sellerId, ...publicListing })))
      return res
        .status(404)
        .json({ message: "Không tìm thấy người bán có sách đang hiển thị." });
  }
  if (String(sellerId) === req.user.id)
    return res
      .status(400)
      .json({ message: "Bạn không thể tự nhắn tin cho mình." });
  if (!(await User.exists({ _id: sellerId })))
    return res.status(404).json({ message: "Người bán không còn hoạt động." });
  const pair = { buyerId: req.user._id, sellerId };
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(
      pair,
      { $setOnInsert: { ...pair, book } },
      { upsert: true, new: true, runValidators: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    conversation = await Conversation.findOne(pair);
  }
  res.json({
    conversation: await conversationResponse(conversation, req.user._id),
  });
});

router.get("/:id/messages", async (req, res) => {
  const conversation = await ownedConversation(req, res);
  if (!conversation) return;
  const { before, after } = req.query;
  const limit = Number(req.query.limit || 30);
  if (
    (before !== undefined && after !== undefined) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    [before, after].some(
      (value) =>
        value !== undefined &&
        (!Number.isSafeInteger(Number(value)) || Number(value) < 0),
    )
  ) {
    return res.status(400).json({ message: "Mốc tin nhắn không hợp lệ." });
  }
  const filter = { conversationId: conversation._id };
  if (before !== undefined) filter.sequence = { $lt: Number(before) };
  if (after !== undefined) filter.sequence = { $gt: Number(after) };
  const messages = await Message.find(filter)
    .sort({ sequence: after !== undefined ? 1 : -1 })
    .limit(limit + 1);
  const hasMore = messages.length > limit;
  const items = messages.slice(0, limit);
  if (after === undefined) items.reverse();
  res.json({
    conversation: await conversationResponse(conversation, req.user._id),
    items: items.map(messageResponse),
    hasMore,
  });
});

router.post("/:id/messages", async (req, res) => {
  const conversation = await ownedConversation(req, res);
  if (!conversation) return;
  if (
    !validBody(req.body, ["text", "clientId"]) ||
    typeof req.body.text !== "string" ||
    !req.body.text.trim() ||
    req.body.text.trim().length > 2000 ||
    (req.body.clientId !== undefined &&
      (typeof req.body.clientId !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(req.body.clientId)))
  ) {
    return res
      .status(400)
      .json({ message: "Tin nhắn cần từ 1 đến 2.000 ký tự." });
  }
  const recipientId =
    String(conversation.buyerId) === req.user.id
      ? conversation.sellerId
      : conversation.buyerId;
  if (!(await User.exists({ _id: recipientId })))
    return res
      .status(409)
      .json({ message: "Tài khoản nhận không còn hoạt động." });
  return serializeWrite(conversation.id, async () => {
    const key = {
      conversationId: conversation._id,
      senderId: req.user._id,
      clientId: req.body.clientId || randomUUID(),
    };
    const text = req.body.text.trim();
    let message = await Message.findOne(key);
    let created = false;
    if (!message) {
      const reserved = await Conversation.findByIdAndUpdate(
        conversation._id,
        { $inc: { nextSequence: 1 } },
        { new: true },
      );
      try {
        message = await Message.create({
          ...key,
          recipientId,
          sequence: reserved.nextSequence,
          text,
        });
        created = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        message = await Message.findOne(key);
        if (!message) throw error;
      }
    }
    if (message.text !== text)
      return res
        .status(409)
        .json({ message: "Mã gửi này đã được dùng cho một tin nhắn khác." });
    await Conversation.updateOne(
      { _id: conversation._id, lastSequence: { $lt: message.sequence } },
      {
        $set: {
          lastSequence: message.sequence,
          lastText: message.text,
          lastMessageAt: message.createdAt,
        },
      },
    );
    res.status(created ? 201 : 200).json({ message: messageResponse(message) });
  });
});

router.post("/:id/read", async (req, res) => {
  const conversation = await ownedConversation(req, res);
  if (!conversation) return;
  const through = req.body?.through;
  if (
    !validBody(req.body, ["through"]) ||
    !Number.isSafeInteger(through) ||
    through < 0 ||
    (through > 0 &&
      !(await Message.exists({
        conversationId: conversation._id,
        sequence: through,
      })))
  ) {
    return res.status(400).json({ message: "Mốc đã đọc không hợp lệ." });
  }
  await Message.updateMany(
    {
      conversationId: conversation._id,
      recipientId: req.user._id,
      readAt: null,
      sequence: { $lte: through },
    },
    { $set: { readAt: new Date() } },
  );
  const field =
    String(conversation.buyerId) === req.user.id
      ? "buyerReadSequence"
      : "sellerReadSequence";
  await Conversation.updateOne(
    { _id: conversation._id },
    { $max: { [field]: through } },
  );
  res.status(204).end();
});

export default router;
