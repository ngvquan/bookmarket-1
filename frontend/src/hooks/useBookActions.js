// Hook này xử lý mở chi tiết, thêm giỏ và đọc ebook.
import { apiMessage, listingService } from "../services/api.js";
import { isAvailable } from "../utils/marketplace.js";

export default function useBookActions({
  profile,
  library,
  ownedBooks,
  refreshLibrary,
  setReader,
  setSelected,
  setCart,
  setPaymentOrder,
  setCheckout,
  setCartOpen,
  rememberListings,
  navigate,
  notify,
}) {
  async function openReader(book) {
    try {
      let owned = ownedBooks.find((item) => item.id === book.id);
      if (!owned) {
        owned = ((await refreshLibrary()) || []).find(
          (item) => item.id === book.id,
        );
      }
      if (!owned) {
        return notify("Bạn chưa có quyền đọc ebook này.");
      }
      setReader(owned);
    } catch (error) {
      notify(apiMessage(error));
    }
  }

  async function finishDigitalOrder(order) {
    // Chỉ xóa ebook khỏi giỏ sau khi server xác nhận trạng thái paid.
    setCart((old) =>
      old.filter(
        (item) => !order.items.some((book) => book.listingId === item.id),
      ),
    );
    setPaymentOrder(null);
    setCheckout(false);
    setCartOpen(false);
    navigate("/thu-vien");
    notify("Thanh toán thành công. Ebook đã vào thư viện.");
    try {
      await refreshLibrary();
    } catch {
      notify("Đã thanh toán. Hãy tải lại thư viện để xem ebook.");
    }
  }

  // Một thẻ có thể đại diện nhiều tin; tải đủ các offer khi mở chi tiết.
  async function openBook(book) {
    setSelected(book);
    if (
      !(book.editionId || book.isbn) ||
      !["new", "used"].includes(book.type)
    ) {
      return;
    }
    try {
      let page = 1;
      let pages;
      do {
        const data = await listingService.search({
          ...(book.editionId
            ? { edition: book.editionId }
            : { isbn: book.isbn }),
          type: "physical",
          limit: 50,
          page,
        });
        rememberListings(data.items);
        pages = data.pages;
        page += 1;
      } while (page <= pages);
    } catch (error) {
      notify(apiMessage(error));
    }
  }

  // Tải tin mới nhất trước khi thêm để kiểm tra trạng thái và tồn kho.
  async function addToCart(candidate) {
    try {
      const book = { ...(await listingService.get(candidate.id)) };
      if (!isAvailable(book)) {
        return notify("Tin không còn bán.");
      }
      if (profile?.id === book.sellerId) {
        return notify("Không được mua tin của chính mình.");
      }
      if (library.includes(book.id)) {
        return notify("Ebook đã có trong thư viện của bạn.");
      }
      // Giữ vị trí cũ để sách không rơi khỏi danh sách giới hạn ở trang chủ.
      rememberListings([book]);
      const limit = ["used", "digital"].includes(book.type) ? 1 : book.stock;
      setCart((old) => {
        const existing = old.find((item) => item.id === book.id);
        if (existing && existing.quantity >= limit) {
          return old;
        }
        return existing
          ? old.map((item) =>
              item.id === book.id
                ? { ...item, quantity: item.quantity + 1, snapshot: book }
                : item,
            )
          : [...old, { id: book.id, quantity: 1, snapshot: book }];
      });
      notify("Đã thêm sách vào giỏ.");
    } catch (error) {
      notify(apiMessage(error));
    }
  }

  return { openReader, finishDigitalOrder, openBook, addToCart };
}
