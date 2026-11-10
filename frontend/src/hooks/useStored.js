import { useState, useEffect } from "react";
import { upgradeCatalog } from "../utils/marketplace.js";
// Đọc/ghi dữ liệu trình duyệt; khi bị chặn hoặc hết dung lượng vẫn cho app chạy.
export default function useStored(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem("bookmarket-v1-" + key);
      const value = stored ? JSON.parse(stored) : fallback;
      if (Array.isArray(fallback) && !Array.isArray(value)) {
        throw new Error("Invalid stored array");
      }
      return key === "books" ? upgradeCatalog(value) : value;
    } catch {
      return key === "books" ? upgradeCatalog(fallback) : fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("bookmarket-v1-" + key, JSON.stringify(value));
    } catch (error) {
      console.warn("Storage unavailable:", error.name);
    }
  }, [key, value]);
  return [value, setValue];
}
