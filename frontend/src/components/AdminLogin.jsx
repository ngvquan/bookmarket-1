import { useState } from "react";
import { LockKeyhole } from "lucide-react";

export default function AdminLogin({ onSubmit }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-brand">BookMarket Quản trị</div>
        <div className="admin-login-icon" aria-hidden="true">
          <LockKeyhole size={28} strokeWidth={1.7} />
        </div>
        <h1 id="admin-login-title">Đăng nhập quản trị</h1>
        <form
          className="admin-login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              await onSubmit({
                email: String(data.get("username") || "").trim(),
                password: String(data.get("password") || ""),
                admin: true,
                register: false,
              });
            } catch (error) {
              setError(error.message || "Không thể đăng nhập. Vui lòng thử lại.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Tài khoản
            <input
              name="username"
              required
              autoFocus
              autoComplete="username"
              placeholder="admin"
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
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
            />
          </label>
          {error && (
            <p className="admin-login-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-dark" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </section>
    </main>
  );
}
