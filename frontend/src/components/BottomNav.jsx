import { NavLink } from "react-router-dom";
import {
  Home,
  LayoutGrid,
  MessageCircle,
  ShoppingCart,
  UserRound,
} from "lucide-react";

const badgeText = (count) => (count > 99 ? "99+" : count);

export default function BottomNav({
  cartCount = 0,
  unread = 0,
  profile,
  onCart,
}) {
  const accountPath = profile?.role === "admin" ? "/quan-tri" : "/ho-so";

  return (
    <nav className="mobile-bottom-nav" aria-label="Điều hướng ứng dụng">
      <NavLink to="/" end>
        <Home aria-hidden="true" />
        <span>Trang chủ</span>
      </NavLink>
      <NavLink to="/mua-sach">
        <LayoutGrid aria-hidden="true" />
        <span>Danh mục</span>
      </NavLink>
      <button
        type="button"
        className="mobile-bottom-nav-cart"
        onClick={onCart}
        aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}
      >
        <span className="mobile-nav-icon-wrap">
          <ShoppingCart aria-hidden="true" />
          {cartCount > 0 && (
            <span className="mobile-nav-badge">{badgeText(cartCount)}</span>
          )}
        </span>
        <span>Giỏ hàng</span>
      </button>
      <NavLink to="/tin-nhan">
        <span className="mobile-nav-icon-wrap">
          <MessageCircle aria-hidden="true" />
          {unread > 0 && (
            <span className="mobile-nav-badge">{badgeText(unread)}</span>
          )}
        </span>
        <span>Tin nhắn</span>
      </NavLink>
      <NavLink to={accountPath}>
        <UserRound aria-hidden="true" />
        <span>Tài khoản</span>
      </NavLink>
    </nav>
  );
}
