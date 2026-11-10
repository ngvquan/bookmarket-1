// Xuất database đang cấu hình thành Extended JSON và tài liệu field, không sửa dữ liệu.
import "dotenv/config";
import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allModels } from "../src/models/index.js";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const models = {};
for (const model of allModels) models[model.collection.name] = model;
const descriptions = {
  _id: "ID bản ghi",
  name: "Tên tài khoản/gian hàng",
  email: "Email duy nhất",
  passwordHash: "Mật khẩu đã băm bcrypt",
  addresses: "Tối đa 3 địa chỉ nhận hàng lưu theo tài khoản",
  favorites: "Danh sách ID tin sách yêu thích của tài khoản",
  label: "Tên gợi nhớ của địa chỉ",
  address: "Địa chỉ nhận hàng đầy đủ",
  isDefault: "Địa chỉ được tự chọn khi đặt hàng",
  biography: "Giới thiệu tác giả",
  nameSearch: "Tên không dấu để tìm kiếm",
  catalogKey: "Khóa chống tạo trùng tác phẩm",
  bookId: "Tác phẩm của phiên bản",
  editionId: "Phiên bản của tin bán",
  authorIds: "Danh sách tác giả",
  categoryId: "Thể loại tác phẩm",
  publisherId: "Nhà xuất bản phiên bản",
  ownerId: "User sở hữu shop",
  contactName: "Tên người liên hệ riêng tư của shop",
  contactPhone: "Số điện thoại liên hệ của shop",
  contactEmail: "Email liên hệ của shop",
  pickupAddress: "Địa chỉ lấy/trả hàng: province, ward, detail",
  isRegistrationComplete: "Hồ sơ shop đã đủ và hợp lệ để đăng sách mới/ebook",
  registrationCompletedAt: "Thời điểm hoàn tất hồ sơ shop do server đặt",
  idempotencyKey: "Mã chống đặt trùng; unique cùng buyerId",
  requestHash: "SHA-256 nội dung đặt hàng đã chuẩn hóa để kiểm tra gửi lại",
  conversationId: "Cuộc trò chuyện chứa tin nhắn",
  senderId: "User gửi tin, lấy từ JWT",
  recipientId: "User nhận tin trong cuộc trò chuyện",
  clientId: "Mã chống gửi trùng tin nhắn",
  sequence: "Thứ tự tin nhắn trong cuộc trò chuyện",
  readAt: "Thời điểm người nhận đọc tin, null nếu chưa đọc",
  sellerId: "User đăng tin",
  buyerId: "User mua hàng",
  orderId: "Đơn mẹ của đơn con",
  digitalOrderId: "Đơn ebook đã thanh toán cấp quyền sở hữu",
  transferCode: "Mã BM và 10 chữ/số dùng khớp nội dung chuyển khoản",
  qrImageUrl: "Link ảnh VietQR từ server",
  bankTransactionId: "ID giao dịch ngân hàng, unique và sparse",
  transactionId: "ID giao dịch ngân hàng dùng đối soát, unique",
  reason: "Lý do giao dịch ngân hàng chưa khớp",
  resolved: "Giao dịch chưa khớp đã được xử lý",
  followerId: "User đang theo dõi gian hàng",
  reply: "Phản hồi công khai của người bán cho đánh giá",
  hiddenBy: "Tin do seller hay admin ẩn",
  images: "Tối đa 5 ảnh JPEG/PNG/WebP; database chỉ lưu ID tệp và contentType",
  ebookFileId:
    "ID file PDF lưu riêng tại backend/storage, không trả công khai qua API JSON",
  ebookPageCount: "Số trang PDF đã kiểm tra khi upload",
  paidAmount: "Số tiền thực nhận đã xác minh",
  paidAt: "Thời điểm server xác nhận đã thanh toán",
  grantedAt: "Thời điểm cấp quyền sở hữu ebook",
  cartKey: "Khóa bộ listingIds để dùng lại đơn đang chờ",
  bank: "Thông tin tài khoản nhận tại thời điểm tạo đơn",
  subOrderId: "Đơn con completed chứng minh người mua được đánh giá",
  listingId: "Tin sách đã mua và được đánh giá",
  comment: "Nhận xét người mua, trim và tối đa 2000 ký tự",
  receiverName: "Họ tên người nhận",
  receiverPhone: "Số điện thoại nhận hàng",
  receiverAddress: "Địa chỉ nhận hàng",
  paymentMethod: "Phương thức thanh toán, hiện chỉ cod",
  itemsTotal: "Tổng tiền sách snapshot",
  shippingTotal: "Tổng phí của các đơn con",
  total: "Tổng tiền sách và phí giao",
  shopName: "Tên shop hoặc người bán tại lúc đặt",
  items:
    "Snapshot tên/giá; đơn giấy có type/isbn/quantity, đơn ebook có editionId/sellerId",
  shippingFee: "Phí cố định của đơn con",
  cancelReason: "Lý do hủy, bước đặt hàng để rỗng",
  shipment: "Dịch vụ, phí, mã vận đơn và các sự kiện",
  shopId: "Shop của tin, có thể null",
  title: "Tên tác phẩm",
  author: "Tác giả",
  isbn: "Mã phiên bản, unique khi có giá trị",
  publisher: "Nhà xuất bản",
  year: "Năm xuất bản",
  binding: "Loại bìa hoặc PDF",
  type: "new/used/digital",
  category: "Thể loại",
  description: "Mô tả",
  price: "Giá bán",
  stock: "Số lượng",
  condition: "Tình trạng sách",
  status: "Trạng thái tin hoặc đơn; xem DATA_MODEL.md cho enum tương ứng",
  location: "Địa điểm",
  style: "Kiểu bìa CSS",
  coverTitle: "Tiêu đề trên bìa",
  subtitle: "Phụ đề",
  original: "Giá gốc minh họa",
  rating: "Điểm đánh giá thật từ người mua: số nguyên 1 đến 5",
  reviews: "Lượt đánh giá minh họa",
  titleSearch: "Tên sách không dấu để tìm kiếm",
  authorSearch: "Tác giả không dấu để tìm kiếm",
  publisherSearch: "NXB không dấu để tìm kiếm",
  createdAt: "Thời điểm tạo",
  updatedAt: "Thời điểm sửa",
  __v: "Phiên bản nội bộ Mongoose",
  isActive: "Field cũ, model hiện tại không dùng",
  searchText: "Field tìm kiếm cũ, không còn dùng",
  userId: "User sở hữu bản ghi",
  message: "Nội dung thông báo thay đổi trạng thái đơn",
  familyId: "Nhóm phiên cũ",
  tokenHash: "Hash token cũ",
  revokedAt: "Thời điểm thu hồi cũ",
  expiresAt: "Thời điểm đơn hoặc phiên hết hạn",
};

