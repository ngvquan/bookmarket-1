// Trang quản trị chỉ hiển thị các nghiệp vụ backend hiện đang hỗ trợ.
import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  PackageCheck,
  Search,
  Truck,
  UsersRound,
  WalletCards,
  LogOut,
} from "lucide-react";
import AdminDigitalOrders from "../components/AdminDigitalOrders.jsx";
import AdminOrders from "../components/AdminOrders.jsx";
import AdminAccounts from "../components/AdminAccounts.jsx";
import Pagination from "../components/Pagination.jsx";
import { Cover, Empty, Status } from "../components/index.js";
import { types } from "../data/catalog.js";
import { apiMessage } from "../services/api.js";

const sections = [
  { id: "listings", label: "Tin đăng", hint: "Sách trên sàn", group: "Nội dung", icon: BookOpen },
  { id: "orders", label: "Đơn hàng", hint: "Sách giấy, ebook và giao hàng", group: "Giao dịch", icon: PackageCheck },
  { id: "accounts", label: "Tài khoản", hint: "Người dùng và gian hàng", group: "Người dùng", icon: UsersRound },
];
const listingFilters = [
  ["", "Tất cả"],
  ["approved", "Đang hiển thị"],
  ["hidden", "Đã ẩn"],
];
const statusLabels = {
  pending: "Chưa công khai",
  approved: "Đang hiển thị",
  rejected: "Đã từ chối",
  hidden: "Đã ẩn",
  sold: "Đã bán",
};
const sectionDescriptions = {
  listings: "Kiểm tra và điều chỉnh khả năng hiển thị của sách trên sàn.",
  orders: "Theo dõi đơn sách giấy, đơn ebook và quá trình giao hàng.",
  accounts: "Tra cứu người dùng và gian hàng của họ.",
};

