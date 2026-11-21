// Chỉ hiển thị sách yêu thích còn khả dụng theo dữ liệu API.
import { BookCard, Empty } from "../components/index.js";
import { isAvailable } from "../utils/marketplace.js";
import PageTitle from "../components/PageTitle.jsx";
export default function FavoritesPage({ books, favorites, cardProps }) {
  return (
    <div className="shell page-content">
      <PageTitle
        eyebrow="GIỮ LẠI MỘT CHÚT THƯƠNG"
        title="Góc sách yêu thích"
        description="Những cuốn sách bạn muốn dành thời gian cho, vào một ngày thật đẹp."
      />
      {books.some((b) => favorites.includes(b.id) && isAvailable(b)) ? (
        <div className="book-grid catalog-grid">
          {books
            .filter((b) => favorites.includes(b.id) && isAvailable(b))
            .map((b) => (
              <BookCard key={b.id} book={b} {...cardProps} />
            ))}
        </div>
      ) : (
        <Empty
          icon={Heart}
          title="Góc nhỏ đang chờ được lấp đầy"
          description="Chạm vào trái tim trên một cuốn sách để lưu vào đây."
        />
      )}
    </div>
  );
}
