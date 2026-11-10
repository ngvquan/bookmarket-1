import { Link, NavLink } from "react-router-dom";
import {
  BookOpen,
  Store,
  Package,
  LibraryBig,
  ArrowLeft,
  ArrowUpRight,
  LogOut,
  ShieldCheck,
  UserRound,
  Check,
  ArrowRight,
  MessageCircle,
  Star,
  Bell,
} from "lucide-react";
import { sellerSections } from "../data/sellerNavigation.js";
import { sellerUrl } from "../utils/marketplace.js";

const icons = {
  products: LibraryBig,
  orders: Package,
  shop: Store,
  chat: MessageCircle,
  reviews: Star,
};
export default function SellerLayout({
  profile,
  shop,
  unread = 0,
  notificationUnread = 0,
  onLogin,
  onRegister,
  onLogout,
  children,
}) {
  const user = profile && profile.role !== "admin";
  return (
    <div className="seller-app">
      <header className="seller-header">
        <div className="seller-header-brand">
          <Link
            className="logo"
            to="/nguoi-ban"
            aria-label="BookMarket kênh người bán"
          >
            <span className="brand-symbol">
              <BookOpen size={24} />
            </span>
            <span>
              book<span>market</span>
            </span>
          </Link>
          <span className="seller-header-divider" />
          <span className="seller-channel-label">Kênh người bán</span>
        </div>
        <div className="seller-header-actions">
          {user && (
            <Link
              className="seller-notification-link"
              to="/thong-bao"
              aria-label={
                notificationUnread
                  ? `${notificationUnread} thông báo chưa đọc`
                  : "Thông báo đơn hàng"
              }
            >
              <Bell size={18} />
              {notificationUnread > 0 && (
                <b className="chat-badge">
                  {notificationUnread > 99 ? "99+" : notificationUnread}
                </b>
              )}
            </Link>
          )}
          {user && (
            <Link
              className="seller-public-link"
              aria-label="Xem trang người bán"
              to={sellerUrl(profile.id)}
            >
              <Store size={16} />
              <span>Xem trang người bán</span>
              <ArrowUpRight size={13} />
            </Link>
          )}
          <Link
            className="seller-back-to-market"
            to="/"
            aria-label="Về trang mua sách"
          >
            <ArrowLeft size={16} />
            <span>Về trang mua sách</span>
          </Link>
          {profile ? (
            <button
              className="seller-logout"
              onClick={onLogout}
              aria-label="Đăng xuất"
            >
              <LogOut size={17} />
              <span>Đăng xuất</span>
            </button>
          ) : (
            <button
              className="button button-dark button-small seller-header-login"
              onClick={onLogin}
            >
              Đăng nhập
            </button>
          )}
        </div>
      </header>
      {!profile ? (
        <main id="main" className="seller-welcome">
          <div className="seller-welcome-copy">
            <span className="seller-welcome-label">
              <Store size={15} />
              DÀNH CHO NGƯỜI BÁN SÁCH
            </span>
            <h1>
              Quản lý việc bán sách
              <br />
              trong một không gian riêng.
            </h1>
            <p>
              Từ những cuốn sách đã đọc đến một gian hàng của riêng bạn. Theo
              dõi sản phẩm, đơn bán và doanh thu tại một nơi.
            </p>
            <div className="seller-welcome-actions">
              <button className="button button-dark" onClick={onLogin}>
                Đăng nhập kênh người bán
                <ArrowRight size={16} />
              </button>
              <button className="button button-outline" onClick={onRegister}>
                Đăng ký rạp sách
              </button>
            </div>
            <span className="seller-shared-account">
              <UserRound size={15} />
              Đã có tài khoản BookMarket? Bạn có thể dùng ngay để mua và bán
              sách.
            </span>
          </div>
          <div className="seller-welcome-panel">
            <div className="seller-welcome-panel-title">
              <span>
                <Store size={23} />
              </span>
              <div>
                <strong>Kênh người bán BookMarket</strong>
                <small>Các công cụ dành cho gian hàng của bạn</small>
              </div>
            </div>
            {[
              [
                LibraryBig,
                "Sản phẩm & kho sách",
                "Đăng bán, cập nhật giá và số lượng sách.",
              ],
              [
                Package,
                "Đơn bán hàng",
                "Xử lý đơn và theo dõi trạng thái giao hàng.",
              ],
              [
                ShieldCheck,
                "Dữ liệu riêng của bạn",
                "Chỉ bạn quản lý được gian hàng và đơn bán của mình.",
              ],
            ].map(([Icon, title, description]) => (
              <div className="seller-welcome-feature" key={title}>
                <Icon size={21} />
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
                <Check size={15} />
              </div>
            ))}
          </div>
        </main>
      ) : !user ? (
        <main id="main" className="seller-access-denied">
          <ShieldCheck size={40} />
          <h1>Đây là kênh dành cho người bán</h1>
          <p>
            Bạn đang đăng nhập bằng tài khoản quản trị. Hãy dùng tài khoản người
            dùng để mua và bán sách.
          </p>
          <Link className="button button-dark" to="/quan-tri">
            Về trang quản trị
            <ArrowRight size={16} />
          </Link>
        </main>
      ) : (
        <div className="seller-workspace">
          <aside className="seller-sidebar">
            <div className="seller-profile">
              <span className="seller-profile-avatar">
                {(shop?.name || profile.name)
                  .split(" ")
                  .filter(Boolean)
                  .slice(-2)
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div>
                <strong>{shop?.name || profile.name}</strong>
                <span>{shop ? "Gian hàng của bạn" : "Người bán cá nhân"}</span>
              </div>
            </div>
            <span className="seller-nav-heading">QUẢN LÝ BÁN HÀNG</span>
            <nav aria-label="Điều hướng người bán">
              {sellerSections.map((section) => {
                const Icon = icons[section.id];
                const registration = section.id === "shop" && !shop;
                return (
                  <NavLink
                    key={section.id}
                    to={registration ? "/dang-ky-rap-sach" : section.path}
                    end={section.id === "products"}
                  >
                    <Icon size={19} />
                    <span>
                      {registration ? "Đăng ký rạp sách" : section.label}
                    </span>
                    {section.id === "chat" && unread > 0 && (
                      <b
                        className="chat-badge"
                        aria-label={`${unread} tin chưa đọc`}
                      >
                        {unread > 99 ? "99+" : unread}
                      </b>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <div className="seller-sidebar-bottom">
              <span className="seller-account-email">{profile.email}</span>
              <Link to="/">
                <ArrowLeft size={16} />
                Chuyển sang mua sách
              </Link>
              <small>
                Giỏ hàng và tài khoản được giữ khi bạn chuyển khu vực.
              </small>
            </div>
          </aside>
          <main id="main" className="seller-workspace-content">
            {children}
            <footer className="seller-workspace-footer">
              <span>© 2026 BookMarket</span>
              <span>Kênh quản lý dành cho người bán</span>
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}
