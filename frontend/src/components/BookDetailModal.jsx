// Modal này hiển thị chi tiết sách và các thao tác mua, đọc, thích, chat.
import { Link } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Heart,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { types } from "../data/catalog.js";
import { money } from "../utils/format.js";
import { bookCondition, sellerUrl } from "../utils/marketplace.js";
import { BookFacts, Modal, OfferComparison } from "./index.js";
import BookReviews from "./BookReviews.jsx";
import DetailGallery from "./DetailGallery.jsx";
import RecommendedBooks from "./RecommendedBooks.jsx";

export default function BookDetailModal({
  selected,
  setSelected,
  library,
  profile,
  setReader,
  addToCart,
  favorites,
  toggleFavorite,
  chatStarting,
  startChat,
  books,
  cardProps,
  rememberListings,
  setAuth,
}) {
  return (
    <Modal title="CHI TIẾT SÁCH" onClose={() => setSelected(null)} wide>
      <div className="product-detail">
        <DetailGallery
          key={`${selected.id}:${selected.images?.map((image) => image.id).join(",") || "cover"}`}
          book={selected}
        />
        <div className="detail-copy">
          <span className="eyebrow">
            {types[selected.type].label} · {selected.category}
          </span>
          <h2>{selected.title}</h2>
          <p className="detail-author">{selected.author}</p>
          <BookFacts book={selected} />
          <p className="detail-description">{selected.description}</p>
          {selected.type !== "digital" && (
            <p className="detail-info">
              <CheckCircle2 size={16} />
              Tình trạng: <strong>{bookCondition(selected)}</strong>
            </p>
          )}
          <p className="detail-info">
            <Store size={16} />
            <Link
              to={sellerUrl(selected.sellerId)}
              onClick={() => setSelected(null)}
            >
              {selected.shop}
            </Link>
            {selected.location && " · " + selected.location}
          </p>
          <div className="detail-price">
            <strong>{money(selected.price)}</strong>
          </div>
          <div className="detail-actions">
            <button
              className="button button-dark"
              disabled={selected.sold || selected.pending}
              onClick={() => {
                if (
                  library.includes(selected.id) ||
                  (selected.type === "digital" &&
                    selected.hasEbook &&
                    selected.sellerId === profile?.id)
                ) {
                  setReader(selected);
                  setSelected(null);
                } else {
                  addToCart(selected);
                }
              }}
            >
              {selected.sold
                ? "Đã bán"
                : selected.pending
                  ? "Chưa công khai"
                  : library.includes(selected.id) ||
                      (selected.type === "digital" &&
                        selected.hasEbook &&
                        selected.sellerId === profile?.id)
                    ? "Đọc sách ngay"
                    : "Thêm vào giỏ hàng"}
              <ShoppingBag size={17} />
            </button>
            {selected.type === "digital" && !library.includes(selected.id) && (
              <button
                className="button button-outline"
                onClick={() => {
                  setReader({ ...selected, previewOnly: true });
                  setSelected(null);
                }}
              >
                <BookOpen size={17} />
                Đọc thử
              </button>
            )}
            <button
              className={`button button-outline favorite-detail ${favorites.includes(selected.id) ? "is-favorite" : ""}`}
              onClick={() => toggleFavorite(selected.id)}
              aria-label="Lưu sách yêu thích"
            >
              <Heart
                size={19}
                fill={favorites.includes(selected.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
          {selected.sellerId !== profile?.id && profile?.role !== "admin" && (
            <button
              className="button button-outline detail-chat-button"
              disabled={chatStarting}
              onClick={() => startChat({ listingId: selected.id })}
            >
              <MessageCircle size={17} />
              {chatStarting ? "Đang mở chat…" : "Chat với người bán"}
            </button>
          )}
          <div className="detail-assurance">
            <ShieldCheck size={15} />
            {selected.type === "digital"
              ? "Thanh toán VietQR · Quyền sở hữu lưu theo tài khoản"
              : "Thông tin rõ ràng · Kết nối người yêu sách"}
          </div>
        </div>
      </div>
      <OfferComparison
        books={books}
        selected={selected}
        onSelect={setSelected}
        onAdd={addToCart}
      />
      <RecommendedBooks
        listingId={selected.id}
        cardProps={cardProps}
        onResults={rememberListings}
      />
      {["new", "used"].includes(selected.type) && (
        <BookReviews
          key={`${selected.id}:${profile?.id || "guest"}`}
          listingId={selected.id}
          profile={profile}
          onLogin={() => {
            setSelected(null);
            setAuth(true);
          }}
        />
      )}
    </Modal>
  );
}
