// Hiển thị ảnh chính và danh sách ảnh nhỏ trong chi tiết sách.
import { useState } from "react";
import { Cover } from "./index.js";

export default function DetailGallery({ book }) {
  const images = book.images || [];
  const [active, setActive] = useState(0);

  return (
    <div className="detail-gallery">
      <div className={`detail-cover stage-${book.style}`}>
        {images.length ? (
          <img
            className="detail-gallery-main"
            src={images[active]?.url}
            alt={`${book.title} - ảnh ${active + 1}`}
          />
        ) : (
          <Cover book={book} />
        )}
      </div>
      {images.length > 1 && (
        <div className="detail-thumbnails" aria-label="Các ảnh của sách">
          {images.map((image, index) => (
            <button
              key={image.id || image.url}
              type="button"
              className={index === active ? "active" : ""}
              onClick={() => setActive(index)}
              aria-label={`Xem ảnh ${index + 1}`}
            >
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
