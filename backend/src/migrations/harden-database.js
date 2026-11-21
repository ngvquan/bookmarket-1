import mongoose from "mongoose";
import { allModels } from "../models/index.js";
import { hasCompleteShopDetails } from "../utils/shop.js";
import { backupDatabase } from "../utils/database-backup.js";

const valueAt = (document, field) =>
  field.split(".").reduce((value, key) => value?.[key], document);
const indexName = (key, options) =>
  options.name ||
  Object.entries(key)
    .map(([field, direction]) => `${field}_${direction}`)
    .join("_");

// Chỉ chuyển các field biết rõ ý nghĩa; dữ liệu sai khác cần xử lý thủ công.
export async function hardenDatabase({ apply = false } = {}) {
  const db = mongoose.connection.db;
  const records = {};
  const updates = [];
  const issues = [];
  const indexes = [];
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (item) => item.name,
    ),
  );
  for (const Model of allModels) {
    const name = Model.collection.name;
    records[name] = existing.has(name)
      ? await db.collection(name).find().toArray()
      : [];
    for (const document of records[name]) {
      const set = {},
        unset = {};
      if (
        ["users", "admins"].includes(name) &&
        typeof document.email === "string" &&
        document.email !== document.email.trim().toLowerCase()
      )
        set.email = document.email.trim().toLowerCase();
      if (name === "shops") {
        if (document.paymentBank !== undefined) unset.paymentBank = "";
        const complete = hasCompleteShopDetails(document);
        if (document.isRegistrationComplete !== complete)
          set.isRegistrationComplete = complete;
        if (complete && !document.registrationCompletedAt)
          set.registrationCompletedAt =
            document.updatedAt || document.createdAt || new Date();
        if (!complete && document.registrationCompletedAt)
          unset.registrationCompletedAt = "";
      }
      if (name === "orders" && !document.idempotencyKey)
        set.idempotencyKey = `legacy_${document._id}`;
      if (name === "listings") {
        if (
          document.type === "used" &&
          document.status === "sold" &&
          (document.stock === 1 || document.stock === undefined)
        )
          set.stock = 0;
        if (
          ["new", "used"].includes(document.type) &&
          document.stock === undefined
        )
          set.stock =
            document.type === "used" && document.status !== "sold" ? 1 : 0;
        if (!document.status) set.status = "approved";
      }
      if (
        name === "editions" &&
        (document.isbn === "" || document.isbn === null)
      )
        unset.isbn = "";
      if (Object.keys(set).length || Object.keys(unset).length) {
        updates.push({ collection: name, id: document._id, set, unset });
        Object.assign(document, set);
        for (const key of Object.keys(unset)) delete document[key];
      }
      // Hydrate để chạy các validator của đúng schema, kể cả ràng buộc tổng tiền.
      try {
        await Model.hydrate(document).validate();
      } catch (error) {
        issues.push({
          collection: name,
          id: String(document._id),
          message: error.message,
        });
      }
      Model.schema.eachPath((field, schema) => {
        const value = valueAt(document, field);
        if (value === undefined || value === null || field.includes("."))
          return;
        const wrong =
          (schema.instance === "ObjectId" && value?._bsontype !== "ObjectId") ||
          (schema.instance === "Number" && typeof value !== "number") ||
          (schema.instance === "Boolean" && typeof value !== "boolean") ||
          (schema.instance === "Date" && !(value instanceof Date)) ||
          (schema.instance === "String" && typeof value !== "string");
        if (wrong)
          issues.push({
            collection: name,
            id: String(document._id),
            message: `Field ${field} sai kiểu BSON; cần ${schema.instance}.`,
          });
      });
    }
    // Kiểm tra duplicate trước khi ghi dữ liệu hoặc tạo unique index.
    for (const [key, options] of Model.schema.indexes()) {
      if (!options.unique) continue;
      const seen = new Map();
      for (const document of records[name]) {
        const values = Object.keys(key).map((field) =>
          valueAt(document, field),
        );
        if (options.sparse && values.every((value) => value === undefined))
          continue;
        if (
          options.partialFilterExpression?.idempotencyKey &&
          typeof document.idempotencyKey !== "string"
        )
          continue;
        if (
          options.partialFilterExpression?.status &&
          document.status !== options.partialFilterExpression.status
        )
          continue;
        const signature = JSON.stringify(values);
        if (seen.has(signature))
          issues.push({
            collection: name,
            id: String(document._id),
            message: `Trùng unique index ${indexName(key, options)} với ${seen.get(signature)}.`,
          });
        seen.set(signature, String(document._id));
      }
    }
    const diff = existing.has(name)
      ? await Model.diffIndexes()
      : { toDrop: [], toCreate: Model.schema.indexes().map(([key]) => key) };
    indexes.push({ collection: name, ...diff });
  }

  // ref của Mongoose không tự kiểm tra bản ghi tồn tại, nên migration kiểm tra rõ.
  const ids = Object.fromEntries(
    Object.entries(records).map(([name, rows]) => [
      name,
      new Set(rows.map((row) => String(row._id))),
    ]),
  );
  const refs = {
    shops: { ownerId: "users" },
    books: { authorIds: "authors", categoryId: "categories" },
    editions: { bookId: "books", publisherId: "publishers" },
    listings: { editionId: "editions", sellerId: "users", shopId: "shops" },
    orders: { buyerId: "users" },
    suborders: { orderId: "orders", buyerId: "users", sellerId: "users" },
    conversations: { buyerId: "users", sellerId: "users" },
    messages: {
      conversationId: "conversations",
      senderId: "users",
      recipientId: "users",
    },
    digitalorders: { buyerId: "users" },
    ebookaccesses: {
      buyerId: "users",
      editionId: "editions",
      digitalOrderId: "digitalorders",
    },
    banktransactions: { orderId: "digitalorders" },
  };
  for (const [name, fields] of Object.entries(refs)) {
    for (const document of records[name]) {
      for (const [field, collection] of Object.entries(fields)) {
        const values = Array.isArray(document[field])
          ? document[field]
          : [document[field]];
        for (const value of values)
          if (value != null) {
            if (value?._bsontype !== "ObjectId")
              issues.push({
                collection: name,
                id: String(document._id),
                message: `Liên kết ${field} phải dùng ObjectId.`,
              });
            if (!ids[collection].has(String(value)))
              issues.push({
                collection: name,
                id: String(document._id),
                message: `Liên kết ${field} không tồn tại trong ${collection}.`,
              });
          }
      }
    }
  }
  const shops = new Map(records.shops.map((row) => [String(row._id), row]));
  const digitalOrders = new Map(
    records.digitalorders.map((row) => [String(row._id), row]),
  );
  for (const order of records.digitalorders)
    for (const item of order.items || []) {
      if (
        !ids.editions.has(String(item.editionId)) ||
        !ids.users.has(String(item.sellerId))
      )
        issues.push({
          collection: "digitalorders",
          id: String(order._id),
          message: "Phiên bản hoặc người bán của ebook không tồn tại.",
        });
    }
  for (const access of records.ebookaccesses) {
    const order = digitalOrders.get(String(access.digitalOrderId));
    if (
      !order ||
      order.status !== "paid" ||
      String(order.buyerId) !== String(access.buyerId) ||
      !order.items.some(
        (item) =>
          item.listingId === access.listingId &&
          String(item.editionId) === String(access.editionId),
      )
    )
      issues.push({
        collection: "ebookaccesses",
        id: String(access._id),
        message: "Quyền ebook không khớp đơn đã thanh toán.",
      });
  }
  const orders = new Map(records.orders.map((row) => [String(row._id), row]));
  const listings = new Map(
    records.listings.map((row) => [String(row._id), row]),
  );
  const conversations = new Map(
    records.conversations.map((row) => [String(row._id), row]),
  );
  for (const listing of records.listings)
    if (
      listing.shopId &&
      String(shops.get(String(listing.shopId))?.ownerId) !==
        String(listing.sellerId)
    )
      issues.push({
        collection: "listings",
        id: String(listing._id),
        message: "shopId không thuộc sellerId của tin.",
      });
  for (const sub of records.suborders) {
    if (
      String(orders.get(String(sub.orderId))?.buyerId) !== String(sub.buyerId)
    )
      issues.push({
        collection: "suborders",
        id: String(sub._id),
        message: "buyerId không khớp đơn mẹ.",
      });
    for (const item of sub.items || []) {
      const listing = listings.get(String(item.listingId));
      // Tin đã xóa được giữ trong snapshot lịch sử; đơn đang xử lý phải còn tin.
      if (
        ["pending", "confirmed", "shipping", "delivered"].includes(
          sub.status,
        ) &&
        (!listing ||
          String(listing.sellerId) !== String(sub.sellerId) ||
          listing.type !== item.type)
      )
        issues.push({
          collection: "suborders",
          id: String(sub._id),
          message: "Dòng sách đang xử lý không khớp tin bán.",
        });
    }
  }
  for (const message of records.messages) {
    const conversation = conversations.get(String(message.conversationId));
    const members = [
      String(conversation?.buyerId),
      String(conversation?.sellerId),
    ];
    if (
      !members.includes(String(message.senderId)) ||
      !members.includes(String(message.recipientId)) ||
      String(message.senderId) === String(message.recipientId)
    )
      issues.push({
        collection: "messages",
        id: String(message._id),
        message: "Người gửi/nhận không khớp cuộc trò chuyện.",
      });
  }

  const report = {
    database: db.databaseName,
    mode: apply ? "apply" : "dry-run",
    updates: updates.length,
    indexes,
    issues,
    counts: Object.fromEntries(
      Object.entries(records).map(([name, rows]) => [name, rows.length]),
    ),
  };
  if (!apply || issues.length) return report;
  // Không thay dữ liệu/index trước khi bản sao lưu được ghi và đọc lại thành công.
  report.backup = await backupDatabase(db);
  for (const update of updates) {
    const changes = {};
    if (Object.keys(update.set).length) changes.$set = update.set;
    if (Object.keys(update.unset).length) changes.$unset = update.unset;
    await db
      .collection(update.collection)
      .updateOne({ _id: update.id }, changes);
  }
  for (const Model of allModels) await Model.syncIndexes();
  return report;
}
