// Snapshot và timeline một seller; mọi nút đều chờ kết quả API.
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  orderService,
  shopOrderService,
  adminOrderService,
  apiMessage,
} from "../services/api.js";
import { Status } from "./index.js";
import { money } from "../utils/format.js";
import { orderStatuses, statusTone } from "../utils/orders.js";
import Modal from "./Modal.jsx";
import BookReviews from "./BookReviews.jsx";

export default function SubOrderCard({
  sub,
  profile,
  mode = "buyer",
  onChanged,
  services = [],
  detail = false,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState(null);
  const service = services.find((item) => item.id === sub.shipment.service);
  const parent = typeof sub.orderId === "object" ? sub.orderId : null;
  const orderId = parent?._id || sub.orderId;
  const canCancel =
    mode === "buyer"
      ? sub.status === "pending"
      : mode === "seller" && ["pending", "confirmed"].includes(sub.status);
  async function act(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (action === "cancel") await orderService.cancel(sub._id, reason);
      if (action === "confirm") await shopOrderService.confirm(sub._id);
      if (action === "ship") await shopOrderService.ship(sub._id);
      if (action === "received") await orderService.received(sub._id);
      if (action === "delivered" || action === "returned")
        await adminOrderService.shipping(sub._id, action, note);
      setCancelOpen(false);
      await onChanged();
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sub-order" aria-label={`Đơn của ${sub.shopName}`}>
      <div className="order-heading">
        <strong>{sub.shopName}</strong>
        <Status tone={statusTone(sub.status)}>
          {orderStatuses[sub.status]}
        </Status>
      </div>
      {!detail && (
        <Link
          className="text-link"
          to={
            mode === "seller"
              ? `/nguoi-ban/don-hang/${orderId}`
              : `/don-hang/${orderId}`
          }
        >
          Chi tiết đơn #{String(orderId).slice(-8)}
        </Link>
      )}
      {parent && (
        <p className="receiver-info">
          {parent.receiverName} · {parent.receiverPhone}
          <br />
          {parent.receiverAddress}
        </p>
      )}
      {sub.items.map((item) => (
        <div className="order-item" key={item.listingId}>
          <div className="snapshot-book">
            <strong>{item.title}</strong>
            <span>
              {item.author} · {item.isbn || "Không ISBN"}
            </span>
            <small>Số lượng: {item.quantity}</small>
            {mode === "buyer" &&
              profile?.role !== "admin" &&
              sub.status === "completed" && (
                <button
                  type="button"
                  className="button button-outline button-small review-order-button"
                  onClick={() => setReviewItem(item)}
                >
                  Đánh giá sách
                </button>
              )}
          </div>
          <strong>{money(item.price * item.quantity)}</strong>
        </div>
      ))}
      <div className="order-footer">
        <span>
          Tiền sách {money(sub.itemsTotal)} · Giao {money(sub.shippingFee)}
        </span>
        <strong>{money(sub.itemsTotal + sub.shippingFee)}</strong>
      </div>
      <p>
        {service?.name || sub.shipment.service} · Mã vận đơn:{" "}
        <strong>{sub.shipment.trackingCode || "Chưa cấp"}</strong>
      </p>
      {sub.cancelReason && (
        <p className="danger-text">Lý do hủy: {sub.cancelReason}</p>
      )}
      {detail && (
        <ol className="shipment-timeline" aria-label="Lịch sử vận chuyển">
          {sub.shipment.events.map((event, index) => (
            <li key={index}>
              <strong>{orderStatuses[event.status]}</strong>
              <time>{new Date(event.at).toLocaleString("vi-VN")}</time>
              <span>{event.note}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="order-actions">
        {mode === "seller" && sub.status === "pending" && (
          <button
            disabled={busy}
            className="button button-dark button-small"
            onClick={() => act("confirm")}
          >
            Xác nhận
          </button>
        )}
        {mode === "seller" && sub.status === "confirmed" && (
          <button
            disabled={busy}
            className="button button-dark button-small"
            onClick={() => act("ship")}
          >
            Giao cho hãng
          </button>
        )}
        {mode === "buyer" && sub.status === "delivered" && (
          <button
            disabled={busy}
            className="button button-dark button-small"
            onClick={() => act("received")}
          >
            Đã nhận hàng
          </button>
        )}
        {canCancel && (
          <button
            disabled={busy}
            className="button button-outline button-small"
            onClick={() => setCancelOpen(!cancelOpen)}
          >
            Hủy đơn
          </button>
        )}
      </div>
      {cancelOpen && (
        <form
          className="form-stack cancel-form"
          onSubmit={(event) => {
            event.preventDefault();
            act("cancel");
          }}
        >
          <label>
            Lý do hủy{mode === "buyer" && " (tùy chọn)"}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              required={mode === "seller"}
            />
          </label>
          <button disabled={busy} className="button button-dark button-small">
            Xác nhận hủy
          </button>
        </form>
      )}
      {mode === "admin" &&
        ["shipping", "delivered", "completed"].includes(sub.status) && (
          <div className="form-stack shipping-demo-actions">
            <label>
              Ghi chú vận chuyển
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
              />
            </label>
            <div className="order-actions">
              {sub.status === "shipping" && (
                <button
                  disabled={busy}
                  className="button button-dark button-small"
                  onClick={() => act("delivered")}
                >
                  Giao thành công
                </button>
              )}
              <button
                disabled={busy}
                className="button button-outline button-small"
                onClick={() => act("returned")}
              >
                Hoàn hàng
              </button>
            </div>
          </div>
        )}
      {busy && <p role="status">Đang cập nhật đơn…</p>}
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      {reviewItem && sub.status === "completed" && (
        <Modal title="ĐÁNH GIÁ SÁCH" onClose={() => setReviewItem(null)}>
          <div className="review-modal-content">
            <h2>{reviewItem.title}</h2>
            <p>{sub.shopName}</p>
            <BookReviews
              key={`${reviewItem.listingId}:${profile?.id}`}
              listingId={reviewItem.listingId}
              profile={profile}
            />
          </div>
        </Modal>
      )}
    </section>
  );
}
