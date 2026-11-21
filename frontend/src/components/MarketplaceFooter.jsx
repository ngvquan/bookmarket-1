import { Link } from "react-router-dom";
import {
  BookOpen,
  Store,
  Package,
  ArrowLeftRight,
  ArrowRight,
} from "lucide-react";

export default function MarketplaceFooter() {
  return (
    <footer className="site-footer commerce-footer">
      <div className="footer-benefits shell">
        <div>
          <Store size={24} />
          <span>
            <strong>Nhiều nhà bán, nhiều lựa chọn</strong>
            <small>So sánh giá và tình trạng từng bản sách</small>
          </span>
        </div>
        <div>
          <Package size={24} />
          <span>
            <strong>Đơn hàng dễ theo dõi</strong>
            <small>Quản lý riêng theo từng người bán</small>
          </span>
        </div>
        <div>
          <ArrowLeftRight size={24} />
          <span>
            <strong>Mua sách mới và sách cũ</strong>
            <small>Tìm hình thức phù hợp với bạn</small>
          </span>
        </div>
      </div>
      <div className="shell footer-top">
        <div className="footer-brand">
          <Link className="logo" to="/">
            <span className="brand-symbol">
              <BookOpen size={24} />
            </span>
            <span>
              book<span>market</span>
            </span>
          </Link>
          <p>Sàn mua bán sách kết nối nhà sách độc lập và cộng đồng bạn đọc.</p>
          <span className="footer-payment">
            Thanh toán khi nhận hàng <b>COD</b>
          </span>
        </div>
        <div className="footer-column">
          <strong>Khám phá sách</strong>
          <Link to="/mua-sach">Mua sách</Link>
          <Link to="/digital">Sách điện tử</Link>
        </div>
        <div className="footer-column">
          <strong>Tài khoản của bạn</strong>
          <Link to="/don-hang">Theo dõi đơn hàng</Link>
          <Link to="/tin-nhan">Tin nhắn</Link>
          <Link to="/yeu-thich">Sách yêu thích</Link>
          <Link to="/thu-vien">Thư viện của tôi</Link>
        </div>
        <div className="footer-column">
          <strong>Dành cho người bán</strong>
          <Link to="/nguoi-ban">Kênh người bán</Link>
          <Link to="/dang-ky-rap-sach">Đăng ký rạp sách</Link>
          <Link to="/nha-ban">Danh sách nhà bán</Link>
          <Link to="/tim-kiem-nang-cao">Tìm sách theo ISBN</Link>
          <Link className="text-link" to="/nguoi-ban">
            Bắt đầu bán sách
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 BookMarket</span>
        <span>Đồ án · Vận chuyển đang dùng dịch vụ demo</span>
        <Link to="/quan-tri/dang-nhap">Quản trị</Link>
      </div>
    </footer>
  );
}
