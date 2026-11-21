import { useEffect, useState } from "react";
import { apiMessage, listingService } from "../services/api.js";
import { BookCard } from "./BookUI.jsx";

export default function RecommendedBooks({ listingId, cardProps, onResults }) {
  const [result, setResult] = useState({
    loading: true,
    sameAuthor: [],
    sameCategory: [],
  });
  useEffect(() => {
    let active = true;
    setResult({ loading: true, sameAuthor: [], sameCategory: [] });
    listingService
      .recommendations(listingId, 3)
      .then((data) => {
        if (!active) return;
        const suggestions = uniqueSuggestions(data).slice(0, 3);
        onResults(suggestions);
        setResult({ loading: false, ...data });
      })
      .catch((error) => {
        if (active)
          setResult({
            loading: false,
            error: apiMessage(error),
            sameAuthor: [],
            sameCategory: [],
          });
      });
    return () => {
      active = false;
    };
  }, [listingId]);
  if (result.loading) return <p role="status">Đang tải gợi ý sách…</p>;
  if (result.error)
    return (
      <p role="alert" className="danger-text">
        {result.error}
      </p>
    );
  const suggestions = uniqueSuggestions(result).slice(0, 3);
  if (!suggestions.length) return null;
  return (
    <section className="recommended-books" aria-label="Sách gợi ý">
      <div className="recommended-books-heading">
        <div>
          <span className="eyebrow">GỢI Ý MUA THÊM</span>
          <h3>Có thể bạn sẽ thích</h3>
        </div>
        <p>Dựa trên tác giả và thể loại của cuốn sách bạn đang xem.</p>
      </div>
      <div className="book-grid recommended-books-grid">
        {suggestions.map((book) => (
          <BookCard key={book.id} book={book} {...cardProps} />
        ))}
      </div>
    </section>
  );
}

function uniqueSuggestions(data) {
  const seen = new Set();
  return [...data.sameAuthor, ...data.sameCategory].filter((book) => {
    if (seen.has(book.id)) return false;
    seen.add(book.id);
    return true;
  });
}
