// Trang quản trị chỉ hiển thị các nghiệp vụ backend hiện đang hỗ trợ.
import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  PackageCheck,
  Truck,
  WalletCards,
  LogOut,
} from "lucide-react";
import AdminDigitalOrders from "../components/AdminDigitalOrders.jsx";
import AdminOrders from "../components/AdminOrders.jsx";
import PageTitle from "../components/PageTitle.jsx";
import Pagination from "../components/Pagination.jsx";
import { Cover, Empty, Status } from "../components/index.js";
import { types } from "../data/catalog.js";
import { apiMessage } from "../services/api.js";

const sections = [
  { id: "listings", label: "Tin đăng", icon: BookOpen },
  { id: "orders", label: "Đơn hàng", icon: PackageCheck },
  { id: "shipping", label: "Vận chuyển", icon: Truck },
  { id: "digital", label: "Đơn ebook", icon: WalletCards },
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
  orders: "Theo dõi các đơn COD được tạo từ nhiều người bán.",
  shipping: "Cập nhật kết quả giao hàng trong luồng vận chuyển mô phỏng.",
  digital: "Đối soát chuyển khoản VietQR và xác nhận đơn ebook.",
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
  const [listingStatus, setListingStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState("");
  const [loadError, setLoadError] = useState("");

  async function loadListings(page = 1, status = listingStatus) {
    setBusy(true);
    setLoadError("");
    try {
      await onPage(page, status);
    } catch (error) {
      setLoadError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (section === "listings") loadListings(1, listingStatus);
  }, [section, listingStatus]);

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
      <div className="admin-page-topbar">
        <PageTitle
          eyebrow="KHU VỰC QUẢN TRỊ"
          title="Quản trị BookMarket"
          description="Quản lý tin đăng, đơn hàng, vận chuyển và thanh toán ebook từ một nơi."
        />
        <button
          type="button"
          className="button button-outline admin-logout-button"
          onClick={onLogout}
        >
          <LogOut size={17} aria-hidden="true" />
          Đăng xuất
        </button>
      </div>
      <nav className="admin-section-nav" aria-label="Chức năng quản trị">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={section === id ? "active" : ""}
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="admin-section-heading">
        <div>
          <h2>{sections.find((item) => item.id === section)?.label}</h2>
          <p>{sectionDescriptions[section]}</p>
        </div>
        {section === "listings" && (
          <div className="admin-page-summary" aria-live="polite">
            <FileText size={18} aria-hidden="true" />
            <span>
              <strong>{pageData.total || 0}</strong> tin theo bộ lọc
            </span>
          </div>
        )}
      </div>
      {section === "listings" && (
        <ListingsPanel
          books={books}
          pageData={pageData}
          status={listingStatus}
          setStatus={setListingStatus}
          busy={busy}
          actionId={actionId}
          error={loadError}
          onPage={(page) => loadListings(page, listingStatus)}
          onModerate={moderate}
        />
      )}
      {section === "orders" && <AdminOrders services={services} />}
      {section === "shipping" && <AdminOrders shipping services={services} />}
      {section === "digital" && <AdminDigitalOrders />}
    </div>
  );
}

function ListingsPanel({
  books,
  pageData,
  status,
  setStatus,
  busy,
  actionId,
  error,
  onPage,
  onModerate,
}) {
  return (
    <section aria-label="Quản lý tin đăng">
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
          description="Không có tin nào khớp với trạng thái đang chọn."
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
