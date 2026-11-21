// Lọc/phân trang tại server; Nhận hàng gộp đơn đang giao và đã hoàn thành.
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { orderService, apiMessage } from "../services/api.js";
import { Empty } from "../components/index.js";
import { money } from "../utils/format.js";
import PageTitle from "../components/PageTitle.jsx";
import Pagination from "../components/Pagination.jsx";
import SubOrderCard from "../components/SubOrderCard.jsx";
import { buyerOrderTabs } from "../utils/orders.js";
import DigitalOrders, {
  digitalTabCount,
} from "../components/DigitalOrders.jsx";
export default function OrdersPage({ profile, onPay, services }) {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") || "pending";
  const tab = buyerOrderTabs.some(([key]) => key === requestedTab)
    ? requestedTab
    : "pending";
  const requestedPage = Number(params.get("page") || 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState({
    items: [],
    page: 1,
    pages: 0,
    total: 0,
    counts: {},
  });
  const [revision, setRevision] = useState(0);
  const [digitalCounts, setDigitalCounts] = useState({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const refresh = () => setRevision((value) => value + 1);
  // Liên kết Hoàn thành cũ chuyển sang mục đã gộp.
  useEffect(() => {
    if (requestedTab === "completed")
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("tab", "to-receive");
          next.delete("page");
          return next;
        },
        { replace: true },
      );
  }, [requestedTab, setParams]);
  useEffect(() => {
    let active = true;
    let requesting = false;
    setBusy(true);
    setError("");
    async function load() {
      if (requesting) return;
      requesting = true;
      try {
        const result = await orderService.mine({ page, tab });
        if (!active) return;
        // Đổi trạng thái có thể làm trang cuối hết đơn; quay về trang hợp lệ.
        if (page > Math.max(result.pages, 1)) {
          selectPage(Math.max(result.pages, 1), true);
          return;
        }
        setData({ ...result, tab });
        setError("");
      } catch (error) {
        if (active) setError(apiMessage(error));
      } finally {
        requesting = false;
        if (active) setBusy(false);
      }
    }
    load();
    // Đơn thay đổi ở tài khoản khác cũng tự cập nhật; không gửi request chồng nhau.
    const reload = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = window.setInterval(reload, 5000);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [page, tab, revision]);
  function selectTab(key) {
    const next = new URLSearchParams();
    if (key !== "pending") next.set("tab", key);
    setParams(next);
  }
  function selectPage(number, replace = false) {
    const next = new URLSearchParams(params);
    number > 1 ? next.set("page", number) : next.delete("page");
    setParams(next, { replace });
  }
  const items =
    !error && data.tab === tab && data.page === page ? data.items : [];
  const ebookCount = digitalTabCount(digitalCounts, tab);
  const count = (key) =>
    (data.counts?.[key] || 0) + digitalTabCount(digitalCounts, key);
  return (
    <div className="shell page-content buyer-orders-page">
      <PageTitle
        eyebrow="ĐƠN HÀNG CỦA BẠN"
        title="Đơn hàng của tôi"
        description="Theo dõi trạng thái và quản lý các đơn hàng của bạn."
      />
      <nav className="buyer-order-tabs" aria-label="Trạng thái đơn hàng">
        {buyerOrderTabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "active" : ""}
            aria-pressed={tab === key}
            onClick={() => selectTab(key)}
          >
            {label}
            {count(key) > 0 && (
              <span className="order-tab-count">{count(key)}</span>
            )}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="danger-text">
          {error} <button onClick={refresh}>Thử lại</button>
        </p>
      )}
      {busy && <p role="status">Đang tải đơn…</p>}
      <div className="order-list">
        {items.map((order) => {
          // Khi lọc đơn nhiều shop, chỉ cộng các phần đơn đang hiển thị.
          const visibleTotal = order.subOrders.reduce(
            (sum, sub) => sum + sub.itemsTotal + sub.shippingFee,
            0,
          );
          return (
            <article className="order-card" key={order._id}>
              <div className="order-heading">
                <Link to={`/don-hang/${order._id}`}>
                  <strong>Đơn #{order._id.slice(-8)}</strong>
                </Link>
                <span>{new Date(order.createdAt).toLocaleString("vi-VN")}</span>
              </div>
              {order.subOrders.map((sub) => (
                <SubOrderCard
                  key={sub._id}
                  sub={sub}
                  profile={profile}
                  services={services}
                  onChanged={refresh}
                />
              ))}
              <div className="order-footer">
                <span>
                  Giao đến: {order.receiverAddress}
                  <small>COD · Tổng các phần đơn trong mục này</small>
                </span>
                <strong>{money(visibleTotal)}</strong>
              </div>
            </article>
          );
        })}
      </div>
      {data.tab === tab && (
        <Pagination data={data} onPage={selectPage} busy={busy} />
      )}
      <DigitalOrders tab={tab} onPay={onPay} onCounts={setDigitalCounts} />
      {!busy && !error && !items.length && !ebookCount && (
        <Empty
          title="Chưa có đơn hàng trong mục này"
          description="Đơn hàng sẽ xuất hiện ở đây khi chuyển đến trạng thái tương ứng."
          to="/mua-sach"
          action="Tiếp tục mua sách"
        />
      )}
    </div>
  );
}
