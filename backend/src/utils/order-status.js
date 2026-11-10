// Một bảng chuyển trạng thái; điều kiện status ngăn hai lần bấm hoàn kho hai lần.
import SubOrder from "../models/SubOrder.js";
import { restoreItems } from "./order.js";
import { withOrderTransaction } from "./order-transaction.js";
import Notification from "../models/Notification.js";

export const allowedNext = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["delivered", "returned"],
  delivered: ["completed", "returned"],
  completed: ["returned"],
  cancelled: [],
  returned: [],
};

export async function changeStatus(subOrder, status, note, extra = {}) {
  if (!allowedNext[subOrder.status]?.includes(status)) {
    const error = new Error(
      "Không thể chuyển từ " + subOrder.status + " sang " + status + ".",
    );
    error.status = 409;
    throw error;
  }
  const changes = { status };
  if (status === "cancelled") changes.cancelReason = note;
  if (extra.trackingCode) changes["shipment.trackingCode"] = extra.trackingCode;
  return withOrderTransaction(async (session) => {
    const updated = await SubOrder.findOneAndUpdate(
      { _id: subOrder._id, status: subOrder.status },
      {
        $set: changes,
        $push: { "shipment.events": { at: new Date(), status, note } },
      },
      { new: true, runValidators: true, session },
    );
    if (!updated) {
      const error = new Error(
        "Đơn đã đổi trạng thái. Hãy tải lại trước khi thao tác.",
      );
      error.status = 409;
      throw error;
    }
    if (status === "cancelled" || status === "returned")
      await restoreItems(updated.items, session);
    await createStatusNotifications(updated, status, extra.actorId, session);
    return updated;
  });
}

async function createStatusNotifications(subOrder, status, actorId, session) {
  const recipients = [
    { id: String(subOrder.buyerId), buyer: true },
    { id: String(subOrder.sellerId), buyer: false },
  ].filter((recipient) => recipient.id !== String(actorId || ""));
  if (!recipients.length) return;
  const code = String(subOrder.orderId).slice(-8);
  const labels = {
    confirmed: "đã được người bán xác nhận",
    shipping: "đang được giao",
    delivered: "đã giao thành công",
    completed: "đã hoàn tất",
    cancelled: "đã bị hủy",
    returned: "đã hoàn hàng",
  };
  const docs = recipients.map((recipient) => ({
    userId: recipient.id,
    orderId: subOrder.orderId,
    subOrderId: subOrder._id,
    status,
    title: `Đơn #${code} ${labels[status]}`,
    message: recipient.buyer
      ? buyerMessage(status, subOrder.shopName)
      : sellerMessage(status),
  }));
  await Notification.insertMany(docs, { session });
}
function buyerMessage(status, shopName) {
  return {
    confirmed: `${shopName} đã xác nhận và đang chuẩn bị sách.`,
    shipping: `${shopName} đã giao sách cho đơn vị vận chuyển.`,
    delivered:
      "Đơn đã được giao. Hãy kiểm tra và xác nhận khi bạn đã nhận sách.",
    cancelled: `Phần đơn từ ${shopName} đã bị hủy.`,
    returned: `Phần đơn từ ${shopName} đã được hoàn hàng.`,
    completed: "Đơn hàng đã hoàn tất.",
  }[status];
}
function sellerMessage(status) {
  return {
    delivered: "Đơn vị vận chuyển đã giao sách cho khách.",
    completed: "Người mua đã xác nhận nhận sách.",
    cancelled: "Người mua đã hủy phần đơn này.",
    returned: "Phần đơn đã được hoàn lại cho người bán.",
    confirmed: "Đơn đã được xác nhận.",
    shipping: "Đơn đang được giao.",
  }[status];
}
