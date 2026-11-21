import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { digitalOrderService, apiMessage } from "../services/api.js";
import { money } from "../utils/format.js";
export default function PaymentModal({ order, onClose, onPaid }) {
  const [status, setStatus] = useState(order.status);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const paidCallback = useRef(onPaid);
  paidCallback.current = onPaid;
  useEffect(() => {
    let active = true,
      requesting = false,
      finished = false;
    const clock = () =>
      setRemaining(
        Math.max(0, Math.ceil((new Date(order.expiresAt) - Date.now()) / 1000)),
      );
    async function check() {
      if (!active || requesting || finished) return;
      requesting = true;
      try {
        const result = await digitalOrderService.status(order._id);
        if (!active) return;
        setStatus(result.status);
        setError("");
        if (result.status === "paid") {
          finished = true;
          paidCallback.current(order);
        }
        if (result.status === "cancelled") finished = true;
      } catch (error) {
        if (active) setError(apiMessage(error));
      } finally {
        requesting = false;
      }
    }
    clock();
    check();
    const timer = setInterval(check, 3000),
      countdown = setInterval(clock, 1000);
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(countdown);
    };
  }, [order._id]);
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      await digitalOrderService.cancel(order._id);
      onClose();
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="THANH TOÁN EBOOK" onClose={onClose} className="payment-modal">
      <PaymentDetails
        order={order}
        expired={remaining === 0 || status === "expired"}
      />
      <div className="payment-actions">
        <p role="status">
          {status === "cancelled"
            ? "Đơn đã hủy"
            : remaining > 0
              ? `Còn ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} để thanh toán`
              : "Đã hết hạn QR. Nếu đã chuyển tiền, hãy chờ xác nhận hoặc liên hệ quản trị."}
        </p>
        {error && (
          <p role="alert" className="danger-text">
            {error}
          </p>
        )}
        {status === "pending_payment" && (
          <button
            className="button button-outline"
            disabled={busy}
            onClick={cancel}
          >
            Hủy thanh toán
          </button>
        )}
      </div>
    </Modal>
  );
}
function PaymentDetails({ order, expired }) {
  const [message, setMessage] = useState("");
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(order.transferCode);
      setMessage("Đã sao chép nội dung.");
    } catch {
      setMessage(
        "Không sao chép tự động được. Hãy chọn và sao chép mã bên dưới.",
      );
    }
  }
  return (
    <div className="payment-details">
      {!expired && (
        <img
          src={order.qrImageUrl}
          alt="Mã VietQR thanh toán ebook"
          referrerPolicy="no-referrer"
          onError={() =>
            setMessage(
              "Không tải được ảnh QR. Bạn có thể chuyển khoản thủ công theo thông tin bên dưới.",
            )
          }
        />
      )}
      <dl>
        <div>
          <dt>Ngân hàng</dt>
          <dd>{order.bank.name}</dd>
        </div>
        <div>
          <dt>Số tài khoản</dt>
          <dd>{order.bank.accountNo}</dd>
        </div>
        <div>
          <dt>Chủ tài khoản</dt>
          <dd>{order.bank.accountName}</dd>
        </div>
        <div>
          <dt>Số tiền</dt>
          <dd>
            <strong>{money(order.total)}</strong>
          </dd>
        </div>
        <div>
          <dt>Nội dung</dt>
          <dd>
            <strong className="transfer-code">{order.transferCode}</strong>
          </dd>
        </div>
      </dl>
      <p>
        Phải nhập đúng nội dung chuyển khoản và chuyển đủ số tiền. Hệ thống tự
        xác nhận khi nhận thông báo từ ngân hàng.
      </p>
      <button className="button button-outline" onClick={copyCode}>
        Sao chép nội dung
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
