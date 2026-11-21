// Seller đọc từng trang đơn con của mình, kể cả người bán sách cũ chưa có shop.
import { useState, useEffect } from "react";
import { shopOrderService, apiMessage } from "../services/api.js";
import { Empty } from "./index.js";
import Pagination from "./Pagination.jsx";
import SubOrderCard from "./SubOrderCard.jsx";
import { orderStatusFilters } from "../utils/orders.js";
export default function ShopOrders({ services }) {
  const [data, setData] = useState({ items: [], page: 1, pages: 0, total: 0 });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(page = 1) {
    setBusy(true);
    setError("");
    try {
      setData(await shopOrderService.list({ page, status }));
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load(1);
  }, [status]);
  return (
    <div className="order-list">
      <label className="order-filter">
        Trạng thái đơn
        <select
          value={status}
          disabled={busy}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Tất cả</option>
          {orderStatusFilters.map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="danger-text">
          {error} <button onClick={() => load(data.page)}>Thử lại</button>
        </p>
      )}
      {busy && <p role="status">Đang tải đơn…</p>}
      {data.items.map((sub) => (
        <SubOrderCard
          key={sub._id}
          sub={sub}
          mode="seller"
          services={services}
          onChanged={() => load(data.page)}
        />
      ))}
      {!busy && !error && !data.items.length && (
        <Empty
          title="Chưa có đơn cho gian hàng"
          description="Đơn sách giấy của bạn sẽ xuất hiện tại đây."
          action={null}
        />
      )}
      <Pagination data={data} onPage={load} busy={busy} />
    </div>
  );
}
