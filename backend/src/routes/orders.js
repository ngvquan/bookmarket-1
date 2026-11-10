// Đặt sách giấy: trừ kho và lưu đơn trong cùng transaction.
import { Router } from "express";
import mongoose from "mongoose";
import {
  Listing,
  Order,
  SubOrder,
  Shop,
  User,
  Notification,
} from "../models/index.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { editionDetails } from "../utils/catalog.js";
import { readOrder, orderRequestHash } from "../utils/order.js";
import { withOrderTransaction } from "../utils/order-transaction.js";
import { getShippingFee } from "../utils/shipping.js";
import { listOrders } from "../utils/order-query.js";

const router = Router();

router.get("/mine", requireLogin, requireUser, async (req, res) => {
  res.json(await listOrders(req.query, req.user.id));
});

router.get("/:id", requireLogin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "ID đơn không hợp lệ." });
  const order = await Order.findById(req.params.id).lean();
  if (!order)
    return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
  const owner =
    req.accountType === "admin" || String(order.buyerId) === req.user.id;
  const filter = { orderId: order._id };
  if (!owner) filter.sellerId = req.user.id;
  const subOrders = await SubOrder.find(filter).sort({ _id: 1 }).lean();
  if (!owner && !subOrders.length)
    return res.status(403).json({ message: "Bạn không có quyền xem đơn này." });
  if (!owner) {
    // Không lộ tổng tiền hoặc các sách thuộc người bán khác trong cùng đơn mẹ.
    delete order.itemsTotal;
    delete order.shippingTotal;
    delete order.total;
  }
  res.json({ order: { ...order, subOrders } });
});