// Xuất cả schema của collection rỗng để người nhận vẫn thấy field/index mới.
function bsonType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value !== "object" && typeof value !== "number")
    return typeof value;
  const data = mongoose.mongo.BSON.EJSON.serialize(value, { relaxed: false });
  return data?.$oid
    ? "objectId"
    : data?.$date
      ? "date"
      : data?.$numberInt
        ? "int"
        : data?.$numberLong
          ? "long"
          : data?.$numberDouble
            ? "double"
            : "object";
}
function describeFields(records, model) {
  const found = new Map();
  for (const record of records)
    for (const [name, value] of Object.entries(record)) {
      const field = found.get(name) || { types: new Set(), count: 0 };
      field.types.add(bsonType(value));
      field.count++;
      found.set(name, field);
    }
  if (model)
    model.schema.eachPath((name) => {
      if (!found.has(name))
        found.set(name, {
          types: new Set([model.schema.path(name).instance]),
          count: 0,
        });
    });
  return [...found]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, field]) => {
      const schema = model?.schema.path(name);
      return {
        name,
        types: [...field.types],
        presentInDocuments: field.count,
        inCurrentModel: !!schema,
        required: !!schema?.options.required,
        unique: !!schema?.options.unique,
        ref: schema?.options.ref || "",
        enum: schema?.enumValues,
        min: schema?.options.min,
        max: schema?.options.max,
        children: describeItemFields(schema?.schema),
        description:
          descriptions[name] ||
          (schema?.enumValues?.length
            ? "Giá trị: " + schema.enumValues.join("/")
            : ""),
      };
    });
}
function describeItemFields(schema) {
  if (!schema) return undefined;
  const fields = [];
  schema.eachPath((name, field) =>
    fields.push({
      name,
      type: field.instance,
      required: !!field.options.required,
      ref: field.options.ref || "",
      enum: field.enumValues,
      min: field.options.min,
      max: field.options.max,
    }),
  );
  return fields;
}
function declaredIndexes(model) {
  return [
    { name: "_id_", key: { _id: 1 } },
    ...(model?.schema.indexes() || []).map(([key, options]) => ({
      key,
      ...options,
      name:
        options.name ||
        Object.entries(key)
          .map(([field, value]) => field + "_" + value)
          .join("_"),
    })),
  ];
}
async function exportCollection(db, output, name, exists) {
  const model = models[name];
  const records = exists
    ? await db
        .collection(name)
        .find(
          name === "listings"
            ? { type: { $in: ["new", "used", "digital"] } }
            : {},
        )
        .toArray()
    : [];
  // Chỉ làm sạch bản xuất, không xóa hay sửa dữ liệu trên database gốc.
  if (name === "listings") for (const record of records) delete record.wanted;
  const json = mongoose.mongo.BSON.EJSON.serialize(records, { relaxed: false });
  await fs.writeFile(
    path.join(output, "data", name + ".json"),
    JSON.stringify(json, null, 2),
    "utf8",
  );
  const fields = describeFields(records, model);
  const indexes = exists
    ? await db.collection(name).indexes()
    : declaredIndexes(model);
  return {
    name,
    active: !!model,
    documents: records.length,
    fieldCount: fields.length,
    fields,
    indexes,
  };
}
function csvCell(value) {
  return '"' + String(value ?? "").replaceAll('"', '""') + '"';
}
function collectionSection(info) {
  const rows = info.fields
    .map(
      (field) =>
        `| ${field.name} | ${field.types.join(" / ")} | ${field.inCurrentModel ? "Có" : "Không"} | ${field.description} |`,
    )
    .join("\n");
  return `## ${info.name}\n\n${info.documents} bản ghi.\n\n| Field | Kiểu | Trong model | Ý nghĩa |\n|---|---|---|---|\n${rows}`;
}
try {
  await mongoose.connect(process.env.MONGO_URI, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  const output = path.join(root, "exports", "BookMarket-database-current");
  await fs.mkdir(path.join(output, "data"), { recursive: true });
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((item) => item.name)
      .filter((name) => !name.startsWith("system.")),
  );
  const names = [...new Set([...existing, ...Object.keys(models)])].sort();
  const metadata = {
    database: db.databaseName,
    exportedAt: new Date().toISOString(),
    collections: [],
  };
  for (const name of names)
    metadata.collections.push(
      await exportCollection(db, output, name, existing.has(name)),
    );
  const summary = metadata.collections
    .map((info) => `| ${info.name} | ${info.documents} | ${info.fieldCount} |`)
    .join("\n");
  const report =
    `# Cấu trúc database BookMarket\n\n| Collection | Bản ghi | Field |\n|---|---:|---:|\n${summary}\n\n` +
    metadata.collections.map(collectionSection).join("\n\n") +
    "\n\n" +
    (await fs.readFile(path.join(root, "docs/DATA_MODEL.md"), "utf8"));
  const csv = [
    [
      "Collection",
      "Field",
      "Kieu BSON/schema",
      "Trong model",
      "Bat buoc",
      "Unique",
      "Ref",
      "Mo ta",
    ],
  ];
  for (const info of metadata.collections)
    for (const field of info.fields)
      csv.push([
        info.name,
        field.name,
        field.types.join("/"),
        field.inCurrentModel,
        field.required,
        field.unique,
        field.ref,
        field.description,
      ]);
  await fs.writeFile(
    path.join(output, "schema.json"),
    JSON.stringify(metadata, null, 2),
    "utf8",
  );
  await fs.writeFile(path.join(output, "CAU_TRUC_DATABASE.md"), report, "utf8");
  await fs.writeFile(
    path.join(output, "DANH_SACH_FIELD.csv"),
    "\uFEFF" + csv.map((row) => row.map(csvCell).join(",")).join("\r\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(output, "README.md"),
    await fs.readFile(path.join(root, "docs/DATABASE_EXPORT.md"), "utf8"),
    "utf8",
  );
  console.log(
    JSON.stringify({
      output,
      collections: metadata.collections.map((info) => ({
        name: info.name,
        documents: info.documents,
      })),
    }),
  );
} finally {
  await mongoose.disconnect();
}
