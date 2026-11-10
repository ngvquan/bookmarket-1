// Chặn trang dựa trên /auth/me; API kiểm tra quyền độc lập với giao diện.
import { Empty } from "./index.js";
export default function AccessGate({
  profile,
  admin = false,
  onLogin,
  children,
}) {
  if (!profile) {
    return (
      <div className="shell empty-state">
        <h1>Đăng nhập để tiếp tục</h1>
        <p>Trang này cần tài khoản đã được xác thực.</p>
        <button className="button button-dark" onClick={onLogin}>
          {admin ? "Đăng nhập quản trị" : "Đăng nhập"}
        </button>
      </div>
    );
  }
  if (admin && profile.role !== "admin") {
    return (
      <div className="shell page-content">
        <Empty
          title="Bạn không có quyền truy cập"
          description="Chỉ quản trị viên được truy cập khu vực này."
          to="/"
          action="Về trang chủ"
        />
        <button className="button button-dark" onClick={onLogin}>
          Đăng nhập quản trị
        </button>
      </div>
    );
  }
  if (!admin && profile.role === "admin") {
    return (
      <div className="shell page-content">
        <Empty
          title="Tài khoản quản trị"
          description="Chức năng này dành cho tài khoản người dùng. Bạn có thể quay về trang quản trị."
          to="/quan-tri"
          action="Về quản trị"
        />
      </div>
    );
  }
  return children;
}
