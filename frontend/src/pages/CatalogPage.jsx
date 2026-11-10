// Đọc bộ lọc từ URL và lấy đúng một trang kết quả từ API.
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  X,
  Plus,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react";
import { categories } from "../data/catalog.js";
import useCatalogSearch from "../hooks/useCatalogSearch.js";
import CatalogResults from "../components/CatalogResults.jsx";
export default function Catalog({
  type,
  info,
  books,
  sessionBooks = books,
  cardProps,
  library,
  onPost,
  onResults,
}) {
  const [view, setView] = useState("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const {
    params,
    setParams,
    update,
    result,
    busy,
    loadError,
    filtered,
    activeFilters,
    sort,
  } = useCatalogSearch({ type, sessionBooks, onResults });
  return (
    <div className="catalog-page edition-catalog">
      <div className="shell">
        <div className="breadcrumbs">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          {info.label}
        </div>
        <div className="page-title">
          <div>
            <span className="eyebrow">SÁCH TỪ NHỮNG NHÀ BÁN ĐỘC LẬP</span>
            <h1>
              {type === "all" && activeFilters.length
                ? "Kết quả tìm kiếm sách"
                : info.title}
            </h1>
            <p>{info.description}</p>
          </div>
          {type === "physical" && (
            <Link className="button button-dark" to="/nguoi-ban/san-pham">
              Đăng bán sách
              <Plus size={16} />
            </Link>
          )}
          {type === "digital" && (
            <Link className="button button-outline" to="/thu-vien">
              Thư viện của tôi
              <BookOpen size={16} />
            </Link>
          )}
        </div>
        {["physical", "all"].includes(type) && (
          <div
            className="recommendation-tabs purchase-type-tabs"
            role="group"
            aria-label="Lọc sách mới hoặc cũ"
          >
            {[
              ["", "Tất cả sách"],
              ["new", "Sách mới"],
              ["used", "Sách cũ"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={(params.get("type") || "") === value ? "active" : ""}
                aria-pressed={(params.get("type") || "") === value}
                onClick={() => update("type", value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="catalog-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              id="catalog-search"
              aria-label="Tìm kiếm sách"
              value={params.get("q") || ""}
              onChange={(event) => update("q", event.target.value)}
              placeholder="Tên sách, tác giả, ISBN hoặc nhà bán..."
            />
            {params.get("q") && (
              <button
                className="icon-button"
                aria-label="Xóa tìm kiếm"
                onClick={() => update("q", "")}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <Link
            className="text-link"
            to={`/tim-kiem-nang-cao?${params.toString()}`}
          >
            Tìm kiếm nâng cao
          </Link>
        </div>
        <button
          className="mobile-filter-toggle button button-outline"
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={16} />
          {filtersOpen ? "Ẩn bộ lọc" : "Lọc sách"}
          {activeFilters.length > 0 && <span>{activeFilters.length}</span>}
        </button>
        <div className={`catalog-layout ${filtersOpen ? "filters-open" : ""}`}>
          <aside id="catalog-filters" className="catalog-sidebar">
            <h3>Thể loại sách</h3>
            {categories.map((category) => (
              <button
                key={category}
                className={
                  (params.get("category") || "Tất cả") === category
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  update("category", category === "Tất cả" ? "" : category)
                }
              >
                {category}
              </button>
            ))}
          </aside>
          <CatalogResults
            result={result}
            params={params}
            sort={sort}
            update={update}
            view={view}
            setView={setView}
            activeFilters={activeFilters}
            setParams={setParams}
            busy={busy}
            loadError={loadError}
            filtered={filtered}
            cardProps={cardProps}
            library={library}
          />
        </div>
      </div>
    </div>
  );
}
