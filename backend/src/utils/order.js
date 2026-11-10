// Kiểm tra đầu vào bằng if và hoàn kho dùng chung cho lỗi đặt/hủy/hoàn hàng.
import Listing from "../models/Listing.js";
import { createHash } from "node:crypto";
import { getShippingFee } from "./shipping.js";

export function readOrder(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { message: "Thông tin đơn hàng không hợp lệ." };
  }
  if (
    typeof body.idempotencyKey !== "string" ||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(body.idempotencyKey)
  ) {
    return {
      message:
        "Mỗi lần đặt hàng cần idempotencyKey từ 16 đến 128 ký tự chữ, số, dấu - hoặc _.",
    };
  }
  if (
    typeof body.receiverName !== "string" ||
    !body.receiverName.trim() ||
    body.receiverName.trim().length > 120
  ) {
    return { message: "Họ tên người nhận cần từ 1 đến 120 ký tự." };
  }
  if (
    typeof body.receiverPhone !== "string" ||
    !/^[0-9+ ]{9,15}$/.test(body.receiverPhone.trim()) ||
    !/[0-9]/.test(body.receiverPhone)
  ) {
    return {
      message: "Số điện thoại cần 9–15 ký tự gồm số, dấu + hoặc khoảng trắng.",
    };
  }
  if (
    typeof body.receiverAddress !== "string" ||
    !body.receiverAddress.trim() ||
    body.receiverAddress.trim().length > 1000
  ) {
    return { message: "Địa chỉ cần từ 1 đến 1000 ký tự." };
  }
  if (body.paymentMethod !== undefined && body.paymentMethod !== "cod") {
    return { message: "Hiện chỉ hỗ trợ thanh toán khi nhận hàng (cod)." };
  }
  if (
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 20
  ) {
    return { message: "Đơn cần từ 1 đến 20 dòng sách." };
  }
  const items = [];
  const listingIds = new Set();
  for (const item of body.items) {
    if (
      !item ||
      typeof item.listingId !== "string" ||
      !item.listingId.trim() ||
      item.listingId.length > 200
    ) {
      return { message: "Mỗi dòng cần listingId hợp lệ." };
    }
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      return { message: "Số lượng phải là số nguyên từ 1 đến 99." };
    }
    const listingId = item.listingId.trim();
    if (listingIds.has(listingId)) {
      return { message: "Không được trùng listingId trong đơn." };
    }
    listingIds.add(listingId);
    items.push({ listingId, quantity: item.quantity });
  }
  const services = body.services === undefined ? {} : body.services;
  if (
    !services ||
    typeof services !== "object" ||
    Array.isArray(services) ||
    Object.keys(services).length > 20
  ) {
    return { message: "services phải là object dịch vụ theo sellerId." };
  }
  for (const sellerId of Object.keys(services)) {
    if (!/^[a-f0-9]{24}$/i.test(sellerId)) {
      return { message: "sellerId trong services không hợp lệ." };
    }
    if (typeof services[sellerId] !== "string") {
      return { message: "Dịch vụ giao hàng phải là standard hoặc fast." };
    }
    try {
      getShippingFee(services[sellerId]);
    } catch (error) {
      return { message: error.message };
    }
  }
  return {
    data: {
      idempotencyKey: body.idempotencyKey,
      receiverName: body.receiverName.trim(),
      receiverPhone: body.receiverPhone.trim(),
      receiverAddress: body.receiverAddress.trim(),
      items,
      services,
    },
  };
}

// So sánh nội dung thật của đơn; bỏ các giá/tổng tiền giả do client gửi thêm.
export function orderRequestHash(data) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        receiverName: data.receiverName,
        receiverPhone: data.receiverPhone,
        receiverAddress: data.receiverAddress,
        items: [...data.items].sort((a, b) =>
          a.listingId.localeCompare(b.listingId),
        ),
        services: Object.fromEntries(
          Object.entries(data.services).sort(([a], [b]) => a.localeCompare(b)),
        ),
      }),
    )
    .digest("hex");
}

// Gọi trong transaction đổi trạng thái: nếu một dòng lỗi, MongoDB hủy toàn bộ.
export async function restoreItems(items, session) {
  for (const item of items) {
    let result;
    if (item.type === "new") {
      result = await Listing.updateOne(
        { _id: item.listingId, type: "new" },
        { $inc: { stock: item.quantity } },
        { session },
      );
    } else if (item.type === "used") {
      result = await Listing.updateOne(
        { _id: item.listingId, type: "used", status: "sold", stock: 0 },
        { $set: { status: "approved" }, $inc: { stock: item.quantity } },
        { session },
      );
    } else {
      throw new Error("Loại sách hoàn kho không hợp lệ: " + item.listingId);
    }
    if (result.matchedCount !== 1) {
      const error = new Error(
        "Không thể hoàn kho vì tin đã bị xóa hoặc thay đổi loại: " +
          item.listingId,
      );
      error.status = 409;
      throw error;
    }
  }
}
