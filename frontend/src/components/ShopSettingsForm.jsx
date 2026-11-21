import { useRef, useState } from "react";
import ShopFields, { shopDraft, shopPayload } from "./ShopFields.jsx";
import { apiMessage } from "../services/api.js";

export default function ShopSettingsForm({ shop, profile, onSave }) {
  const [draft, setDraft] = useState(() => shopDraft(shop, profile));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const onChange = (name, value) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setError("");
    setSaved(false);
  };
  return (
    <form
      className="form-stack shop-form shop-settings-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (sending.current) return;
        sending.current = true;
        setBusy(true);
        setError("");
        setSaved(false);
        try {
          await onSave(shopPayload(draft));
          setSaved(true);
        } catch (error) {
          setError(apiMessage(error));
        } finally {
          sending.current = false;
          setBusy(false);
        }
      }}
    >
      <h2>Thông tin gian hàng</h2>
      {!shop.isRegistrationComplete && (
        <p role="status" className="info-box">
          Shop chưa hoàn tất đăng ký. Điền đầy đủ liên hệ và địa chỉ lấy hàng
          rồi lưu để đăng sách mới hoặc ebook.
        </p>
      )}
      <ShopFields
        section="shop"
        draft={draft}
        onChange={onChange}
        disabled={busy}
      />
      <div className="shop-settings-contact-heading">
        <h3>Thông tin liên hệ của chủ shop</h3>
        <p>Chỉ chủ tài khoản được xem và chỉnh sửa các thông tin này.</p>
      </div>
      <ShopFields
        section="contact"
        draft={draft}
        onChange={onChange}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="shop-registration-saved">
          Đã lưu thông tin gian hàng.
        </p>
      )}
      <button className="button button-dark" disabled={busy}>
        {busy
          ? "Đang lưu…"
          : shop.isRegistrationComplete
            ? "Lưu thông tin"
            : "Hoàn tất đăng ký"}
      </button>
    </form>
  );
}
