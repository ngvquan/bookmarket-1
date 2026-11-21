// Trang chủ ghép banner khám phá, sách gợi ý và các gian hàng nổi bật.
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  BookOpen,
  Tablet,
  Store,
  Library,
  Brain,
  BriefcaseBusiness,
  Baby,
  Heart,
  SlidersHorizontal,
} from "lucide-react";
import useHomeRecommendations from "../hooks/useHomeRecommendations.js";
import HomeRecommendations from "../components/HomeRecommendations.jsx";
import FeaturedSellers from "../components/FeaturedSellers.jsx";

const genres = [
  [Library, "Văn học", "Văn học"],
  [Brain, "Tâm lý & kỹ năng", "Tâm lý"],
  [BriefcaseBusiness, "Kinh tế", "Kinh tế"],
  [Baby, "Sách thiếu nhi", "Thiếu nhi"],
  [BookOpen, "Phát triển bản thân", "Phát triển bản thân"],
];
const routes = [
  [BookOpen, "Mua sách", "Sách mới & đã đọc", "/mua-sach", "mint"],
  [Tablet, "Sách điện tử", "Khám phá ebook", "/digital", "lilac"],
  [Heart, "Yêu thích", "Sách bạn đã lưu", "/yeu-thich", "peach"],
  [
    SlidersHorizontal,
    "Tìm theo ISBN",
    "Đúng bản bạn cần",
    "/tim-kiem-nang-cao",
    "pink",
  ],
];

export default function Home({
  books,
  cardProps,
  onOpen,
  onResults,
  sellers = [],
}) {
  const recommendations = useHomeRecommendations(books, onResults);
  return (
    <div className="home-page commerce-home">
      <div className="shell">
        <div className="market-intro">
          <span>
            <span className="live-dot" />
            Khám phá sách từ các nhà bán độc lập
          </span>
          <Link to="/tim-kiem">
            Xem toàn bộ sách
            <ArrowRight size={13} />
          </Link>
        </div>
        <div className="market-discovery">
          <aside className="home-categories" aria-label="Danh mục thể loại">
            <h2>
              <Library size={18} />
              Danh mục sách
            </h2>
            {genres.map(([Icon, label, category]) => (
              <Link
                key={label}
                to={`/mua-sach?category=${encodeURIComponent(category)}`}
              >
                <Icon size={17} />
                <span>{label}</span>
                <ChevronRight size={13} />
              </Link>
            ))}
          </aside>
          <section className="commerce-hero">
            <div className="commerce-hero-copy">
              <span className="hero-kicker">KHÁM PHÁ BOOKMARKET</span>
              <h1>
                Tìm sách hay.
                <br />
                Chọn giá hợp.
              </h1>
              <p>
                Sách mới và sách đã đọc, từ nhiều nhà bán.
                <br className="desktop-break" /> Thêm lựa chọn cho mỗi cuốn bạn
                tìm.
              </p>
              <Link className="button button-dark" to="/mua-sach">
                Khám phá ngay
                <ArrowRight size={16} />
              </Link>
            </div>
            <div
              className="hero-book-display"
              aria-label="Lễ hội sách BookMarket"
            >
              <img
                className="hero-festival-image"
                src="/images/book-festival-hero.png"
                alt="Book Festival với cuốn sách mở và nhiều sách xung quanh"
              />
            </div>
          </section>
          <div className="market-side-promos">
            <Link className="side-promo promo-used" to="/mua-sach">
              <span className="promo-caption">
                MUA SÁCH
                <BookOpen size={20} />
              </span>
              <h2>
                Sách hay,
                <br />
                giá nhẹ hơn.
              </h2>
              <p>So sánh giá từ nhiều nhà bán</p>
              <span className="promo-link">
                Xem sách đang bán
                <ArrowRight size={15} />
              </span>
            </Link>
          </div>
        </div>
        <nav className="market-shortcuts" aria-label="Khám phá các loại sách">
          {routes.map(([Icon, title, text, to, color]) => (
            <Link to={to} key={to}>
              <span className={`market-shortcut-icon tone-${color}`}>
                <Icon size={25} strokeWidth={1.7} />
              </span>
              <strong>{title}</strong>
              <small>{text}</small>
            </Link>
          ))}
        </nav>
        <HomeRecommendations
          {...recommendations}
          books={recommendations.recommended}
          cardProps={cardProps}
        />
        <FeaturedSellers sellers={sellers} />
      </div>
    </div>
  );
}
