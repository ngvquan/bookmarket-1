import { Bell, CheckCheck } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageTitle from "../components/PageTitle.jsx";
import { Empty } from "../components/index.js";

export default function NotificationsPage({ notifications }) {
  const navigate = useNavigate();
  useEffect(() => {
    notifications.refresh();
  }, []);
  async function open(item) {
    if (!item.readAt) await notifications.read(item.id).catch(() => {});
    navigate(
      item.status === "pending"
        ? `/nguoi-ban/don-hang/${item.orderId}`
        : `/don-hang/${item.orderId}`,
    );
  }
  return (
    <div className="shell page-content notifications-page">
      <PageTitle
        eyebrow="CẬP NHẬT ĐƠN HÀNG"
        title="Thông báo"
        description="Các thay đổi mới nhất của đơn mua và đơn bán đều được lưu tại đây."
      />
      <div className="notification-toolbar">
        <span>{notifications.unread} thông báo chưa đọc</span>
        {notifications.unread > 0 && (
          <button
            className="button button-outline button-small"
            onClick={() => notifications.readAll()}
          >
            <CheckCheck size={15} />
            Đánh dấu đã đọc
          </button>
        )}
      </div>
      {notifications.loading && <p role="status">Đang tải thông báo…</p>}
      {notifications.error && (
        <p role="alert" className="danger-text">
          {notifications.error}{" "}
          <button onClick={() => notifications.refresh()}>Thử lại</button>
        </p>
      )}
      {notifications.items.length ? (
        <div className="notification-list">
          {notifications.items.map((item) => (
            <button
              key={item.id}
              className={item.readAt ? "" : "unread"}
              onClick={() => open(item)}
            >
              <Bell size={18} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.message}</small>
                <time>{new Date(item.createdAt).toLocaleString("vi-VN")}</time>
              </span>
            </button>
          ))}
        </div>
      ) : (
        !notifications.loading &&
        !notifications.error && (
          <Empty
            icon={Bell}
            title="Chưa có thông báo"
            description="Khi đơn hàng thay đổi trạng thái, thông báo sẽ xuất hiện tại đây."
            action={null}
          />
        )
      )}
    </div>
  );
}
