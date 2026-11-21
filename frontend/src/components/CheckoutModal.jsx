// Modal này thu địa chỉ, dịch vụ giao hàng và xác nhận đặt đơn.
import { BookOpen, Check } from "lucide-react";
import { apiMessage } from "../services/api.js";
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
          <div>
            Tổng thanh toán
            <strong>{money(checkoutTotal + shippingTotal)}</strong>
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
          disabled={submitting}
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
