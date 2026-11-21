// Form tìm kiếm tạo URL để chia sẻ tên sách, tác giả và ISBN đang tìm.
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import PriceRange from "./PriceRange.jsx";
export default function SearchPanel({ advanced = false }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <form
      className={`edition-search ${advanced ? "edition-search-advanced" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        const values = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget))
          if (value.trim()) {
            values.set(key, value.trim());
          }
        navigate(`/tim-kiem?${values.toString()}`);
      }}
    >
      <div className="edition-search-fields">
        <label>
          Tác giả
          <input
            name="author"
            defaultValue={params.get("author") || ""}
            placeholder="Ví dụ: Paulo Coelho"
          />
        </label>
        <label>
          Tên sách
          <input
            name="title"
            defaultValue={params.get("title") || ""}
            placeholder="Bạn đang tìm cuốn sách nào?"
          />
        </label>
        <label>
          ISBN hoặc từ khóa
          <input
            name="q"
            defaultValue={params.get("q") || ""}
            placeholder="Nhập ISBN hoặc từ khóa"
          />
        </label>
        {advanced && (
          <>
            <PriceRange
              key={`${params.get("min")}:${params.get("max")}`}
              min={params.get("min")}
              max={params.get("max")}
            />
            <label>
              Nhà xuất bản
              <input
                name="publisher"
                defaultValue={params.get("publisher") || ""}
                placeholder="Tên nhà xuất bản"
              />
            </label>
            <label>
              Tình trạng
              <select name="type" defaultValue={params.get("type") || ""}>
                <option value="">Tất cả tình trạng</option>
                <option value="new">Sách mới</option>
                <option value="used">Sách cũ</option>
              </select>
            </label>
          </>
        )}
        <button className="button button-dark" type="submit">
          <Search size={16} />
          Tìm sách
        </button>
      </div>
      {!advanced && (
        <div className="edition-search-note">
          <span>Tìm đúng phiên bản, chọn đúng nhà bán.</span>
          <Link to="/tim-kiem-nang-cao">
            Tìm kiếm nâng cao
            <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </form>
  );
}
