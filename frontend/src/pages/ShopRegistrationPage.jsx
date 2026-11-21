import { useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Store, ArrowLeft, ArrowRight, Check } from "lucide-react";
import ShopFields, {
  shopDraft,
  shopPayload,
} from "../components/ShopFields.jsx";
import { apiMessage } from "../services/api.js";

const steps = [
  "Thông tin gian hàng",
  "Liên hệ và địa chỉ",
  "Kiểm tra và xác nhận",
];

export default function ShopRegistrationPage({ profile, shop, onRegister }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => shopDraft(null, profile));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  const heading = useRef(null);
  const changeStep = (value) => {
    setStep(value);
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  };
  const onChange = (name, value) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setConfirmed(false);
    setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    if (step < 2) {
      changeStep(step + 1);
      return;
    }
    if (sending.current || !confirmed) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await onRegister({ ...shopPayload(draft), registrationConfirmed: true });
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (shop)
    return (
      <Navigate
        to={shop.isRegistrationComplete ? "/nguoi-ban" : "/nguoi-ban/gian-hang"}
        replace
        state={
          shop.isRegistrationComplete ? { shopReady: shop.name } : undefined
        }
      />
    );

  return (
    <div className="shop-registration-page">
      <div className="shop-registration-title">
        <span className="eyebrow">BẮT ĐẦU BÁN SÁCH TRÊN BOOKMARKET</span>
        <h1>Đăng ký rạp sách</h1>
        <p>
          Điền hồ sơ rạp sách của bạn. Sau khi xác nhận thành công, bạn sẽ được
          chuyển vào giao diện quản lý người bán.
        </p>
      </div>
      <ol
        className="shop-registration-steps"
        aria-label="Các bước đăng ký gian hàng"
      >
        {steps.map((label, index) => (
          <li
            key={label}
            className={index === step ? "current" : index < step ? "done" : ""}
            aria-current={index === step ? "step" : undefined}
          >
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      <div className="shop-registration-layout">
        <form className="shop-registration-card" onSubmit={submit}>
          <div className="shop-registration-card-heading">
            <small>BƯỚC {step + 1} / 3</small>
            <h2 ref={heading} tabIndex={-1}>
              {steps[step]}
            </h2>
            <p>
              {step === 0
                ? "Cho người mua biết shop của bạn có gì đặc biệt."
                : step === 1
                  ? "Điền thông tin người phụ trách và địa chỉ shop dùng để gửi, nhận trả sách."
                  : "Kiểm tra hồ sơ trước khi tạo gian hàng. Bạn có thể quay lại để sửa."}
            </p>
          </div>
          {step < 2 ? (
            <ShopFields
              section={step === 0 ? "shop" : "contact"}
              draft={draft}
              onChange={onChange}
              disabled={busy}
            />
          ) : (
            <>
              <dl className="shop-registration-review">
                {[
                  ["Tên gian hàng", draft.name],
                  ["Giới thiệu", draft.description],
                  ["Người liên hệ", draft.contactName],
                  ["Số điện thoại", draft.contactPhone],
                  ["Email liên hệ", draft.contactEmail],
                  [
                    "Địa chỉ lấy / trả sách",
                    [draft.detail, draft.ward, draft.province].join(", "),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <label className="shop-registration-confirm">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  disabled={busy}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  Tôi xác nhận thông tin chính xác và sẽ mô tả trung thực các
                  sách đăng bán.
                </span>
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="shop-registration-error">
              {error}
            </p>
          )}
          <div className="shop-registration-actions">
            {step > 0 ? (
              <button
                className="button button-outline"
                type="button"
                disabled={busy}
                onClick={() => changeStep(step - 1)}
              >
                <ArrowLeft size={15} />
                Quay lại
              </button>
            ) : (
              <Link className="text-link" to="/">
                Để sau
              </Link>
            )}
            <button
              className="button button-dark"
              disabled={busy || (step === 2 && !confirmed)}
              type="submit"
            >
              {busy
                ? "Đang đăng ký…"
                : step === 2
                  ? "Xác nhận đăng ký rạp sách"
                  : "Tiếp tục"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
        <aside className="shop-registration-note">
          <Store size={28} strokeWidth={1.5} />
          <h2>Một nơi dành riêng cho shop của bạn</h2>
          <ul>
            <li>Đăng bán sách mới, sách cũ và ebook.</li>
            <li>Quản lý tồn kho, đơn bán và doanh thu.</li>
            <li>Chat với người mua ngay trong kênh người bán.</li>
          </ul>
          <p>
            Thông tin shop được lưu sau khi bạn xác nhận bước cuối. Tài khoản
            đang dùng: <strong>{profile.email}</strong>
          </p>
        </aside>
      </div>
    </div>
  );
}
