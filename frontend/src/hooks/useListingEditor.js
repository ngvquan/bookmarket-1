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
      stock: type === "new" ? Number(form.get("stock")) : undefined,
      style: editing?.style || "peace",
      coverTitle: title,
    };

    let saved;
    try {
      saved = await saveListing(draft, editing?.id);
      for (const image of images) {
        saved = await listingService.uploadImage(saved.id, image);
      }
      if (type === "digital" && ebook instanceof File && ebook.size > 0) {
        saved = await listingService.uploadEbook(saved.id, ebook);
      }
      rememberListings([saved]);
      await loadMyPage(1);
      setPost(null);
      setEditing(null);
      notify(
        type === "digital" ? "Đã lưu ebook và file PDF." : "Đã lưu tin đăng.",
      );
    } catch (error) {
      if (saved) {
        setEditing(saved);
      }
      notify(
        saved
          ? `Đã lưu thông tin nhưng tải tệp chưa xong: ${apiMessage(error)}`
          : apiMessage(error),
      );
    }
  }

  return saveBook;
}
