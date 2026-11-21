import { Router } from "express";
import { Shop, User } from "../models/index.js";
import { requireAdmin, requireLogin } from "../middleware/auth.js";
import { readPagination } from "../utils/pagination.js";
import { escapeRegex } from "../utils/text.js";

const router = Router();
router.use(requireLogin, requireAdmin);

router.get("/", async (req, res) => {
  const pagination = readPagination(req.query, { defaultLimit: 20 });
  const search = req.query.search === undefined ? "" : req.query.search;
  const scope = req.query.scope === undefined ? "all" : req.query.scope;
  if (!pagination || typeof search !== "string" || search.length > 100 ||
      !["all", "shop", "no_shop"].includes(scope)) {
    return res.status(400).json({ message: "Bộ lọc tài khoản không hợp lệ." });
  }

  const term = search.trim();
  const match = term ? {
    $or: [
      { name: { $regex: escapeRegex(term), $options: "i" } },
      { email: { $regex: escapeRegex(term), $options: "i" } },
    ],
  } : {};
  const { page, limit } = pagination;
  const pipeline = [
    { $match: match },
    { $lookup: {
      from: Shop.collection.name,
      let: { owner: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$ownerId", "$$owner"] } } },
        { $project: { name: 1, isRegistrationComplete: 1 } },
        { $limit: 1 },
      ],
      as: "shops",
    } },
    { $set: { shop: { $arrayElemAt: ["$shops", 0] } } },
  ];
  if (scope !== "all") {
    pipeline.push({ $match: {
      "shop._id": { $exists: scope === "shop" },
    } });
  }
  pipeline.push(
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: {
      totals: [{ $count: "count" }],
      items: [
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { name: 1, email: 1, createdAt: 1, shop: 1 } },
      ],
    } },
  );
  const [result] = await User.aggregate(pipeline);
  const total = result.totals[0]?.count || 0;
  res.json({
    items: result.items.map((user) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      shop: user.shop ? {
        id: String(user.shop._id),
        name: user.shop.name,
        isRegistrationComplete: Boolean(user.shop.isRegistrationComplete),
      } : null,
    })),
    total, page, limit, pages: Math.ceil(total / limit),
  });
});

export default router;
