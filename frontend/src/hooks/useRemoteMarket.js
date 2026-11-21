// Dữ liệu từ API: chỉ lấy từng trang, giữ những tin đã xem trong bộ nhớ cho giỏ/chi tiết.
import { useEffect, useState } from "react";
import {
  authService,
  listingService,
  shopService,
  apiMessage,
} from "../services/api.js";
const emptyPage = {
  items: [],
  page: 1,
  pages: 0,
  total: 0,
};
export default function useRemoteMarket() {
  const [books, setBooks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [myPage, setMyPage] = useState(emptyPage);
  const [adminPage, setAdminPage] = useState(emptyPage);
  const [featuredSellers, setFeaturedSellers] = useState([]);

  // Gộp trang vừa đọc theo ID, không gộp theo ISBN hoặc tên shop.
  function rememberListings(items) {
    setBooks((old) => {
      const next = [...old];
      for (const book of items) {
        const index = next.findIndex((item) => item.id === book.id);
        if (index === -1) {
          next.push(book);
        } else {
          // API chi tiết không có offerCount: giữ số bản bán từ kết quả đã gộp.
          next[index] = {
            ...book,
            offerCount: book.offerCount ?? next[index].offerCount,
          };
        }
      }
      return next;
    });
  }

  // Trang chủ chỉ lấy các nhóm nhỏ. Catalog tự gọi API theo bộ lọc/trang đang chọn.
  async function loadHome() {
    const paperBooks = await listingService.search({
      type: "physical",
      group: "edition",
      limit: 12,
    });
    const sellers = await listingService.sellers({
      limit: 3,
    });
    rememberListings(paperBooks.items);
    setFeaturedSellers(sellers.items);
  }
  async function loadMyPage(page = 1) {
    const data = await listingService.search({
      scope: "mine",
      page,
      limit: 10,
    });
    setMyPage(data);
    rememberListings(data.items);
  }
  async function loadAdminPage(page = 1, status = "") {
    const data = await listingService.search({
      scope: "all",
      page,
      limit: 10,
      status,
    });
    setAdminPage({
      ...data,
      status,
    });
    rememberListings(data.items);
  }

  // Khôi phục đăng nhập bằng /auth/me, không lấy profile hay role từ localStorage.
  async function reloadMarket() {
    setLoading(true);
    setError("");
    try {
      const user = await authService.restore();
      setProfile(user);
      await loadHome();
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reloadMarket();
    function expired() {
      setProfile(null);
      setMyPage(emptyPage);
      setAdminPage(emptyPage);
    }
    window.addEventListener("bookmarket-auth-expired", expired);
    return () => window.removeEventListener("bookmarket-auth-expired", expired);
  }, []);
  async function authenticate(data) {
    const user = await authService.authenticate(data);
    setProfile(user);
    setMyPage(emptyPage);
    setAdminPage(emptyPage);
    return user;
  }
  function logout() {
    authService.logout();
    setProfile(null);
    setMyPage(emptyPage);
    setAdminPage(emptyPage);
    // Loại tin riêng tư khỏi bộ nhớ khi đăng xuất, không ảnh hưởng giỏ/yêu thích.
    setBooks((old) => old.filter((book) => book.status === "approved"));
  }
  async function saveShop(data) {
    let saved;
    try {
      saved = await shopService.save(data, profile?.shopId);
    } catch (error) {
      if (profile?.shopId || error.status !== 409) throw error;
      saved = await shopService.mine();
      if (!saved) throw error;
    }
    setProfile((current) =>
      current?.id === saved.ownerId
        ? { ...current, shopId: saved.id, shop: saved }
        : current,
    );
    return saved;
  }
  async function saveListing(book, id) {
    const result = await listingService.save(book, id);
    rememberListings([result]);
    await loadMyPage(1);
    return result;
  }
  async function deleteListing(id) {
    await listingService.remove(id);
    setBooks((old) => old.filter((book) => book.id !== id));
    await loadMyPage(1);
  }
  async function markSold(id) {
    const result = await listingService.sold(id);
    rememberListings([result]);
    await loadMyPage(myPage.page);
  }
  async function setListingVisibility(id, hidden) {
    const result = await listingService.visibility(id, hidden);
    rememberListings([result]);
    await loadMyPage(myPage.page);
  }
  async function moderateListing(id, status) {
    const result = await listingService.moderate(id, status);
    rememberListings([result]);
    await loadAdminPage(adminPage.page, adminPage.status);
  }
  return {
    books,
    setBooks,
    rememberListings,
    profile,
    setProfile,
    shop: profile?.shop || null,
    loading,
    error,
    reloadMarket,
    authenticate,
    logout,
    saveShop,
    saveListing,
    deleteListing,
    markSold,
    setListingVisibility,
    moderateListing,
    myPage,
    adminPage,
    loadMyPage,
    loadAdminPage,
    featuredSellers,
  };
}
