// Form sách mới, sách cũ và ebook; chưa upload ảnh/PDF.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Store, X } from "lucide-react";
import { Modal } from "./index.js";
import { types, categories } from "../data/catalog.js";
import { apiMessage, listingService } from "../services/api.js";
export default function PostForm({ type, editing, shop, onClose, onSubmit }) {
  const [selectedType, setSelectedType] = useState(type);
  const [metadata, setMetadata] = useState({
    title: editing?.title || "",
    author: editing?.author || "",
    isbn: editing?.isbn || "",
    publisher: editing?.publisher || "",
    year: editing?.year || "",
    category: editing?.category || "Văn học",
  });
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionError, setSuggestionError] = useState("");
  const [selectedEdition, setSelectedEdition] = useState(null);
  const [existingImages, setExistingImages] = useState(editing?.images || []);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [fileError, setFileError] = useState("");
  const needsShop =
    ["new", "digital"].includes(selectedType) && !shop?.isRegistrationComplete;
  const changeMetadata = (name, value) => {
    setMetadata((current) => ({ ...current, [name]: value }));
    setSelectedEdition(null);
  };
  useEffect(() => {
    if (editing || needsShop) return;
    const isbn = metadata.isbn.replace(/[\s-]/g, "");
    if (isbn.length < 4 && metadata.title.trim().length < 2) {
      setSuggestions([]);
      setSuggestionError("");
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const items = await listingService.suggestions({
          isbn,
          title: metadata.title.trim(),
          author: metadata.author.trim(),
          type: selectedType,
        });
        if (active) {
          setSuggestions(items);
          setSuggestionError("");
        }
      } catch (error) {
        if (active) {
          setSuggestions([]);
          setSuggestionError(apiMessage(error));
        }
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    editing,
    needsShop,
    metadata.isbn,
    metadata.title,
    metadata.author,
    selectedType,
  ]);
  const chooseEdition = (edition) => {
    setMetadata({
      title: edition.title,
      author: edition.author,
      isbn: edition.isbn,
      publisher: edition.publisher || "",
      year: edition.year || "",
      category: edition.category,
    });
    setSelectedEdition(edition.editionId);
  };
  useEffect(
    () => () => imagePreviews.forEach((item) => URL.revokeObjectURL(item.url)),
    [imagePreviews],
  );
  function chooseImages(event) {
    imagePreviews.forEach((item) => URL.revokeObjectURL(item.url));
    const files = [...event.target.files];
    if (existingImages.length + files.length > 5) {
      event.target.value = "";
      setImagePreviews([]);
      return setFileError("Mỗi tin đăng có tối đa 5 ảnh.");
    }
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 8 * 1024 * 1024,
      )
    ) {
      event.target.value = "";
      setImagePreviews([]);
      return setFileError(
        "Ảnh phải là JPEG, PNG hoặc WebP và không quá 8 MB mỗi ảnh.",
      );
    }
    setFileError("");
    setImagePreviews(
      files.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    );
  }
  function choosePdf(event) {
    const file = event.target.files[0] || null;
    if (
      file &&
      (file.type !== "application/pdf" || file.size > 100 * 1024 * 1024)
    ) {
      event.target.value = "";
      setSelectedPdf(null);
      return setFileError("PDF phải đúng định dạng và không quá 100 MB.");
    }
    setFileError("");
    setSelectedPdf(file);
  }
  async function removeImage(imageId) {
    try {
      const saved = await listingService.removeImage(editing.id, imageId);
      setExistingImages(saved.images || []);
    } catch (error) {
      setFileError(apiMessage(error));
    }
  }
  function submit(event) {
    if (selectedType === "digital" && !editing?.hasEbook && !selectedPdf) {
      event.preventDefault();
      setFileError("Hãy chọn file PDF trước khi đăng ebook.");
      return;
    }
    setFileError("");
    onSubmit(event);
  }
  return (
    <Modal
      title={editing ? "CHỈNH SỬA TIN ĐĂNG" : "CHO SÁCH MỘT HÀNH TRÌNH MỚI"}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <h2>
          {editing ? "Chăm chút lại trang sách." : "Kể về cuốn sách của bạn."}
        </h2>
        <label>
          Hình thức
          <select
            name="type"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setSelectedEdition(null);
            }}
          >
            {Object.entries(types).map(([key, t]) => (
              <option key={key} value={key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {needsShop ? (
          <div className="info-box">
            <Store size={22} />
            <p>
              Bạn cần hoàn tất thông tin liên hệ và địa chỉ lấy hàng để đăng
              sách mới hoặc ebook.{" "}
              <Link
                to={shop ? "/nguoi-ban/gian-hang" : "/dang-ky-rap-sach"}
                onClick={onClose}
              >
                Hoàn tất đăng ký rạp sách →
              </Link>
            </p>
          </div>
        ) : (
          <>
            <label>
              Tên sách
              <input
                name="title"
                required
                maxLength={180}
                value={metadata.title}
                onChange={(event) =>
                  changeMetadata("title", event.target.value)
                }
                placeholder="Tên một câu chuyện đáng chia sẻ"
              />
            </label>
            <label>
              Tác giả
              <input
                name="author"
                required
                maxLength={180}
                value={metadata.author}
                onChange={(event) =>
                  changeMetadata("author", event.target.value)
                }
                placeholder="Tên tác giả"
              />
            </label>
            <label>
              ISBN {editing ? "" : "(bắt buộc)"}
              <input
                name="isbn"
                required={!editing}
                value={metadata.isbn}
                onChange={(event) => changeMetadata("isbn", event.target.value)}
                pattern="(?:[0-9]{9}[0-9Xx]|[0-9]{13})"
                placeholder="ISBN 10 hoặc 13 chữ số, không dấu gạch"
              />
            </label>
            {!editing && suggestionError && (
              <p className="danger-text" role="alert">
                {suggestionError}
              </p>
            )}
            {!editing && suggestions.length > 0 && (
              <div className="edition-suggestions">
                <strong>Sách đã có trên BookMarket</strong>
                <p>
                  Chọn đúng phiên bản để tin của bạn xuất hiện trong phần so
                  sánh giá.
                </p>
                {suggestions.map((edition) => (
                  <button
                    type="button"
                    key={edition.editionId}
                    className={
                      selectedEdition === edition.editionId ? "selected" : ""
                    }
                    onClick={() => chooseEdition(edition)}
                  >
                    <span>
                      {edition.title} · {edition.author}
                    </span>
                    <small>
                      ISBN {edition.isbn}
                      {edition.publisher ? ` · ${edition.publisher}` : ""}
                      {edition.year ? ` · ${edition.year}` : ""} ·{" "}
                      {edition.offerCount} tin bán
                    </small>
                  </button>
                ))}
              </div>
            )}
            {selectedEdition && (
              <p className="shop-registration-saved" role="status">
                Đã chọn phiên bản có sẵn. Giá của shop sẽ được thêm vào phần so
                sánh.
              </p>
            )}
            <div className="form-row">
              <label>
                Nhà xuất bản
                <input
                  name="publisher"
                  maxLength={500}
                  value={metadata.publisher}
                  onChange={(event) =>
                    changeMetadata("publisher", event.target.value)
                  }
                  placeholder="Tên nhà xuất bản"
                />
              </label>
              <label>
                Năm xuất bản
                <input
                  name="year"
                  type="number"
                  min="1400"
                  max="2100"
                  value={metadata.year}
                  onChange={(event) =>
                    changeMetadata("year", event.target.value)
                  }
                  placeholder="Ví dụ: 2024"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Thể loại
                <select
                  name="category"
                  value={metadata.category}
                  onChange={(event) =>
                    changeMetadata("category", event.target.value)
                  }
                >
                  {categories.slice(1).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Giá bán (₫)
                <input
                  type="number"
                  name="price"
                  required
                  min="0"
                  max="100000000"
                  step="1"
                  defaultValue={editing?.price ?? 45000}
                />
              </label>
              {selectedType === "new" && (
                <label>
                  Số lượng
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    required
                    defaultValue={editing?.stock ?? 1}
                  />
                </label>
              )}
            </div>
            <label>
              Một vài dòng về cuốn sách
              <textarea
                name="description"
                required
                maxLength={5000}
                defaultValue={editing?.description}
                placeholder="Tình trạng sách, điều bạn thích ở cuốn sách này..."
              />
            </label>
            <label>
              Ảnh sách{" "}
              <small>JPEG, PNG hoặc WebP · tối đa 5 ảnh · 8 MB/ảnh</small>
              <input
                type="file"
                name="images"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={chooseImages}
              />
            </label>
            {(existingImages.length > 0 || imagePreviews.length > 0) && (
              <div className="upload-previews">
                {existingImages.map((image) => (
                  <div key={image.id}>
                    <img src={image.url} alt="Ảnh sách đã tải" />
                    <button
                      type="button"
                      aria-label="Xóa ảnh"
                      onClick={() => removeImage(image.id)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                {imagePreviews.map((image) => (
                  <div key={image.url}>
                    <img src={image.url} alt={image.name} />
                  </div>
                ))}
              </div>
            )}
            {selectedType === "digital" && (
              <label>
                File PDF ebook{" "}
                {editing?.hasEbook
                  ? "(chọn file mới nếu muốn thay)"
                  : "(bắt buộc)"}
                <input
                  type="file"
                  name="ebook"
                  accept="application/pdf"
                  onChange={choosePdf}
                />
                <small>
                  Tối đa 100 MB. Sau khi có người mua, PDF không thể thay thế.
                </small>
              </label>
            )}
            {fileError && (
              <p className="danger-text" role="alert">
                {fileError}
              </p>
            )}
            <p className="fine-print">
              Ảnh và PDF được lưu tại server. Ebook chỉ hiển thị công khai sau
              khi tải PDF thành công.
            </p>
            <button className="button button-dark full-width">
              {editing ? "Lưu thay đổi" : "Đăng sách"}
              <ArrowUpRight size={17} />
            </button>
          </>
        )}
      </form>
    </Modal>
  );
}
