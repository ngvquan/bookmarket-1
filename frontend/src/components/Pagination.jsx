// Hai nút chuyển trang dùng lại cho catalog, gian sách và quản lý tin.
export default function Pagination({ data, onPage, busy = false }) {
  if (data.pages <= 1) {
    return null;
  }
  return (
    <div className="catalog-pagination">
      <button
        className="button button-outline button-small"
        disabled={busy || data.page <= 1}
        onClick={() => onPage(data.page - 1)}
      >
        Trang trước
      </button>
      <span>
        Trang {data.page} / {data.pages}
      </span>
      <button
        className="button button-outline button-small"
        disabled={busy || data.page >= data.pages}
        onClick={() => onPage(data.page + 1)}
      >
        Trang sau
      </button>
    </div>
  );
}
