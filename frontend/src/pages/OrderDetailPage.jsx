// Chi tiết đơn dùng snapshot và timeline; server lọc đơn con theo người xem.
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { orderService, apiMessage } from "../services/api.js";
import PageTitle from "../components/PageTitle.jsx";
import SubOrderCard from "../components/SubOrderCard.jsx";
import { money } from "../utils/format.js";
export default function OrderDetailPage({ profile, services, seller = false }) {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = await orderService.get(id);
      if (seller) {
        result.subOrders = result.subOrders.filter(
          (sub) => sub.sellerId === profile.id,
        );
        if (!result.subOrders.length)
          throw new Error("Bạn không phải người bán của đơn này.");
      }
      setOrder(result);
    } catch (error) {
      setOrder(null);
      setError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);
  return (
    <div className="shell page-content">
      <PageTitle
        eyebrow={seller ? "KÊNH NGƯỜI BÁN" : "THEO DÕI HÀNH TRÌNH"}
        title={seller ? "Chi tiết đơn bán" : "Chi tiết đơn hàng"}
        description="Theo dõi thông tin và trạng thái giao hàng của đơn."
      />
      <Link
        className="text-link"
        to={
          seller
            ? "/nguoi-ban/don-hang"
            : profile.role === "admin"
              ? "/quan-tri"
              : "/don-hang"
        }
      >
        Quay lại danh sách
      </Link>
      {busy && <p role="status">Đang tải đơn…</p>}
      {error && (
        <p role="alert" className="danger-text">
          {error} <button onClick={load}>Thử lại</button>
        </p>
      )}
      {order && (
        <>
          <div className="receiver-info">
            <h2>Đơn #{order._id.slice(-8)}</h2>
            <p>
              {order.receiverName} · {order.receiverPhone}
            </p>
            <p>{order.receiverAddress}</p>
            {!seller && order.total !== undefined && (
              <p>
                Tổng lúc đặt: <strong>{money(order.total)}</strong> · COD
              </p>
            )}
          </div>
          <div className="order-list">
            {order.subOrders.map((sub) => (
              <SubOrderCard
                key={sub._id}
                sub={sub}
                profile={profile}
                detail
                services={services}
                mode={
                  seller
                    ? "seller"
                    : profile.role === "admin"
                      ? "admin"
                      : order.buyerId === profile.id
                        ? "buyer"
                        : "seller"
                }
                onChanged={load}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
