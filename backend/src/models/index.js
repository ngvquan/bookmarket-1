// Các model đang dùng để khởi tạo index và dọn đúng dữ liệu trong database test.
import User from "./User.js";
import Admin from "./Admin.js";
import Shop from "./Shop.js";
import Author from "./Author.js";
import Publisher from "./Publisher.js";
import Category from "./Category.js";
import Book from "./Book.js";
import Edition from "./Edition.js";
import Listing from "./Listing.js";
import Order from "./Order.js";
import SubOrder from "./SubOrder.js";
import Conversation from "./Conversation.js";
import Message from "./Message.js";
import Review from "./Review.js";
import DigitalOrder from "./DigitalOrder.js";
import EbookAccess from "./EbookAccess.js";
import BankTransaction from "./BankTransaction.js";
import Notification from "./Notification.js";
export { DigitalOrder, EbookAccess, BankTransaction, Notification };
export {
  User,
  Admin,
  Shop,
  Author,
  Publisher,
  Category,
  Book,
  Edition,
  Listing,
  Order,
  SubOrder,
  Conversation,
  Message,
  Review,
};
export const allModels = [
  User,
  Admin,
  Shop,
  Author,
  Publisher,
  Category,
  Book,
  Edition,
  Listing,
  Order,
  SubOrder,
  Conversation,
  Message,
  Review,
  DigitalOrder,
  EbookAccess,
  BankTransaction,
  Notification,
];
