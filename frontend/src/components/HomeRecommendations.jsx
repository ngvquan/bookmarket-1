// Section này hiển thị các sách gợi ý theo thể loại ở trang chủ.
import { Search, Store } from "lucide-react";
import { BookCard, Empty, SectionHeading } from "./index.js";

const recommendationCategories = [
  "Tất cả",
  "Văn học",
  "Phát triển bản thân",
  "Tâm lý",
  "Kinh tế",
  "Thiếu nhi",
];

export default function HomeRecommendations({
  category,
  setCategory,
  busy,
  error,
  books,
  cardProps,
}) {
  return (
    <section className="commerce-section new-arrivals">
      <SectionHeading
        title="Sách đang bán trên sàn"
        link="Xem tất cả"
        to="/mua-sach"
      />
      <div className="section-subline">
        <span>Chọn sách theo sở thích của bạn</span>
        <span>
          <Store size={13} />
          Từ nhiều nhà bán
        </span>
      </div>
      <div
        className="recommendation-tabs"
        role="group"
        aria-label="Thể loại sách gợi ý"
      >
        {recommendationCategories.map((item) => (
          <button
            key={item}
            className={category === item ? "active" : ""}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {busy ? (
        <p role="status" className="section-description">
          Đang tải sách theo thể loại…
        </p>
      ) : error ? (
        <p role="alert" className="danger-text">
          {error}
        </p>
      ) : books.length ? (
        <div className="book-grid home-book-grid">
          {books.map((book) => (
            <BookCard key={book.id} book={book} {...cardProps} />
          ))}
        </div>
      ) : (
        <Empty
          icon={Search}
          title="Chưa có sách trong thể loại này"
          description="Chọn một thể loại khác hoặc xem toàn bộ sách trên sàn."
          to="/mua-sach"
          action="Xem tất cả sách"
        />
      )}
    </section>
  );
}
