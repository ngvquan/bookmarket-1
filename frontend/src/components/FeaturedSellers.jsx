// Section này giới thiệu các gian hàng nổi bật và lối vào đăng bán sách.
import { ArrowRight, BookOpen, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { sellerUrl } from "../utils/marketplace.js";
import { SectionHeading } from "./index.js";

function sellerMonogram(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0])
    .join("");
}

export default function FeaturedSellers({ sellers }) {
  return (
    <>
      <section className="commerce-section featured-sellers">
        <SectionHeading
          title="Khám phá nhà bán sách"
          link="Tất cả nhà bán"
          to="/nha-ban"
        />
        <p className="section-description">
          Ghé từng gian hàng để xem sách và lựa chọn của riêng họ.
        </p>
        <div className="featured-seller-grid">
          {sellers.map((seller, index) => (
            <Link
              to={sellerUrl(seller.id)}
              className={`featured-seller seller-color-${index}`}
              key={seller.id}
            >
              <span className="seller-monogram">
                {sellerMonogram(seller.name)}
              </span>
              <div className="seller-summary">
                <h3>{seller.name}</h3>
                <p>
                  <BookOpen size={13} />
                  {seller.total} tin sách đang bán
                </p>
                <span className="text-link">
                  Ghé gian hàng
                  <ArrowRight size={14} />
                </span>
              </div>
              <Store className="seller-watermark" size={70} strokeWidth={1} />
            </Link>
          ))}
        </div>
        {!sellers.length && (
          <p className="section-description">
            Các gian hàng sẽ xuất hiện khi có sách đang bán.
          </p>
        )}
      </section>
      <section className="seller-invite">
        <div>
          <span className="seller-invite-icon">
            <Store size={30} />
          </span>
          <div>
            <h2>Bạn có sách muốn bán?</h2>
            <p>Đăng sách cũ hoặc mở gian hàng để bắt đầu.</p>
          </div>
        </div>
        <Link className="button button-dark" to="/nguoi-ban/san-pham">
          Đăng bán sách
          <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
