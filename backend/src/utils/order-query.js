// Phân trang trên MongoDB; người bán chỉ nhận đơn con thuộc mình.
import { Order, SubOrder } from "../models/index.js";
import { allowedNext } from "./order-status.js";
import mongoose from "mongoose";

// Nhận hàng gồm cả đơn đang giao và hoàn thành; giữ bộ lọc completed cũ cho API.
const orderTabs = {
  all: [],
  pending: ["pending"],
  "to-ship": ["confirmed"],
  "to-receive": ["shipping", "delivered", "completed"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};
const combinedStatusFilters = { finished: ["delivered", "completed"] };

export function readOrderPage(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    const error = new Error("page phải từ 1 đến 100000, limit từ 1 đến 50.");
    error.status = 400;
    throw error;
  }
  if (
    query.status &&
    (typeof query.status !== "string" ||
      (!Object.hasOwn(allowedNext, query.status) &&
        !Object.hasOwn(combinedStatusFilters, query.status)))
  ) {
    const error = new Error("Trạng thái đơn không hợp lệ.");
    error.status = 400;
    throw error;
  }
  return { page, limit };
}

export async function listOrders(query, buyerId) {
  const { page, limit } = readOrderPage(query);
  if (
    query.tab !== undefined &&
    (typeof query.tab !== "string" || !Object.hasOwn(orderTabs, query.tab))
  ) {
    const error = new Error("Mục đơn hàng không hợp lệ.");
    error.status = 400;
    throw error;
  }
  if (query.tab !== undefined && query.status) {
    const error = new Error("Chỉ dùng tab hoặc status để lọc đơn hàng.");
    error.status = 400;
    throw error;
  }
  const statuses = query.tab
    ? orderTabs[query.tab]
    : query.status
      ? combinedStatusFilters[query.status] || [query.status]
      : [];
  const filter = buyerId ? { buyerId } : {};
  if (statuses.length)
    filter._id = {
      $in: await SubOrder.distinct("orderId", {
        ...(buyerId ? { buyerId } : {}),
        status: { $in: statuses },
      }),
    };
  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const items = [];
  for (const order of orders) {
    // Một đơn có nhiều shop: tab chỉ hiện các phần đơn khớp trạng thái đang chọn.
    const subOrders = await SubOrder.find({
      orderId: order._id,
      ...(query.tab && statuses.length ? { status: { $in: statuses } } : {}),
    })
      .sort({ _id: 1 })
      .lean();
    items.push({ ...order, subOrders });
  }
  const counts = buyerId ? await buyerOrderCounts(buyerId) : undefined;
  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    ...(counts ? { counts } : {}),
  };
}

async function buyerOrderCounts(buyerId) {
  const group = { _id: null };
  for (const [tab, statuses] of Object.entries(orderTabs)) {
    if (tab === "all") continue;
    group[tab] = {
      $sum: {
        $cond: [
          {
            $gt: [{ $size: { $setIntersection: ["$statuses", statuses] } }, 0],
          },
          1,
          0,
        ],
      },
    };
  }
  // Đếm toàn bộ đơn của buyer. Một đơn nhiều shop chỉ đếm một lần trong từng tab.
  const [all, rows] = await Promise.all([
    Order.countDocuments({ buyerId }),
    SubOrder.aggregate([
      { $match: { buyerId: new mongoose.Types.ObjectId(String(buyerId)) } },
      { $group: { _id: "$orderId", statuses: { $addToSet: "$status" } } },
      { $group: group },
    ]),
  ]);
  const counts = { all };
  for (const tab of Object.keys(orderTabs))
    if (tab !== "all") counts[tab] = rows[0]?.[tab] || 0;
  return counts;
}

export async function listSubOrders(query, sellerId) {
  const { page, limit } = readOrderPage(query);
  const filter = sellerId ? { sellerId } : {};
  if (query.status)
    filter.status = combinedStatusFilters[query.status]
      ? { $in: combinedStatusFilters[query.status] }
      : query.status;
  const total = await SubOrder.countDocuments(filter);
  const items = await SubOrder.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("orderId", "receiverName receiverPhone receiverAddress createdAt")
    .lean();
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}
