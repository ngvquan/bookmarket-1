// Component này hiển thị kết quả, bộ lọc đang chọn và phân trang catalog.
import { LayoutGrid, List, Search, X } from "lucide-react";
import { BookCard, Empty } from "./index.js";
import Pagination from "./Pagination.jsx";

const filterLabels = {
  q: "Từ khóa",
  author: "Tác giả",
  title: "Tên sách",
  publisher: "NXB",
  max: "Giá tối đa",
  min: "Giá từ",
  isbn: "ISBN",
};

export default function CatalogResults({
  result,
  params,
  sort,
  update,
  view,
  setView,
  activeFilters,
  setParams,
  busy,
  loadError,
  filtered,
  cardProps,
  library,
}) {
  return (
    <div className="catalog-results">
      <div className="results-heading">
        <span>
          <strong>{result.total}</strong> đầu sách{" "}
          {params.get("q") && `cho “${params.get("q")}”`}
        </span>
        <div className="result-controls">
          <select
            aria-label="Sắp xếp sách"
            value={sort}
            onChange={(event) => update("sort", event.target.value)}
          >
            <option value="featured">Đề xuất cho bạn</option>
            <option value="price-up">Giá thấp đến cao</option>
            <option value="price-down">Giá cao đến thấp</option>
            <option value="title">Tên sách A → Z</option>
          </select>
          <div className="view-switch">
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
              aria-label="Hiển thị danh sách"
              aria-pressed={view === "list"}
            >
              <List size={17} />
            </button>
            <button
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
              aria-label="Hiển thị dạng lưới"
              aria-pressed={view === "grid"}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>
      {activeFilters.length > 0 && (
        <div className="active-filters">
          {activeFilters.map(([key, value]) => (
            <button
              key={key}
              onClick={() => update(key, "")}
              aria-label={`Bỏ bộ lọc ${value}`}
            >
              {filterLabels[key] ? `${filterLabels[key]}: ` : ""}
              {key === "type"
                ? { new: "Sách mới", used: "Sách cũ" }[value] || value
                : value}
              <X size={12} />
            </button>
          ))}
          <button className="clear-filters" onClick={() => setParams({})}>
            Xóa bộ lọc
          </button>
        </div>
      )}
      {busy && (
        <p role="status" className="fine-print">
          Đang tìm sách…
        </p>
      )}
      {loadError && (
        <p role="alert" className="info-box">
          {loadError}
        </p>
      )}
      {!busy &&
        !loadError &&
        (filtered.length ? (
          <div
            className={
              view === "list" ? "listing-list" : "book-grid catalog-grid"
            }
          >
            {filtered.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                {...cardProps}
                owned={library.includes(book.id)}
                listing={view === "list"}
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={Search}
            title="Chưa tìm thấy bản sách phù hợp"
            description="Thử bỏ bớt điều kiện hoặc tìm theo tên sách và tác giả."
            action={null}
          />
        ))}
      <Pagination
        data={result}
        busy={busy}
        onPage={(page) => update("page", String(page))}
      />
    </div>
  );
}
