// Hook này đồng bộ bộ lọc catalog trên URL và tải một trang kết quả từ API.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listingService, apiMessage } from "../services/api.js";
import { isAvailable } from "../utils/marketplace.js";

function normalizeLegacyFilters(params, type) {
  if (
    ["physical", "all"].includes(type) &&
    !params.has("type") &&
    params.get("condition")
  ) {
    params.set("type", params.get("condition") === "Mới" ? "new" : "used");
  }
  params.delete("condition");
  params.delete("binding");
  return params;
}

export default function useCatalogSearch({ type, sessionBooks, onResults }) {
  const [urlParams, setParams] = useSearchParams();
  const params = normalizeLegacyFilters(new URLSearchParams(urlParams), type);
  const [result, setResult] = useState({
    items: [],
    total: 0,
    pages: 0,
    page: 1,
  });
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState("");
  const queryString = params.toString();

  useEffect(() => {
    let active = true;
    setBusy(true);
    setLoadError("");
    const query = Object.fromEntries(new URLSearchParams(queryString));
    listingService
      .search({
        ...query,
        type:
          ["physical", "all"].includes(type) &&
          ["new", "used"].includes(query.type)
            ? query.type
            : type,
        scope: "public",
        group: "edition",
        limit: 10,
      })
      .then((data) => {
        if (active) {
          setResult(data);
          onResults(data.items);
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(apiMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [queryString, type]);

  function update(key, value) {
    // Đọc URL mới nhất để thao tác nhanh không khôi phục bộ lọc cũ.
    const next = normalizeLegacyFilters(
      new URLSearchParams(window.location.search),
      type,
    );
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") {
      next.delete("page");
    }
    setParams(next, { replace: true });
  }

  // Bỏ tin không còn bán trong bộ nhớ sau khi đọc lại API.
  const filtered = result.items.filter((book) => {
    const cached = sessionBooks.find((item) => item.id === book.id);
    return !cached || isAvailable(cached);
  });
  const activeFilters = [...params].filter(
    ([key]) => !["sort", "page"].includes(key),
  );

  return {
    params,
    setParams,
    update,
    result,
    busy,
    loadError,
    filtered,
    activeFilters,
    sort: params.get("sort") || "featured",
  };
}
