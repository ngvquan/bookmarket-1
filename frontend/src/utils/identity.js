// Nâng cấp catalog localStorage cũ; backend dùng ID User thật.
import { initialBooks } from "../data/books.js";
export const DEMO_SELLER_ID = "seller-me";
const seedIds = new Set([
  ...initialBooks.map((book) => book.id),
  "offer-b2-muathu",
  "offer-b2-old",
]);
export function legacySellerId(name) {
  // Băm tên cũ thành ID ổn định một lần; phép băm này không dùng để bảo mật.
  let hash = 2166136261;
  for (const char of String(name || "unknown"))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `seller-${(hash >>> 0).toString(16)}`;
}
export function identifyListing(book) {
  // Giữ ID đã có để đổi tên shop không làm đổi người bán.
  let sellerId = book.sellerId;
  if (!sellerId) {
    if (book.owner === "me") {
      sellerId = DEMO_SELLER_ID;
    } else if (seedIds.has(book.id)) {
      sellerId = legacySellerId(book.shop);
    } else {
      sellerId = book.owner || legacySellerId(book.shop);
    }
  }
  return {
    ...book,
    sellerId,
    owner: sellerId,
  };
}
