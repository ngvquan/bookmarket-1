// Form xác thực qua API; hiện lỗi server, không lưu mật khẩu.
import { useState } from "react";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { Modal } from "./index.js";
import { trimRequired } from "../utils/validation.js";
export default function Auth({
  onClose,
  admin = false,
  seller = false,
  initialRegister = false,
  onSubmit,
}) {
  const [register, setRegister] = useState(initialRegister);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={seller ? "KÊNH NGƯỜI BÁN BOOKMARKET" : "TÀI KHOẢN BOOKMARKET"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!trimRequired(event)) {
            return;
          }
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await onSubmit({
              name: data.get("name")?.trim() || data.get("email").split("@")[0],
              email: data.get("email"),
              password: data.get("password"),
              register,
              admin,
            });
          } catch (error) {
            setError(error.message || "Không thể đăng nhập. Vui lòng thử lại.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="auth-icon">
          <BookOpen size={34} strokeWidth={1.2} />
        </div>
        <h2>
          {admin
            ? "Đăng nhập quản trị."
            : seller
              ? register
                ? "Đăng ký để bán sách"
                : "Đăng nhập kênh người bán"
              : register
                ? "Tạo tài khoản BookMarket"
                : "Đăng nhập tài khoản"}
        </h2>
        <p>
          {seller
            ? "Dùng tài khoản BookMarket của bạn. Sau bước tài khoản, hãy hoàn tất hồ sơ riêng để đăng ký gian hàng."
            : "Mua sách, theo dõi đơn hàng và quản lý thư viện của bạn."}
        </p>
        {register && !admin && (
          <label>
            Tên của bạn
            <input
              name="name"
              required
              placeholder="Mọi người gọi bạn là..."
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            placeholder="ban@email.com"
            autoComplete="email"
          />
        </label>
        <label>
          Mật khẩu
          <input
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={72}
            placeholder="Ít nhất 6 ký tự"
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {error && (
          <p role="alert" className="danger-text">
            {error}
          </p>
        )}
        <button disabled={busy} className="button button-dark full-width">
          {admin
            ? "Đăng nhập quản trị"
            : register
              ? "Tạo tài khoản"
              : "Đăng nhập"}
          <ArrowUpRight size={17} />
        </button>
        {!admin && (
          <p className="auth-switch">
            {register ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <button type="button" onClick={() => setRegister(!register)}>
              {register ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </p>
        )}
      </form>
    </Modal>
  );
}
