// Danh sách nhà bán công khai, lấy dữ liệu theo trang từ API.
import { useState, useEffect } from "react";

import { Link } from "react-router-dom";

import { Store, MapPin, ArrowUpRight, Search } from "lucide-react";

import { Empty } from "../components/index.js";

import { sellerUrl } from "../utils/marketplace.js";

import { listingService, apiMessage } from "../services/api.js";

import Pagination from "../components/Pagination.jsx";

export function SellerDirectory() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({
    items: [],
    page: 1,
    pages: 0,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    listingService
      .sellers({
        q: query,
        page,
        limit: 10,
      })
      .then((data) => {
        if (active) {
          setResult(data);
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
  }, [query, page]);
  const sellers = result.items;
  return (
    <div className="shell page-content seller-directory">
      <div className="breadcrumbs">
        <Link to="/">Trang chủ</Link>
        <span>/</span>Nhà bán sách
      </div>
      <div className="page-title">
        <div>
          <span className="eyebrow">GIAN HÀNG TRÊN BOOKMARKET</span>
          <h1>Nhà bán sách</h1>
          <p>Khám phá các nhà sách và người bán độc lập trên BookMarket.</p>
        </div>
      </div>
      <div className="search-field">
        <Search size={18} />
        <input
          aria-label="Tìm nhà bán sách"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Nhập tên nhà sách hoặc người bán..."
        />
      </div>
      <div className="seller-directory-grid">
        {sellers.map((seller) => (
          <Link
            key={seller.id}
            className="seller-profile-card"
            to={sellerUrl(seller.id)}
          >
            <span className="seller-monogram">
              {seller.name
                .split(" ")
                .filter(Boolean)
                .slice(-2)
                .map((word) => word[0])
                .join("")}
            </span>
            <div>
              <h2>{seller.name}</h2>
              <span>
                <MapPin size={12} />
                {seller.location}
              </span>
              <p>{seller.total} tin sách đang có sẵn</p>
              <span className="text-link">
                Ghé gian sách
                <ArrowUpRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      {busy && <p role="status">Đang tải nhà bán…</p>}
      <Pagination data={result} onPage={setPage} busy={busy} />
      {!busy && !error && !sellers.length && (
        <Empty
          icon={Store}
          title="Chưa tìm thấy nhà bán"
          description="Thử một tên khác nhé."
          action={null}
        />
      )}
    </div>
  );
}