// stock >= quantity và $inc được MongoDB kiểm tra/cập nhật trong một thao tác.
router.post("/", requireLogin, requireUser, async (req, res) => {
  const input = readOrder(req.body);
  if (input.message) return res.status(400).json({ message: input.message });
  const data = input.data;
  const identity = {
    buyerId: req.user.id,
    idempotencyKey: data.idempotencyKey,
  };
  const requestHash = orderRequestHash(data);
  const existing = await findPreviousOrder(identity, requestHash);
  if (existing)
    return res.status(200).json({ order: existing, replayed: true });
  let result;
  try {
    result = await withOrderTransaction(async (session) => {
      const previous = await findPreviousOrder(identity, requestHash, session);
      if (previous) return { order: previous, replayed: true };
      const orderId = new mongoose.Types.ObjectId();
      const groups = new Map();
      for (const item of data.items) {
        const current = await Listing.findById(item.listingId).session(session);
        if (!current) {
          throwOrderError(
            409,
            "Tin không còn tồn tại: " + item.listingId,
            item.listingId,
          );
        }
        if (!["new", "used"].includes(current.type)) {
          throwOrderError(
            400,
            "Đơn COD chỉ nhận sách mới/cũ. Ebook cần thanh toán chuyển khoản qua /digital-orders.",
            item.listingId,
          );
        }
        if (String(current.sellerId) === req.user.id) {
          throwOrderError(
            403,
            "Không được mua tin của chính mình.",
            item.listingId,
          );
        }
        if (current.type === "used" && item.quantity !== 1) {
          throwOrderError(
            400,
            "Mỗi tin sách cũ chỉ có một cuốn.",
            item.listingId,
          );
        }
        const reserved = await Listing.findOneAndUpdate(
          {
            _id: item.listingId,
            status: "approved",
            type: current.type,
            stock: { $gte: item.quantity },
          },
          {
            $inc: { stock: -item.quantity },
            ...(current.type === "used" ? { $set: { status: "sold" } } : {}),
          },
          { session },
        );
        if (!reserved) {
          throwOrderError(
            409,
            "Tin không còn hiển thị, không đủ hàng hoặc đã có người mua: " +
              item.listingId,
            item.listingId,
          );
        }
        const metadata = await editionDetails(reserved.editionId, session);
        const sellerId = String(reserved.sellerId);
        let group = groups.get(sellerId);
        if (!group) {
          const shop = await Shop.findOne({
            ownerId: reserved.sellerId,
          }).session(session);
          const seller = shop
            ? null
            : await User.findById(reserved.sellerId)
                .select("name")
                .session(session);
          if (!shop && !seller)
            throw new Error(
              "Không tìm thấy người bán của tin " + item.listingId,
            );
          const service = Object.hasOwn(data.services, sellerId)
            ? data.services[sellerId]
            : "standard";
          const shippingFee = getShippingFee(service);
          group = {
            sellerId,
            shopName: shop?.name || seller.name,
            items: [],
            itemsTotal: 0,
            shippingFee,
            service,
          };
          groups.set(sellerId, group);
        }
        const snapshot = {
          listingId: reserved._id,
          type: reserved.type,
          title: metadata.title,
          author: metadata.author,
          isbn: metadata.isbn,
          price: reserved.price,
          quantity: item.quantity,
        };
        group.items.push(snapshot);
        group.itemsTotal += snapshot.price * snapshot.quantity;
      }
      for (const sellerId of Object.keys(data.services)) {
        if (!groups.has(sellerId))
          throwOrderError(400, "services chứa người bán không có trong đơn.");
      }
      let itemsTotal = 0;
      let shippingTotal = 0;
      for (const group of groups.values()) {
        itemsTotal += group.itemsTotal;
        shippingTotal += group.shippingFee;
      }
      const order = new Order({
        _id: orderId,
        buyerId: req.user.id,
        receiverName: data.receiverName,
        idempotencyKey: data.idempotencyKey,
        requestHash,
        receiverPhone: data.receiverPhone,
        receiverAddress: data.receiverAddress,
        paymentMethod: "cod",
        itemsTotal,
        shippingTotal,
        total: itemsTotal + shippingTotal,
      });
      await order.save({ session });
      const subOrders = [];
      for (const group of groups.values()) {
        const subOrder = new SubOrder({
          orderId,
          buyerId: req.user.id,
          sellerId: group.sellerId,
          shopName: group.shopName,
          items: group.items,
          itemsTotal: group.itemsTotal,
          shippingFee: group.shippingFee,
          status: "pending",
          shipment: {
            service: group.service,
            fee: group.shippingFee,
            trackingCode: "",
            events: [
              {
                at: new Date(),
                status: "pending",
                note: "Đã đặt đơn, chờ người bán xác nhận.",
              },
            ],
          },
        });
        await subOrder.save({ session });
        // Báo ngay cho người bán khi đơn mới đã được tạo và trừ kho thành công.
        await Notification.create(
          [
            {
              userId: group.sellerId,
              orderId,
              subOrderId: subOrder._id,
              status: "pending",
              title: "Bạn có đơn hàng mới",
              message: `Đơn #${String(orderId).slice(-8)} có ${group.items.reduce((sum, item) => sum + item.quantity, 0)} cuốn sách đang chờ xác nhận.`,
            },
          ],
          { session },
        );
        subOrders.push(subOrder);
      }
      return { order: { ...order.toObject(), subOrders }, replayed: false };
    });
  } catch (error) {
    // Unique index quyết định request thắng; transaction của request còn lại đã bị hủy.
    if (error.code !== 11000 || !error.keyPattern?.idempotencyKey) throw error;
    const previous = await findPreviousOrder(identity, requestHash);
    if (!previous) throw error;
    result = { order: previous, replayed: true };
  }
  // Chỉ trả thành công sau khi MongoDB đã commit cả đơn mẹ, đơn con và tồn kho.
  res.status(result.replayed ? 200 : 201).json(result);
});

async function findPreviousOrder(identity, requestHash, session = null) {
  const order = await Order.findOne(identity).session(session).lean();
  if (!order) return null;
  if (order.requestHash !== requestHash) {
    throwOrderError(
      409,
      "Mã đặt hàng đã dùng cho nội dung khác. Hãy kiểm tra đơn trước khi tạo lần đặt mới.",
    );
  }
  const subOrders = await SubOrder.find({ orderId: order._id })
    .session(session)
    .sort({ _id: 1 })
    .lean();
  return { ...order, subOrders };
}

// Gắn mã HTTP để transaction hủy các thay đổi và middleware trả thông báo rõ ràng.
function throwOrderError(status, message, listingId) {
  const error = new Error(message);
  error.status = status;
  error.listingId = listingId;
  throw error;
}

export default router;
