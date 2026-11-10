// Chuẩn hóa, kiểm tra tin đăng và chuyển document sang dữ liệu hiển thị.
// Tách các bước này khỏi route để phần kiểm tra quyền trong handler dễ đọc.

import { editionDetails } from "./catalog.js";
export { normalize, escapeRegex } from "./text.js";

// Ghép bản sửa với tin cũ, lấy đúng các trường được phép rồi kiểm tra bằng if.
export function readListing(body, old = {}, { requireIsbn = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      message: "Thông tin tin đăng không hợp lệ.",
    };
  }
  if (
    body.sellerId !== undefined ||
    body.owner !== undefined ||
    body.shopId !== undefined ||
    body.status !== undefined ||
    body._id !== undefined ||
    body.id !== undefined
  ) {
    return {
      message: "Không được tự đổi chủ tin, ID hoặc trạng thái.",
    };
  }
  const allowed = [
    "type",
    "title",
    "author",
    "isbn",
    "publisher",
    "year",
    "binding",
    "category",
    "price",
    "stock",
    "condition",
    "description",
    "location",
    "style",
    "coverTitle",
  ];
  const data = {};
  let changed = false;
  for (const field of allowed) {
    data[field] = old[field];
    if (body[field] !== undefined) {
      data[field] = body[field];
      changed = true;
    }
  }
  if (!changed) {
    return {
      message: "Chưa có thông tin tin đăng.",
    };
  }
  if (!["new", "used", "digital"].includes(data.type)) {
    return {
      message: "Loại tin không hợp lệ",
    };
  }
  const required = ["title", "author", "category", "description"];
  for (const field of required) {
    if (typeof data[field] !== "string" || !data[field].trim()) {
      return {
        message: "Tên sách, tác giả, thể loại và mô tả không được để trống.",
      };
    }
    data[field] = data[field].trim();
  }
  if (
    data.title.length > 180 ||
    data.author.length > 180 ||
    data.category.length > 100 ||
    data.description.length > 5000
  ) {
    return {
      message: "Nội dung tin đăng quá dài.",
    };
  }
  for (const field of [
    "isbn",
    "publisher",
    "location",
    "style",
    "coverTitle",
  ]) {
    if (data[field] === undefined) {
      continue;
    }
    if (typeof data[field] !== "string" || data[field].length > 500) {
      return {
        message: "Metadata tin đăng không hợp lệ.",
      };
    }
    data[field] = data[field].trim();
  }
  data.isbn = (data.isbn || "").replace(/[\s-]/g, "").toUpperCase();
  if (requireIsbn && !data.isbn) {
    return {
      message: "ISBN là bắt buộc khi đăng sách mới.",
    };
  }
  if (data.isbn && !/^(\d{9}[\dX]|\d{13})$/.test(data.isbn)) {
    return {
      message: "ISBN cần 10 hoặc 13 ký tự.",
    };
  }
  if (
    data.year !== undefined &&
    (!Number.isInteger(data.year) || data.year < 1400 || data.year > 2100)
  ) {
    return {
      message: "Năm xuất bản không hợp lệ.",
    };
  }
  if (data.style && !/^[a-z-]{1,30}$/.test(data.style)) {
    return {
      message: "Kiểu bìa minh họa không hợp lệ.",
    };
  }
  {
    if (
      typeof data.price !== "number" ||
      !Number.isSafeInteger(data.price) ||
      data.price < 0 ||
      data.price > 100000000
    ) {
      return {
        message: "Giá sách không hợp lệ.",
      };
    }
    if (data.type === "new") {
      if (
        !Number.isInteger(data.stock) ||
        data.stock < 0 ||
        data.stock > 100000
      ) {
        return {
          message: "Tồn kho phải là số nguyên từ 0 đến 100000.",
        };
      }
    } else if (data.type === "used") {
      if (body.stock !== undefined && body.stock !== 1) {
        return {
          message: "Mỗi tin sách cũ có một cuốn.",
        };
      }
      data.stock = 1;
    } else {
      data.stock = undefined;
    }
  }
  if (data.type === "used") {
    // Giao diện dùng type để phân biệt mới/cũ; condition chỉ còn cho dữ liệu cũ.
    if (
      data.condition !== undefined &&
      !["Như mới", "Còn tốt", "Đã cũ"].includes(data.condition)
    ) {
      return {
        message: "Hãy chọn tình trạng sách.",
      };
    }
  } else {
    data.condition = undefined;
  }
  if (data.type === "digital") {
    data.binding = "PDF";
  } else if (old.type === "digital" && body.binding === undefined) {
    data.binding = "Bìa mềm";
  }
  if (
    data.binding !== undefined &&
    !["Bìa mềm", "Bìa cứng", "PDF"].includes(data.binding)
  ) {
    return {
      message: "Loại bìa không hợp lệ.",
    };
  }
  return {
    data,
  };
}

// Populate chỉ lấy tên shop/user; không đưa email hoặc mật khẩu của người bán ra catalog.
export async function listingResponse(listing) {
  const metadataPromise = editionDetails(listing.editionId);
  await listing.populate([
    { path: "sellerId", select: "name" },
    { path: "shopId", select: "name" },
  ]);
  const data = listing.toObject();
  const sellerId = data.sellerId ? String(data.sellerId._id) : "";
  const shopId = data.shopId ? String(data.shopId._id) : null;
  const shop = data.shopId?.name || data.sellerId?.name || "Người bán";
  const metadata = await metadataPromise;
  delete data._id;
  delete data.__v;
  delete data.titleSearch;
  delete data.authorSearch;
  delete data.publisherSearch;
  delete data.searchText;
  // Không lộ ID file PDF. Ảnh chỉ trả ID để frontend tạo URL public có kiểm soát.
  const imageIds = (data.images || []).map((image) => image.id);
  const hasEbook = Boolean(data.ebookFileId);
  delete data.images;
  delete data.ebookFileId;
  delete data.ebookPageCount;
  return {
    ...data,
    ...metadata,
    id: String(listing._id),
    sellerId,
    owner: sellerId,
    shopId,
    shop,
    imageIds,
    hasEbook,
    pending: data.status === "pending",
    rejected: data.status === "rejected",
    hidden: data.status === "hidden",
    sold: data.status === "sold",
  };
}
