// Hook này tải sách gợi ý theo thể loại và chuẩn bị sách cho banner trang chủ.
import { useEffect, useState } from "react";
import { listingService, apiMessage } from "../services/api.js";
import { groupBookCards, isAvailable } from "../utils/marketplace.js";

export default function useHomeRecommendations(books, onResults) {
  const [category, setCategory] = useState("Tất cả");
  const [categoryResult, setCategoryResult] = useState({
    category: "",
    items: [],
    error: "",
  });

  useEffect(() => {
    if (category === "Tất cả") {
      return;
    }
    let active = true;
    listingService
      .search({ type: "physical", group: "edition", category, limit: 12 })
      .then((data) => {
        if (!active) {
          return;
        }
        setCategoryResult({ category, items: data.items, error: "" });
        onResults?.(data.items);
      })
      .catch((error) => {
        if (active) {
          setCategoryResult({ category, items: [], error: apiMessage(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [category]);

  const paperBooks = groupBookCards(
    books
      .filter(isAvailable)
      .filter((book) => ["new", "used"].includes(book.type)),
  );
  const busy = category !== "Tất cả" && categoryResult.category !== category;
  const error =
    categoryResult.category === category ? categoryResult.error : "";
  const source =
    category === "Tất cả"
      ? paperBooks
      : categoryResult.category === category
        ? categoryResult.items
        : [];

  return {
    category,
    setCategory,
    busy,
    error,
    recommended: groupBookCards(source).slice(0, 12),
    heroBooks: paperBooks.slice(0, 3),
  };
}
