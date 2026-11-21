import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { digitalOrderService, apiMessage } from "../services/api.js";
import { money } from "../utils/format.js";
import Pagination from "./Pagination.jsx";
export const digitalStatuses = {
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  cancelled: "Đã hủy",
  expired: "Hết hạn",
};
export function digitalTabCount(counts, tab) {
  return tab === "all"
    ? counts.all || 0
    : tab === "pending"
      ? counts.pending_payment || 0
      : tab === "to-receive"
        ? counts.paid || 0
        : tab === "cancelled"
          ? (counts.cancelled || 0) + (counts.expired || 0)
          : 0;
}
export default function DigitalOrders({ tab, onPay, onCounts }) {
  const [page, setPage] = useState(1),
    [data, setData] = useState({ items: [], pages: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    setPage(1);
  }, [tab]);
  useEffect(() => {
    let active = true,
      requesting = false;
    async function load() {
      if (requesting) return;
      requesting = true;
      try {
        const result = await digitalOrderService.mine({ page, tab });
        if (!active) return;
        if (page > Math.max(1, result.pages)) {
          setPage(Math.max(1, result.pages));
          return;
        }
        setData({ ...result, tab });
        onCounts(result.counts);
        setError("");
      } catch (error) {
        if (active) setError(apiMessage(error));
      } finally {
        requesting = false;
      }
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [page, tab, onCounts]);
  return (
    <div className="digital-orders">
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      {data.tab === tab &&
        data.items.map((order) => (
          <article className="order-card digital-order-card" key={order._id}>
            <div className="order-heading">
              <strong>Ebook · #{order._id.slice(-8)}</strong>
              <span>{digitalStatuses[order.status]}</span>
            </div>
            {order.items.map((item) => (
              <div className="order-item" key={item.listingId}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.author}</p>
                </div>
                <strong>{money(item.price)}</strong>
              </div>
            ))}
            <div className="order-footer">
              <span>
                Mã chuyển khoản: <strong>{order.transferCode}</strong>
              </span>
              <strong>{money(order.total)}</strong>
            </div>
            {order.status === "pending_payment" && (
              <button
                className="button button-dark button-small"
                onClick={() => onPay(order)}
              >
                Thanh toán ebook
              </button>
            )}
            {order.status === "paid" && (
              <Link
                className="button button-outline button-small"
                to="/thu-vien"
              >
                Mở thư viện
              </Link>
            )}
          </article>
        ))}
      {data.tab === tab && <Pagination data={data} onPage={setPage} />}
    </div>
  );
}
