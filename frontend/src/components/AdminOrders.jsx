// Admin xem đơn và đóng vai hãng demo; dữ liệu được phân trang ở server.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { adminOrderService, apiMessage } from "../services/api.js";
import SubOrderCard from "./SubOrderCard.jsx";
import Pagination from "./Pagination.jsx";
import { Empty } from "./index.js";
import { money } from "../utils/format.js";
import { orderStatusFilters } from "../utils/orders.js";
export default function AdminOrders({ shipping = false, services }) {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 0 });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(page = 1) {
    setBusy(true);
    setError("");
    try {
      const params = { page, ...(status ? { status } : {}) };
      const result = shipping
        ? await adminOrderService.shipments({ page, status: "shipping" })
        : await adminOrderService.list(params);
      setData(result);
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [shipping, status]);
  return (
    <div className="order-list">
      {shipping ? (
        <p className="info-box">
          Đây là luồng mô phỏng đơn vị vận chuyển. Chỉ đơn đang giao xuất hiện;
          admin có thể cập nhật thành đã giao hoặc hoàn hàng.
        </p>
      ) : (
        <label className="order-filter admin-order-filter">
          Trạng thái đơn
          <select
            value={status}
            disabled={busy}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả</option>
            {orderStatusFilters.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="danger-text">
          {error} <button onClick={() => load(data.page)}>Thử lại</button>
        </p>
      )}
      {busy && <p role="status">Đang tải đơn…</p>}
      <p>
        {data.total} {shipping ? "đơn con đang giao" : "đơn hàng"}
      </p>
      {data.items.map((item) =>
        shipping ? (
          <SubOrderCard
            key={item._id}
            sub={item}
            mode="admin"
            services={services}
            onChanged={() => load(data.page)}
          />
        ) : (
          <article className="order-card" key={item._id}>
            <div className="order-heading">
              <Link to={`/don-hang/${item._id}`}>
                Đơn #{item._id.slice(-8)} · {item.receiverName}
              </Link>
              <strong>{money(item.total)}</strong>
            </div>
            {item.subOrders.map((sub) => (
              <SubOrderCard
                key={sub._id}
                sub={sub}
                mode="admin"
                services={services}
                onChanged={() => load(data.page)}
              />
            ))}
          </article>
        ),
      )}
      {!busy && !error && !data.items.length && (
        <Empty
          title={shipping ? "Không có đơn đang giao" : "Chưa có đơn hàng"}
          description="Dữ liệu đơn hàng được lưu tại server."
          action={null}
        />
      )}
      <Pagination data={data} onPage={load} busy={busy} />
    </div>
  );
}
