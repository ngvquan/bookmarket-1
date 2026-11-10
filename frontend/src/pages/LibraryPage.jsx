// Quyền sở hữu lấy từ GET /library, vẫn đọc được khi người bán ẩn tin.
import { BookCard, Empty } from "../components/index.js";
import PageTitle from "../components/PageTitle.jsx";
export default function LibraryPage({
  books,
  loading,
  error,
  onRetry,
  cardProps,
}) {
  return (
    <div className="shell page-content">
      <PageTitle
        eyebrow="THƯ VIỆN RIÊNG CỦA BẠN"
        title="Đọc ở bất cứ nơi đâu."
        description="Ebook đã mua được lưu theo tài khoản, không mất khi tải lại trang."
      />
      {loading && <p role="status">Đang tải thư viện…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => onRetry().catch(() => {})}>Thử lại</button>
        </p>
      )}
      {books.length ? (
        <div className="book-grid catalog-grid">
          {books.map((b) => (
            <BookCard key={b.id} book={b} {...cardProps} owned />
          ))}
        </div>
      ) : (
        !loading &&
        !error && (
          <Empty
            title="Trang đầu tiên đang đợi bạn"
            description="Ebook tự xuất hiện tại đây sau khi xác nhận chuyển khoản."
            to="/digital"
            action="Khám phá sách điện tử"
          />
        )
      )}
    </div>
  );
}
