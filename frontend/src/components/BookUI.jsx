// Thẻ sản phẩm, bìa sách và so sánh tin bán của từng người bán.
import { useState } from "react";
import {
  ArrowUpRight,
  Heart,
  MapPin,
  ShoppingBag,
  BookOpen,
  ShieldCheck,
} from "lucide-react";

import { Link } from "react-router-dom";

import { money } from "../utils/format.js";

import {
  bookCondition,
  relatedOffers,
  sellerUrl,
} from "../utils/marketplace.js";

export function BookFacts({ book }) {
  return (
    <dl className="book-facts">
      <div>
        <dt>Nhà xuất bản</dt>
        <dd>{book.publisher || "Chưa cập nhật"}</dd>
      </div>
      <div>
        <dt>Năm xuất bản</dt>
        <dd>{book.year || "Chưa cập nhật"}</dd>
      </div>
      <div>
        <dt>ISBN</dt>
        <dd>{book.isbn || "Chưa có ISBN"}</dd>
      </div>
    </dl>
  );
}

export function OfferComparison({ books, selected, onSelect, onAdd }) {
  const offers = relatedOffers(books, selected);
  if (!offers.length) {
    return null;
  }
  return (
    <section className="offer-comparison">
      <div>
        <span className="eyebrow">
          CÙNG PHIÊN BẢN{selected.isbn && ` · ISBN ${selected.isbn}`}
        </span>
        <h3>Chọn bản sách từ nhà bán phù hợp</h3>
        <p>Giá, tình trạng và số lượng thuộc riêng từng tin đăng.</p>
      </div>
      <div className="offer-table">
        {[selected, ...offers]
          .sort((a, b) => a.price - b.price)
          .map((book) => (
            <div
              className={`offer-row ${book.id === selected.id ? "selected-offer" : ""}`}
              key={book.id}
            >
              <div>
                <Link
                  to={sellerUrl(book.sellerId)}
                  onClick={() => onSelect(null)}
                >
                  {book.shop}
                </Link>
                <span>
                  {book.location} · {bookCondition(book)}
                </span>
              </div>
              <strong>{money(book.price)}</strong>
              <button
                className="button button-outline button-small"
                onClick={() => onSelect(book)}
              >
                {book.id === selected.id ? "Đang xem" : "Xem bản này"}
              </button>
              <button
                className="button button-dark button-small"
                onClick={() => onAdd(book)}
                aria-label={`Thêm bản của ${book.shop} vào giỏ`}
              >
                Thêm giỏ
              </button>
            </div>
          ))}
      </div>
      <Link
        className="text-link"
        to={`/tim-kiem?${selected.editionId ? `edition=${encodeURIComponent(selected.editionId)}` : `isbn=${encodeURIComponent(selected.isbn)}`}`}
        onClick={() => onSelect(null)}
      >
        Tìm sách cùng phiên bản
      </Link>
    </section>
  );
}