export default function Admin({
  books,
  services,
  onModerate,
  pageData,
  onPage,
  onLogout,
}) {
  const [section, setSection] = useState("listings");
  const [orderView, setOrderView] = useState("paper");
  const [listingStatus, setListingStatus] = useState("");
  const [listingSearchDraft, setListingSearchDraft] = useState("");
  const [listingSearch, setListingSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState("");
  const [loadError, setLoadError] = useState("");

  async function loadListings(page = 1, status = listingStatus, search = listingSearch) {
    setBusy(true);
    setLoadError("");
    try {
      await onPage(page, status, search);
    } catch (error) {
      setLoadError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (section === "listings") loadListings(1, listingStatus, listingSearch);
  }, [section, listingStatus, listingSearch]);

  function submitListingSearch(event) {
    event.preventDefault();
    const value = listingSearchDraft.trim();
    if (value === listingSearch) loadListings(1, listingStatus, value);
    else setListingSearch(value);
  }

  async function moderate(id, status) {
    if (actionId) return;
    setActionId(id);
    try {
      await onModerate(id, status);
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="shell page-content admin-page">
      <header className="admin-page-topbar">
        <div className="admin-page-identity">
          <span className="admin-page-mark"><LayoutDashboard size={23} aria-hidden="true" /></span>
          <div>
            <span className="admin-eyebrow">BOOKMARKET / QUẢN TRỊ</span>
            <h1>Trung tâm quản trị</h1>
            <p>Theo dõi sách, đơn hàng và thanh toán tại một nơi.</p>
          </div>
        </div>
        <button
          type="button"
          className="button button-outline admin-logout-button"
          onClick={onLogout}
        >
          <LogOut size={17} aria-hidden="true" />
          Đăng xuất
        </button>
      </header>
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <span className="admin-sidebar-title">DANH MỤC QUẢN LÝ</span>
          <nav className="admin-section-nav" aria-label="Chức năng quản trị">
            {["Nội dung", "Giao dịch", "Người dùng"].map((group) => (
              <div className="admin-nav-group" key={group}>
                <span className="admin-nav-group-title">{group}</span>
                {sections.filter((item) => item.group === group).map(({ id, label, hint, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={section === id ? "active" : ""}
                    aria-current={section === id ? "page" : undefined}
                    onClick={() => setSection(id)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span><strong>{label}</strong><small>{hint}</small></span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <main className="admin-main">
          <div className="admin-section-heading">
            <div>
              <span className="admin-section-kicker">{sections.find((item) => item.id === section)?.group}</span>
              <h2>{sections.find((item) => item.id === section)?.label}</h2>
              <p>{sectionDescriptions[section]}</p>
            </div>
            {section === "listings" && (
              <div className="admin-page-summary" aria-live="polite">
                <FileText size={18} aria-hidden="true" />
                <span><strong>{pageData.total || 0}</strong><small>Tin theo bộ lọc</small></span>
              </div>
            )}
          </div>
          <div className="admin-content-card">
            {section === "listings" && (
              <ListingsPanel
                books={books}
                pageData={pageData}
                status={listingStatus}
                setStatus={setListingStatus}
                search={listingSearch}
                searchDraft={listingSearchDraft}
                setSearchDraft={setListingSearchDraft}
                onSearch={submitListingSearch}
                onClearSearch={() => {
                  setListingSearchDraft("");
                  if (listingSearch) setListingSearch("");
                }}
                busy={busy}
                actionId={actionId}
                error={loadError}
                onPage={(page) => loadListings(page, listingStatus, listingSearch)}
                onModerate={moderate}
              />
            )}
            {section === "orders" && (
              <>
                <div className="admin-order-tabs" role="tablist" aria-label="Loại đơn hàng">
                  {[
                    ["paper", "Sách giấy", BookOpen],
                    ["digital", "Ebook", WalletCards],
                    ["shipping", "Vận chuyển", Truck],
                  ].map(([value, label, Icon]) => (
                    <button type="button" key={value} role="tab"
                      aria-selected={orderView === value}
                      className={orderView === value ? "active" : ""}
                      onClick={() => setOrderView(value)}>
                      <Icon size={17} aria-hidden="true" />{label}
                    </button>
                  ))}
                </div>
                {orderView === "paper" && <AdminOrders services={services} />}
                {orderView === "digital" && <AdminDigitalOrders />}
                {orderView === "shipping" && <AdminOrders shipping services={services} />}
              </>
            )}
            {section === "accounts" && <AdminAccounts />}
          </div>
        </main>
      </div>
    </div>
  );
}

function ListingsPanel({
  books,
  pageData,
  status,
  setStatus,
  search,
  searchDraft,
  setSearchDraft,
  onSearch,
  onClearSearch,
  busy,
  actionId,
  error,
  onPage,
  onModerate,
}) {
  return (
    <section aria-label="Quản lý tin đăng">
      <form className="admin-search-form" onSubmit={onSearch}>
        <label htmlFor="admin-listing-search">Tìm tin đăng</label>
        <div className="admin-search-controls">
          <div className="admin-search-input">
            <Search size={17} aria-hidden="true" />
            <input id="admin-listing-search" type="search" maxLength={200}
              placeholder="Tên sách, tác giả, ISBN hoặc người bán"
              value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
          </div>
          <button type="submit" className="button button-dark" disabled={busy}>Tìm kiếm</button>
          {search && <button type="button" className="button button-outline" onClick={onClearSearch}>Xóa lọc</button>}
        </div>
      </form>
      <div className="admin-filter-bar">
        <span>Trạng thái</span>
        <div className="admin-filter-options">
          {listingFilters.map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              className={status === value ? "active" : ""}
              onClick={() => setStatus(value)}
              disabled={busy}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="admin-loading">
          Đang tải tin đăng…
        </p>
      )}
      {!busy && books.length > 0 && (
        <div className="management-list admin-listings">
          {books.map((book) => (
            <article className="management-row" key={book.id}>
              <Cover book={book} />
              <div className="admin-listing-info">
                <strong>{book.title}</strong>
                <small>
                  {types[book.type]?.label || book.type} · {book.shop}
                </small>
                {book.status === "hidden" && (
                  <small>
                    {book.hiddenBy === "seller"
                      ? "Người bán tự ẩn"
                      : "Quản trị viên đã ẩn"}
                  </small>
                )}
              </div>
              <Status
                tone={
                  book.status === "rejected" || book.status === "hidden"
                    ? "red"
                    : book.status === "pending"
                      ? "amber"
                      : "green"
                }
              >
                {statusLabels[book.status] || "Chưa công khai"}
              </Status>
              <ListingActions
                book={book}
                busy={actionId === book.id}
                onModerate={onModerate}
              />
            </article>
          ))}
        </div>
      )}
      {!busy && !error && books.length === 0 && (
        <Empty
          icon={CheckCircle2}
          title="Không có tin đăng"
          description={search ? "Không có tin nào khớp với từ khóa và trạng thái đang chọn." : "Không có tin nào khớp với trạng thái đang chọn."}
          action={null}
        />
      )}
      <Pagination data={pageData} onPage={onPage} busy={busy} />
    </section>
  );
}

function ListingActions({ book, busy, onModerate }) {
  if (book.status === "sold")
    return <span className="admin-no-action">Không thể thay đổi</span>;
  if (book.status === "approved")
    return (
      <button
        type="button"
        className="button button-outline button-small"
        disabled={busy}
        onClick={() => onModerate(book.id, "hidden")}
      >
        {busy ? "Đang lưu…" : "Ẩn tin"}
      </button>
    );
  return (
    <button
      type="button"
      className="button button-dark button-small"
      disabled={busy}
      onClick={() => onModerate(book.id, "approved")}
    >
      {busy ? "Đang lưu…" : "Hiện tin"}
      {!busy && <Check size={14} aria-hidden="true" />}
    </button>
  );
}
