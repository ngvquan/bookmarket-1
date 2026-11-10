// Modal này hiển thị giỏ hàng đã nhóm theo từng người bán.
import { ArrowRight, ShoppingBag } from "lucide-react";
import { money } from "../utils/format.js";
import CartGroups from "./CartGroups.jsx";
import { Empty, Modal } from "./index.js";

export default function CartModal({
  cartItems,
  setCart,
  setCartOpen,
  cartGroups,
  updateQuantity,
  total,
  physical,
  shippingServices,
  shippingError,
  shippingTotal,
  loadShipping,
  cartCount,
  requireProfile,
  setCheckout,
}) {
  return (
    <Modal
      title={`GIỎ SÁCH CỦA BẠN (${cartItems.length})`}
      className="cart-modal"
      onClose={() => setCartOpen(false)}
    >
      {cartItems.length ? (
        <>
          <CartGroups
            groups={cartGroups}
            updateQuantity={updateQuantity}
            onRemove={(id) =>
              setCart((old) => old.filter((item) => item.id !== id))
            }
            onClose={() => setCartOpen(false)}
          />
          <div className="cart-totals">
            <span>
              Tạm tính<strong>{money(total)}</strong>
            </span>
            <span>
              Phí giao hàng (
              {cartGroups.filter((group) => group.shipping > 0).length} nhà bán)
              <strong>
                {physical && (!shippingServices.length || shippingError)
                  ? "Chưa tải được"
                  : shippingTotal
                    ? money(shippingTotal)
                    : "Miễn phí"}
              </strong>
            </span>
            <div>
              <span>Tổng cộng</span>
              <strong>{money(total + shippingTotal)}</strong>
            </div>
          </div>
          {physical && shippingError && (
            <p role="alert">
              {shippingError}{" "}
              <button onClick={loadShipping}>Thử lại phí giao</button>
            </p>
          )}
          <button
            className="button button-dark full-width"
            disabled={
              cartCount === 0 ||
              (physical && (!shippingServices.length || !!shippingError))
            }
            onClick={() => {
              requireProfile(() => {
                setCheckout(true);
                setCartOpen(false);
              });
            }}
          >
            Tiến hành đặt hàng
            <ArrowRight size={17} />
          </button>
          <p className="fine-print">
            Sách mới/cũ thanh toán khi nhận. Ebook chuyển khoản qua VietQR.
          </p>
        </>
      ) : (
        <Empty
          icon={ShoppingBag}
          title="Giỏ sách còn trống"
          description="Có một câu chuyện đang đợi bạn ở ngoài kia."
          action={null}
        />
      )}
    </Modal>
  );
}
