// Hook này lưu thông tin, ảnh và file PDF của một tin đăng.
import { apiMessage, listingService } from "../services/api.js";
import { trimRequired } from "../utils/validation.js";

export default function useListingEditor({
  editing,
  saveListing,
  rememberListings,
  loadMyPage,
  setPost,
  setEditing,
  setSuccess,
  notify,
}) {
  async function saveBook(event) {
    event.preventDefault();
    if (!trimRequired(event)) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const type = form.get("type");
    const images = form
      .getAll("images")
      .filter((file) => file instanceof File && file.size > 0);
    const ebook = form.get("ebook");
    const title = form.get("title").trim();
    const draft = {
      type,
      title,
      author: form.get("author").trim(),
      category: form.get("category"),
      description: form.get("description").trim(),
      isbn: form.get("isbn")?.replace(/[\s-]/g, "") || "",
      publisher: form.get("publisher")?.trim() || "",
      year: Number(form.get("year")) || undefined,
      price: Number(form.get("price")),
      // Mỗi tin sách mới bắt đầu với một cuốn; khi sửa giữ tồn kho hiện có.
      stock: type === "new" && editing?.type !== "new" ? 1 : undefined,
      style: editing?.style || "peace",
      coverTitle: title,
    };

    let saved;
    const wasEditing = Boolean(editing);
    try {
      saved = await saveListing(draft, editing?.id);
      for (const image of images) {
        saved = await listingService.uploadImage(saved.id, image);
      }
      if (type === "digital" && ebook instanceof File && ebook.size > 0) {
        saved = await listingService.uploadEbook(saved.id, ebook);
      }
      rememberListings([saved]);
      try {
        await loadMyPage(1);
      } catch {
        notify("Sách đã được lưu. Hãy tải lại trang để cập nhật danh sách.");
      }
      setPost(null);
      setEditing(null);
      setSuccess({
        title: wasEditing ? "Đã cập nhật sách" : "Đăng sách thành công!",
        text: saved.status === "approved"
          ? `“${title}” đã hiển thị trên BookMarket. Bạn có thể xem và quản lý sách trong mục Sản phẩm.`
          : `“${title}” đã được lưu nhưng chưa công khai. Xem trạng thái trong mục Sản phẩm.`,
        action: "Xem sách của tôi",
        to: "/nguoi-ban/san-pham",
      });
    } catch (error) {
      if (saved) {
        setEditing(saved);
      }
      const message = saved
        ? `Đã lưu thông tin nhưng tải tệp chưa xong: ${apiMessage(error)}`
        : apiMessage(error);
      notify(message);
      return { error: message };
    }
    return { success: true };
  }

  return saveBook;
}
