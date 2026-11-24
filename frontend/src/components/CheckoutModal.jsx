// Modal này thu địa chỉ, dịch vụ giao hàng và xác nhận đặt đơn.
import { useEffect, useState } from "react";
import { BookOpen, Check } from "lucide-react";
import { apiMessage, voucherService } from "../services/api.js";
import { money } from "../utils/format.js";
import CheckoutAddressFields from "./CheckoutAddressFields.jsx";
import { Modal } from "./index.js";

export default function CheckoutModal({
  setCheckout,
  placeOrder,
  physical,
  profile,
  cartGroups,
  selectedServices,
  setSelectedServices,
  shippingServices,
  checkoutItems,
  shippingTotal,
  checkoutTotal,
  checkoutError,
  submitting,
  refreshCart,
  setCartOpen,
  notify,
}) {
  const [vouchers, setVouchers] = useState([]);
  const [voucherId, setVoucherId] = useState("");
  const [quote, setQuote] = useState(null);
  const [voucherError, setVoucherError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const channel = physical ? "physical" : "digital";
  const items = checkoutItems.map((item) => ({ listingId: item.id, quantity: item.quantity }));
  const itemKey = JSON.stringify(items);
  const sellerIds = new Set(checkoutItems.map((item) => item.book.sellerId));
  const available = vouchers.filter((voucher) =>
    voucher.status === "active" && new Date(voucher.expiresAt) > new Date() &&
    sellerIds.has(voucher.sellerId?._id || voucher.sellerId));

  useEffect(() => {
    let cancelled = false;
    if (profile?.role === "admin") return;
    voucherService.mine().then((data) => {
      if (!cancelled) setVouchers(data.items || []);
    }).catch((error) => {
      if (!cancelled) setVoucherError(apiMessage(error));
    });
    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => {
    let cancelled = false;
    setQuote(null);
    setVoucherError("");
    setQuoting(false);
    if (!voucherId) return;
    setQuoting(true);
    voucherService.quote({ voucherId, channel, items: JSON.parse(itemKey) })
      .then((data) => { if (!cancelled) setQuote(data); })
      .catch((error) => { if (!cancelled) setVoucherError(apiMessage(error)); })
      .finally(() => { if (!cancelled) setQuoting(false); });
    return () => { cancelled = true; };
  }, [voucherId, channel, itemKey]);

  return (
    <Modal
      title="THÊM MỘT CUỐN SÁCH, THÊM MỘT NIỀM VUI"
      onClose={() => setCheckout(false)}
    >
      <form className="form-stack" onSubmit={placeOrder}>
        <h2>Hẹn sách về nhà.</h2>
        {physical ? (
          <CheckoutAddressFields profile={profile} />
        ) : (
          <p className="info-box">
            <BookOpen size={20} />
            Đơn hàng chỉ có ebook nên không cần địa chỉ. Sách sẽ có ngay trong
            thư viện sau thanh toán.
          </p>
        )}
        {cartGroups
          .filter((group) => group.hasPhysical)
          .map((group) => (
            <label key={group.id}>
              Dịch vụ giao · {group.name}
              <select
                aria-label={`Dịch vụ giao ${group.name}`}
                value={selectedServices[group.id] || "standard"}
                onChange={(event) =>
                  setSelectedServices((old) => ({
                    ...old,
                    [group.id]: event.target.value,
                  }))
                }
              >
                {shippingServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {money(service.fee)} · {service.days}
                  </option>
                ))}
              </select>
            </label>
          ))}
        <label>
          Voucher từ người bán
          <select name="voucherId" value={voucherId} onChange={(event) => setVoucherId(event.target.value)}>
            <option value="">Không dùng voucher</option>
            {available.map((voucher) => (
              <option key={voucher._id} value={voucher._id}>
                {voucher.code} · {voucher.sellerId?.name || "Người bán"} · {voucher.kind === "percent" ? `${voucher.value}%` : money(voucher.value)}
              </option>
            ))}
          </select>
        </label>
        {quoting && <p role="status">Đang kiểm tra voucher…</p>}
        {voucherError && <p role="alert" className="danger-text">{voucherError}</p>}
        <div className="checkout-summary">
          {checkoutItems.map((item) => (
            <span key={item.id}>
              {item.book.title} × {item.quantity}
              <strong>{money(item.book.price * item.quantity)}</strong>
            </span>
          ))}
          {physical && (
            <span>
              Phí vận chuyển theo nhà bán
              <strong>{money(shippingTotal)}</strong>
            </span>
          )}
          {!!quote?.discount && (
            <span>
              Giảm giá · {quote.code}
              <strong>-{money(quote.discount)}</strong>
            </span>
          )}
          <div>
            Tổng thanh toán
            <strong>{money(Math.max(0, checkoutTotal + shippingTotal - (quote?.discount || 0)))}</strong>
          </div>
        </div>
        {checkoutError && (
          <div role="alert" className="danger-text">
            <p>{checkoutError}</p>
            <button
              type="button"
              className="button button-outline button-small"
              disabled={submitting}
              onClick={async () => {
                try {
                  await refreshCart();
                  setCheckout(false);
                  setCartOpen(true);
                } catch (error) {
                  notify(apiMessage(error));
                }
              }}
            >
              Cập nhật lại giỏ
            </button>
          </div>
        )}
        <button
          className="button button-dark full-width"
          type="submit"
          disabled={submitting || (voucherId && (!quote || quoting))}
        >
          {submitting
            ? "Đang đặt hàng…"
            : physical
              ? "Xác nhận đặt hàng (COD)"
              : "Thanh toán ebook bằng VietQR"}
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
