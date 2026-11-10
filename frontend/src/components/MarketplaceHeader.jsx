import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Search,
  ShoppingCart,
  Heart,
  UserRound,
  Menu,
  X,
  ChevronDown,
  Store,
  Package,
  LogOut,
  ArrowLeftRight,
  LayoutDashboard,
  MessageCircle,
  Bell,
} from "lucide-react";
import { catalogSections } from "../data/catalog.js";

export default function MarketplaceHeader({
  profile,
  unread = 0,
  notificationUnread = 0,
  cartCount,
  onCart,
  onLogin,
  accountMenu,
  setAccountMenu,
  menu,
  setMenu,
  onLogout,
}) {
  const navigate = useNavigate();
  return (
    <>
      <header className="site-header commerce-header">
        <div className="shell header-inner">
          <Link to="/" className="logo" aria-label="BookMarket trang chủ">
            <span className="brand-symbol">
              <BookOpen size={25} strokeWidth={2} />
            </span>
            <span>
              book<span>market</span>
              <small>MUA BÁN SÁCH</small>
            </span>
          </Link>
          <div className="header-search-area">
            <form
              className="header-search-form"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const query = String(
                  new FormData(event.currentTarget).get("q") || "",
                ).trim();
                navigate(
                  query
                    ? `/tim-kiem?q=${encodeURIComponent(query)}`
                    : "/tim-kiem",
                );
                setMenu(false);
              }}
            >
              <Search size={20} />
              <input
                name="q"
                type="search"
                aria-label="Tìm sách trên BookMarket"
                placeholder="Bạn muốn tìm cuốn sách nào?"
              />
              <button type="submit" aria-label="Tìm kiếm">
                <span className="desktop-search-label">Tìm kiếm</span>
                <span className="mobile-search-label">Tìm</span>
              </button>
            </form>
            <div className="search-suggestions">
              <span>Tìm nhanh:</span>
              {["Nhà giả kim", "Nguyễn Nhật Ánh", "Tâm lý"].map((term) => (
                <Link
                  key={term}
                  to={`/tim-kiem?${term === "Tâm lý" ? "category" : "q"}=${encodeURIComponent(term)}`}
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>
          <div className="header-actions">
            <div className="account-wrap">
              <button
                className="account-button"
                aria-label={
                  profile ? `Tài khoản của ${profile.name}` : "Tài khoản"
                }
                aria-expanded={profile ? accountMenu : undefined}
                onClick={() =>
                  profile ? setAccountMenu(!accountMenu) : onLogin()
                }
              >
                <UserRound size={23} />
                <span>
                  <small>
                    {profile ? "Xin chào," : "Đăng nhập / Đăng ký"}
                    <ChevronDown size={11} />
                  </small>
                  <strong>
                    {profile ? profile.name.split(" ").at(-1) : "Tài khoản"}
                  </strong>
                </span>
              </button>
              {profile && accountMenu && (
                <div className="account-dropdown">
                  <strong>Xin chào, {profile.name}</strong>
                  {[
                    ...(profile.role !== "admin"
                      ? [
                          ["/ho-so", UserRound, "Hồ sơ cá nhân"],
                          ["/thong-bao", Bell, "Thông báo đơn hàng"],
                        ]
                      : []),
                    ["/don-hang", Package, "Đơn hàng của tôi"],
                    ["/thu-vien", BookOpen, "Thư viện của tôi"],
                    ["/yeu-thich", Heart, "Sách yêu thích"],
                    ...(profile.role !== "admin"
                      ? [["/tin-nhan", MessageCircle, "Tin nhắn"]]
                      : []),
                    ...(profile.role === "admin"
                      ? [["/quan-tri", LayoutDashboard, "Quản trị"]]
                      : []),
                  ].map(([to, Icon, label]) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setAccountMenu(false)}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  ))}
                  {profile.role !== "admin" && (
                    <Link
                      className="account-switch-seller"
                      to={profile.shop ? "/nguoi-ban" : "/dang-ky-rap-sach"}
                      onClick={() => setAccountMenu(false)}
                    >
                      <Store size={16} />
                      {profile.shop ? "Quản lý rạp sách" : "Đăng ký rạp sách"}
                    </Link>
                  )}
                  <button onClick={onLogout}>
                    <LogOut size={16} />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
            {profile?.role !== "admin" && (
              <Link
                className="icon-button header-chat"
                to="/tin-nhan"
                aria-label={
                  unread ? `Tin nhắn, ${unread} chưa đọc` : "Tin nhắn"
                }
              >
                <MessageCircle size={22} />
                {unread > 0 && (
                  <span className="chat-badge">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            )}
            {profile?.role !== "admin" && (
              <Link
                className="icon-button header-notifications"
                to="/thong-bao"
                aria-label={
                  notificationUnread
                    ? `Thông báo, ${notificationUnread} chưa đọc`
                    : "Thông báo"
                }
              >
                <Bell size={22} />
                {notificationUnread > 0 && (
                  <span className="chat-badge">
                    {notificationUnread > 99 ? "99+" : notificationUnread}
                  </span>
                )}
              </Link>
            )}
            <Link
              className="icon-button header-heart"
              to="/yeu-thich"
              aria-label="Sách yêu thích"
            >
              <Heart size={22} />
            </Link>
            <button
              className="icon-button cart-toggle"
              onClick={onCart}
              aria-label={`Giỏ hàng ${cartCount} sản phẩm`}
            >
              <ShoppingCart size={24} />
              <span>{cartCount}</span>
            </button>
            <button
              className="icon-button mobile-menu-button"
              aria-expanded={menu}
              aria-controls="primary-navigation"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? "Đóng menu" : "Mở menu"}
            >
              {menu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        <div className="commerce-nav">
          <nav
            id="primary-navigation"
            className={`shell main-nav ${menu ? "mobile-open" : ""}`}
            aria-label="Điều hướng chính"
          >
            <NavLink
              className="nav-catalog"
              to="/tim-kiem"
              onClick={() => setMenu(false)}
            >
              <Menu size={18} />
              Danh mục sách
              <ChevronDown size={13} />
            </NavLink>
            <NavLink to="/" end onClick={() => setMenu(false)}>
              Trang chủ
            </NavLink>
            {Object.entries(catalogSections).map(([key, item]) => (
              <NavLink key={key} to={item.path} onClick={() => setMenu(false)}>
                {item.label}
              </NavLink>
            ))}
            <Link
              className="nav-sell"
              to="/nguoi-ban"
              onClick={() => setMenu(false)}
            >
              Bán sách cùng BookMarket
              <ArrowLeftRight size={14} />
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