export function Cover({ book, className = "" }) {
  const [failedSource, setFailedSource] = useState(null);
  const illustratedStyles = [
    "orange",
    "alchemist",
    "slow",
    "midnight",
    "habits",
    "courage",
    "flowers",
    "meaning",
    "youth",
    "prince",
    "forest",
    "ocean",
  ];
  const source =
    book.coverUrl ||
    (illustratedStyles.includes(book.style)
      ? `/covers/${book.style}.jpg`
      : null);
  if (source && failedSource !== source) {
    return (
      <div className={`book-cover photographic-cover ${className}`}>
        <img
          src={source}
          alt={`Bìa ${book.title}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(source)}
        />
      </div>
    );
  }
  return (
    <div
      className={`book-cover cover-${book.style || "peace"} ${book.id?.startsWith("extra:") ? "cover-extra" : ""} ${book.title.length > 46 ? "cover-long-title" : ""} ${className}`}
      aria-label={`Bìa ${book.title}`}
    >
      <div className="cover-paper" />
      <span className="cover-author">{book.author}</span>
      <div className="cover-art">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <strong className="cover-title">{book.coverTitle || book.title}</strong>
      <span className="cover-subtitle">
        {book.subtitle || "Mỗi cuốn sách, một hành trình"}
      </span>
      <span className="cover-publisher">
        B O O K M A R K E T <span>✳</span>
      </span>
    </div>
  );
}

export function BookCard({
  book,
  favorites,
  toggleFavorite,
  onOpen,
  onAdd,
  owned,
  onRead,
  allBooks = [],
  listing = false,
}) {
  const favorite = favorites.includes(book.id);
  const offers = relatedOffers(allBooks, book);
  const offerCount = Math.max(book.offerCount || 1, offers.length + 1);
  const action = () => (owned ? onRead(book) : onAdd(book));
  const actionText = owned ? "Đọc sách" : "Thêm vào giỏ";
  if (listing) {
    return (
      <article className="book-card listing-row">
        <div className={`listing-cover stage-${book.style}`}>
          <button
            className="cover-button"
            onClick={() => onOpen(book)}
            aria-label={`Xem ${book.title}`}
          >
            <Cover book={book} />
          </button>
          {book.type === "digital" && (
            <span className="condition-tag">EBOOK · PDF</span>
          )}
        </div>
        <div className="listing-description">
          <span className="listing-kind">
            {book.category} <span>·</span> {bookCondition(book)}
          </span>
          <button className="book-title" onClick={() => onOpen(book)}>
            {book.title}
          </button>
          <p className="listing-author">{book.author}</p>
          <BookFacts book={book} />
          <p className="listing-excerpt">{book.description}</p>
          <div className="listing-seller">
            <ShieldCheck size={14} />
            <Link to={sellerUrl(book.sellerId)}>{book.shop}</Link>
            <span>({book.location || "Việt Nam"})</span>
          </div>
          {offerCount > 1 && (
            <button className="other-offers-link" onClick={() => onOpen(book)}>
              Xem {offerCount} bản bán cùng phiên bản
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>
        <div className="listing-buy">
          <span className="listing-condition">{bookCondition(book)}</span>
          {
            <>
              <div className="book-price">
                <strong>{money(book.price)}</strong>
              </div>
              <span className="listing-shipping">
                {book.type === "digital"
                  ? "Quyền đọc được cấp sau xác nhận chuyển khoản"
                  : "Chọn dịch vụ giao ở bước đặt hàng"}
              </span>
              <span className="listing-stock">
                {book.type === "new"
                  ? `${book.stock} bản có sẵn`
                  : book.type === "used"
                    ? "Chỉ còn 1 bản"
                    : "Ebook · PDF"}
              </span>
            </>
          }
          <button className="quick-add" onClick={action}>
            {owned ? <BookOpen size={15} /> : <ShoppingBag size={15} />}
            {actionText}
          </button>
          <button
            className={`listing-save ${favorite ? "is-favorite" : ""}`}
            onClick={() => toggleFavorite(book.id)}
            aria-label={`${favorite ? "Bỏ yêu thích" : "Yêu thích"} ${book.title}`}
          >
            <Heart size={14} fill={favorite ? "currentColor" : "none"} />
            {favorite ? "Đã lưu" : "Lưu sách"}
          </button>
        </div>
      </article>
    );
  }
  return (
    <article className="book-card">
      <div className={`book-stage stage-${book.style}`}>
        {book.type === "new" && <span className="condition-tag">Sách mới</span>}
        {book.type === "used" && <span className="condition-tag">Sách cũ</span>}
        {book.type === "digital" && (
          <span className="condition-tag">EBOOK · PDF</span>
        )}
        <button
          className={`favorite-button ${favorite ? "is-favorite" : ""}`}
          onClick={() => toggleFavorite(book.id)}
          aria-label={`${favorite ? "Bỏ yêu thích" : "Yêu thích"} ${book.title}`}
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} />
        </button>
        <button
          className="cover-button"
          onClick={() => onOpen(book)}
          aria-label={`Xem ${book.title}`}
        >
          <Cover book={book} />
        </button>
      </div>
      <div className="book-meta">
        <span>{book.category}</span>
      </div>
      <button className="book-title" onClick={() => onOpen(book)}>
        {book.title}
      </button>
      <p className="book-author">{book.author}</p>
      {
        <div className="book-price">
          <strong>{money(book.price)}</strong>
        </div>
      }
      <div className="book-shop">
        {book.location ? <MapPin size={12} /> : <ShieldCheck size={12} />}{" "}
        <Link to={sellerUrl(book.sellerId)}>{book.shop}</Link>
        {book.location && (
          <span className="seller-location"> · {book.location}</span>
        )}
      </div>
      {offerCount > 1 && (
        <button className="card-other-offers" onClick={() => onOpen(book)}>
          {offerCount} bản bán cùng phiên bản
          <ArrowUpRight size={12} />
        </button>
      )}
      <button
        className="quick-add"
        onClick={() => (owned ? onRead(book) : onAdd(book))}
      >
        {owned ? <BookOpen size={15} /> : <ShoppingBag size={15} />}
        {owned ? "Đọc sách" : "Thêm vào giỏ"}
      </button>
    </article>
  );
}
