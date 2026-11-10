// Quy tắc tin khả dụng, ISBN và catalog cũ; phí giao lấy từ API dịch vụ.
import { initialBooks } from "../data/books.js";
import { normalize } from "./format.js";
import { identifyListing } from "./identity.js";

// ISBN, năm và nhà xuất bản dưới đây là dữ liệu minh họa cho bản demo.
const editions = Object.fromEntries(
  initialBooks.map((book, index) => {
    const stem = `97800000${String(index + 1).padStart(4, "0")}`;
    const sum = [...stem].reduce(
      (total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1),
      0,
    );
    return [
      book.id,
      {
        isbn: stem + ((10 - (sum % 10)) % 10),
        publisher:
          book.type === "digital" ? "BookMarket Studio" : "NXB Văn học",
        year: 2024 - (index % 4),
        binding:
          book.type === "digital"
            ? "PDF"
            : index % 4 === 3
              ? "Bìa cứng"
              : "Bìa mềm",
        language: "Tiếng Việt",
        location: book.location || (index % 2 ? "Hà Nội" : "TP. Hồ Chí Minh"),
      },
    ];
  }),
);

// Bổ sung metadata/sellerId, giữ nguyên ID và trạng thái đã lưu.
export function upgradeCatalog(saved = initialBooks) {
  const books = saved.map((book) => ({
    ...editions[book.id],
    ...book,
  }));
  const original = {
    ...initialBooks.find((book) => book.id === "b2"),
    ...editions.b2,
  };
  const extraOffers = [
    {
      ...original,
      id: "offer-b2-muathu",
      shop: "Tiệm sách Mùa Thu",
      owner: "seller-muathu",
      price: 74000,
      stock: 6,
      location: "Đà Nẵng",
      description:
        "Sách mới, bìa mềm. Được đóng gói cẩn thận tại tiệm sách Mùa Thu. Đây là một tin bán độc lập cho cùng phiên bản Nhà giả kim.",
    },
    {
      ...original,
      id: "offer-b2-old",
      type: "used",
      shop: "Gác sách An Nhiên",
      owner: "seller-gacsach",
      price: 42000,
      stock: 1,
      condition: "Còn tốt",
      location: "TP. Hồ Chí Minh",
      description:
        "Bản đã đọc, có một vài vết xước nhẹ ở bìa. Ruột sách sạch, đủ trang. Ảnh bìa minh họa; tình trạng và giá thuộc riêng tin đăng của Gác sách An Nhiên.",
    },
  ];
  return [
    ...books,
    ...extraOffers.filter(
      (offer) => !books.some((book) => book.id === offer.id),
    ),
  ].map(identifyListing);
}

// Dùng chung cho mọi nơi cần xác định tin còn bán.
export const isAvailable = (book) =>
  Boolean(book) &&
  ["new", "used", "digital"].includes(book.type) &&
  !book.pending &&
  !book.rejected &&
  !book.hidden &&
  !book.sold &&
  (!book.status || book.status === "approved") &&
  (book.type !== "new" || book.stock > 0) &&
  (book.type !== "used" || book.stock === undefined || book.stock > 0);
export const bookCondition = (book) =>
  ({ new: "Sách mới", used: "Sách cũ", digital: "Ebook" })[book.type] ||
  "Sách cũ";
export const sellerUrl = (sellerId) =>
  `/nha-ban/${encodeURIComponent(sellerId)}`;
export const cleanIsbn = (value) =>
  (value || "").replace(/[\s-]/g, "").toLowerCase();
export const matchesIsbn = (isbn, query) => {
  const prefix = cleanIsbn(query);
  return /^\d{3,13}[x]?$/.test(prefix) && cleanIsbn(isbn).startsWith(prefix);
};
export const relatedOffers = (books, book) =>
  ["new", "used"].includes(book.type)
    ? books.filter(
        (other) =>
          other.id !== book.id &&
          ["new", "used"].includes(other.type) &&
          isAvailable(other) &&
          (book.editionId
            ? other.editionId === book.editionId
            : book.isbn && cleanIsbn(other.isbn) === cleanIsbn(book.isbn)),
      )
    : [];

// Cache vẫn giữ từng tin; chỉ gộp khi tạo danh sách thẻ sách công khai.
export function groupBookCards(books) {
  const groups = new Map();
  for (const book of books) {
    const physical = ["new", "used"].includes(book.type);
    const key = physical
      ? `paper:${book.editionId || cleanIsbn(book.isbn) || book.id}`
      : book.id;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        book,
        ids: new Set([book.id]),
        count: book.offerCount || 1,
      });
      continue;
    }
    group.ids.add(book.id);
    group.count = Math.max(group.count, book.offerCount || 1, group.ids.size);
    if (book.price < group.book.price) group.book = book;
  }
  return [...groups.values()].map((group) => ({
    ...group.book,
    offerCount: group.count,
  }));
}
export function matchesBook(book, params) {
  const includes = (value, query) =>
    normalize(value || "").includes(normalize(query || ""));
  const query = params.get("q") || "";
  const searchable = `${book.title} ${book.author} ${book.shop} ${book.publisher || ""}`;
  const isbnQuery = /^[\d\s-]+[xX]?$/.test(query.trim());
  return (
    (!query ||
      (isbnQuery
        ? matchesIsbn(book.isbn, query)
        : includes(searchable, query))) &&
    includes(book.title, params.get("title")) &&
    includes(book.author, params.get("author")) &&
    (!params.get("isbn") || matchesIsbn(book.isbn, params.get("isbn"))) &&
    includes(book.publisher, params.get("publisher")) &&
    (!params.get("seller") || book.sellerId === params.get("seller")) &&
    (!params.get("category") ||
      params.get("category") === "Tất cả" ||
      book.category === params.get("category")) &&
    (!params.get("condition") ||
      bookCondition(book) === params.get("condition")) &&
    (!params.get("binding") || book.binding === params.get("binding")) &&
    (!params.get("min") ||
      (Number.isFinite(book.price) &&
        book.price >= Number(params.get("min")))) &&
    (!params.get("max") ||
      (Number.isFinite(book.price) && book.price <= Number(params.get("max"))))
  );
}

// Một phí giao cho mỗi seller có sách giấy hợp lệ, bỏ item ngừng bán khỏi phí.
export function groupCart(items, services = [], selectedServices = {}) {
  const groups = new Map();
  items.forEach((item) => {
    const id = item.book.sellerId;
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: item.book.shop,
        items: [],
        shipping: 0,
        hasPhysical: false,
      });
    }
    const group = groups.get(id);
    group.items.push(item);
    if (
      item.available !== false &&
      isAvailable(item.book) &&
      ["new", "used"].includes(item.book.type)
    ) {
      group.hasPhysical = true;
      const service = services.find(
        (service) => service.id === (selectedServices[id] || "standard"),
      );
      group.shipping = service?.fee || 0;
    }
  });
  return [...groups.values()];
}
