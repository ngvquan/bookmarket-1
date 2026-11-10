// Gian sách công khai theo sellerId, có bộ lọc và phân trang.
import { useState, useEffect } from "react";

import { Link, useParams } from "react-router-dom";

import {
  Store,
  MapPin,
  Search,
  BookOpen,
  Package,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";

import { BookCard, Empty } from "../components/index.js";

import { isAvailable } from "../utils/marketplace.js";

import { listingService, apiMessage } from "../services/api.js";

import Pagination from "../components/Pagination.jsx";

export function SellerStorefront({
  books,
  cardProps,
  library,
  onResults,
  profile,
  onChat,
  chatStarting,
}) {
  const { sellerId } = useParams();
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({
    items: [],
    page: 1,
    pages: 0,
    total: 0,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    listingService
      .search({
        seller: sellerId,
        type,
        group: "edition",
        page,
        limit: 10,
      })
      .then((data) => {
        if (active) {
          setResult(data);
          onResults(data.items);
        }
      })
      .catch((error) => {
        if (active) {
          setError(apiMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [sellerId, type, page]);
  const available = result.items.filter((book) => {
    const cached = books.find((item) => item.id === book.id);
    return !cached || isAvailable(cached);
  });
  const name =
    result.items[0]?.shop ||
    books.find((book) => book.sellerId === sellerId)?.shop ||
    "Gian sách";
  const shown = available;
  if (busy || error) {
    return (
      <div className="shell page-content">
        <p role={error ? "alert" : "status"}>
          {error || "Đang tải gian sách…"}
        </p>
      </div>
    );
  }
  if (!available.length && type === "all") {
    return (
      <div className="shell page-content">
        <Empty
          icon={Store}
          title={name || "Gian sách"}
          description="Gian sách hiện chưa có tin đăng đang bán."
          to="/nha-ban"
          action="Khám phá nhà bán khác"
        />
      </div>
    );
  }
  return (
    <div className="shell page-content public-store">
      <div className="breadcrumbs">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/nha-ban">Nhà bán sách</Link>
        <span>/</span>
        {name}
      </div>
      <section className="store-hero">
        <span className="seller-monogram">
          <Store size={36} strokeWidth={1.3} />
        </span>
        <div>
          <span className="eyebrow">GIAN SÁCH ĐỘC LẬP</span>
          <h1>{name}</h1>
          <p>
            <MapPin size={14} />
            {available[0]?.location || "Việt Nam"}
            <span>·</span>
            {result.total} đầu sách theo bộ lọc
          </p>
        </div>
        <div className="store-contact-actions">
          {profile?.id !== sellerId && profile?.role !== "admin" && (
            <button
              className="button button-dark"
              disabled={chatStarting}
              onClick={() => onChat({ sellerId })}
            >
              <MessageCircle size={16} />
              Chat với người bán
            </button>
          )}
          <Link
            className="button button-outline"
            to={`/tim-kiem?seller=${encodeURIComponent(sellerId)}`}
          >
            Tìm sách trong gian
            <Search size={15} />
          </Link>
        </div>
      </section>
      <div className="store-assurances">
        <span>
          <BookOpen size={18} />
          Sách được mô tả theo từng bản
        </span>
        <span>
          <Package size={18} />
          Giao trực tiếp từ người bán
        </span>
        <span>
          <ShieldCheck size={18} />
          Phí giao hiển thị khi đặt hàng
        </span>
      </div>
      <div className="recommendation-tabs">
        {[
          ["all", "Tất cả sách"],
          ["physical", "Mua sách"],
          ["digital", "Ebook"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={type === key ? "active" : ""}
            onClick={() => {
              setType(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="book-grid storefront-grid">
          {shown.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              {...cardProps}
              owned={library.includes(book.id)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="Chưa có sách trong mục này"
          description="Chọn một mục khác để xem sách của người bán."
          action={null}
        />
      )}
      <Pagination data={result} onPage={setPage} busy={busy} />
    </div>
  );
}
