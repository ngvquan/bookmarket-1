// Hiện giỏ theo sellerId; giữ item hết hiệu lực để người dùng có thể xóa.
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, Store } from "lucide-react";
import { Cover } from "./index.js";
import { money } from "../utils/format.js";
import { sellerUrl } from "../utils/marketplace.js";
export default function CartGroups({
  groups,
  updateQuantity,
  onRemove,
  onClose,
}) {
  return (
    <div className="cart-items">
      {groups.map((group) => (
        <section className="cart-seller-group" key={group.id}>
          <div className="cart-seller-heading">
            <Store size={14} />
            <Link to={sellerUrl(group.id)} onClick={onClose}>
              {group.name}
            </Link>
            <span>
              {group.shipping
                ? `Giao: ${money(group.shipping)}`
                : group.items.every((item) => item.book.type === "digital")
                  ? "Ebook · Không phí giao"
                  : "Phí theo sách giấy còn bán"}
            </span>
          </div>
          {group.items.map((item) => (
            <div className="cart-item" key={item.id}>
              <Cover book={item.book} />
              <div className="cart-item-copy">
                <strong>{item.book.title}</strong>
                {!item.available && (
                  <span className="status status-red">Không còn bán</span>
                )}
                <small>
                  {item.book.type === "digital"
                    ? "Ebook PDF"
                    : item.book.type === "used"
                      ? "Sách cũ"
                      : "Sách mới"}
                </small>
                <span>{money(item.book.price)}</span>
                <div className="quantity-controls">
                  <button
                    aria-label={`Giảm số lượng ${item.book.title}`}
                    disabled={!item.available || item.quantity <= 1}
                    onClick={() => updateQuantity(item.id, -1)}
                  >
                    <Minus size={12} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    aria-label={`Tăng số lượng ${item.book.title}`}
                    disabled={
                      !item.available ||
                      item.book.type !== "new" ||
                      item.quantity >= item.book.stock
                    }
                    onClick={() => updateQuantity(item.id, 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <button
                className="icon-button"
                aria-label={`Xóa ${item.book.title}`}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
