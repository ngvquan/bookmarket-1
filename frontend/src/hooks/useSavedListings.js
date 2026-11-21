// Hook này tải lại các tin đã lưu trong giỏ, yêu thích hoặc thư viện.
import { useEffect } from "react";
import { listingService } from "../services/api.js";

export default function useSavedListings({
  cart,
  favorites,
  library,
  cartOpen,
  pathname,
  setBooks,
  rememberListings,
}) {
  const cartIds = cart.map((item) => item.id).join(",");
  const savedIds = [
    ...new Set([...favorites, ...library, ...cart.map((item) => item.id)]),
  ].join(",");

  // ID đã lưu không phụ thuộc vào trang catalog hiện đang được tải.
  useEffect(() => {
    let active = true;
    async function loadSavedBooks() {
      if (!savedIds) {
        return;
      }
      for (const id of savedIds.split(",")) {
        try {
          const book = await listingService.get(id);
          if (active) {
            rememberListings([book]);
          }
        } catch (error) {
          if (active && error.status === 404) {
            setBooks((old) =>
              old.map((book) =>
                book.id === id ? { ...book, hidden: true } : book,
              ),
            );
          }
        }
      }
    }
    loadSavedBooks();
    return () => {
      active = false;
    };
  }, [savedIds, pathname]);

  // Khi mở giỏ, đọc lại từng tin để không hiển thị giá hoặc trạng thái cũ.
  useEffect(() => {
    if (!cartOpen || !cart.length) {
      return;
    }
    let active = true;
    Promise.all(
      cart.map(async (item) => {
        try {
          return await listingService.get(item.id);
        } catch (error) {
          return error.status === 404 ? { id: item.id, hidden: true } : null;
        }
      }),
    ).then((latest) => {
      if (!active) {
        return;
      }
      setBooks((old) => {
        const next = [...old];
        for (const fresh of latest.filter(Boolean)) {
          const index = next.findIndex((book) => book.id === fresh.id);
          if (index < 0 && fresh.title) {
            next.push(fresh);
          } else if (index >= 0 && fresh.hidden) {
            next[index] = { ...next[index], hidden: true };
          } else if (index >= 0) {
            next[index] = {
              ...fresh,
              offerCount: fresh.offerCount ?? next[index].offerCount,
            };
          }
        }
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [cartOpen, cartIds]);
}
