// Hook này xử lý kiểm tra giỏ, khôi phục request và tạo đơn hàng.
import { useEffect, useRef, useState } from "react";
import {
  apiMessage,
  digitalOrderService,
  listingService,
  orderService,
  profileService,
} from "../services/api.js";
import { pendingCheckout, newCheckoutKey } from "../utils/checkout.js";
import { isAvailable } from "../utils/marketplace.js";
import { trimRequired } from "../utils/validation.js";

export default function useCheckout({
  profile,
  setProfile,
  cart,
  setCart,
  cartItems,
  cartGroups,
  setBooks,
  rememberListings,
  selectedServices,
  shippingServices,
  shippingError,
  setCheckout,
  setCartOpen,
  setSuccess,
  notify,
  finishDigitalOrder,
  setPaymentOrder,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [pendingOrder, setPendingOrder] = useState(null);
  const posting = useRef(false);
  const attempt = useRef(null);

  function rememberAttempt(value) {
    attempt.current = value;
    setPendingOrder(value);
    pendingCheckout(profile.id, value);
  }

  useEffect(() => {
    attempt.current = profile ? pendingCheckout(profile.id) : null;
    setPendingOrder(attempt.current);
    setCheckoutError("");
  }, [profile?.id]);

  // Đọc lại kho/giá để người mua xử lý 409, giữ item ngừng bán để họ tự xóa.
  async function refreshCart() {
    const latest = [];
    for (const item of cart) {
      try {
        latest.push(await listingService.get(item.id));
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
        latest.push({ ...item.snapshot, id: item.id, hidden: true });
      }
    }
    setBooks((old) => [
      ...old.filter((book) => !latest.some((fresh) => fresh.id === book.id)),
      ...latest,
    ]);
    setCart((old) =>
      old.map((item) => {
        const book = latest.find((book) => book.id === item.id);
        return {
          ...item,
          snapshot: book,
          quantity:
            book?.type === "new" && book.stock > 0
              ? Math.min(item.quantity, book.stock)
              : item.quantity,
        };
      }),
    );
    setCheckoutError("");
  }

  function finishPaperOrder(order, paper, hasEbook) {
    const ids = paper.map((item) => item.listingId);
    setCart((old) => old.filter((item) => !ids.includes(item.id)));
    // Đơn khôi phục đã trừ kho ở server nên frontend không trừ lần thứ hai.
    setSuccess({
      title: "Đã đặt sách!",
      text: `Đơn #${order._id.slice(-8)} đã được lưu.${hasEbook ? " Ebook vẫn ở giỏ để thanh toán chuyển khoản riêng." : " Bạn có thể theo dõi trạng thái trong đơn hàng."}`,
      action: "Xem đơn hàng",
      to: "/don-hang",
    });
    rememberAttempt(null);
    setCheckout(false);
    setCartOpen(false);
  }

  async function recoverOrder() {
    if (posting.current || !attempt.current) {
      return;
    }
    posting.current = true;
    setSubmitting(true);
    setCheckoutError("");
    const saved = attempt.current;
    try {
      const order = await orderService.create(saved);
      finishPaperOrder(
        order,
        saved.items,
        cartItems.some((item) => item.book.type === "digital"),
      );
    } catch (error) {
      if ([400, 403, 404, 409].includes(error.status)) {
        rememberAttempt(null);
      }
      notify(apiMessage(error));
    } finally {
      posting.current = false;
      setSubmitting(false);
    }
  }

  function paperCheckoutPayload(form, paper) {
    const services = {};
    for (const group of cartGroups) {
      if (group.hasPhysical) {
        services[group.id] = selectedServices[group.id] || "standard";
      }
    }
    return {
      receiverName: String(form.get("name") || "").trim(),
      receiverPhone: String(form.get("phone") || "").trim(),
      receiverAddress: String(form.get("address") || "").trim(),
      items: paper.map((item) => ({
        listingId: item.id,
        quantity: item.quantity,
      })),
      services,
    };
  }

  async function checkCartPrices() {
    const latest = await Promise.all(
      cartItems.map((item) => listingService.get(item.id)),
    );
    if (
      latest.some(
        (book, index) =>
          !isAvailable(book) ||
          (book.type === "new" && book.stock < cartItems[index].quantity),
      )
    ) {
      setCheckoutError("Số lượng đã thay đổi. Hãy cập nhật lại giỏ.");
      return false;
    }
    if (
      latest.some((book, index) => book.price !== cartItems[index].book.price)
    ) {
      rememberListings(latest);
      setCheckoutError(
        "Giá đã thay đổi. Kiểm tra lại tổng tiền trước khi đặt.",
      );
      return false;
    }
    return true;
  }

  // Giỏ hỗn hợp đặt sách mới/cũ trước; ebook thanh toán chuyển khoản riêng.
  async function placeOrder(event) {
    event.preventDefault();
    if (posting.current || !trimRequired(event)) {
      return;
    }
    if (!profile || profile.role === "admin") {
      return notify("Hãy đăng nhập tài khoản người dùng để đặt hàng.");
    }
    if (!cartItems.length) {
      return setCheckoutError("Giỏ hàng đang trống.");
    }
    const form = new FormData(event.currentTarget);
    const paper = cartItems.filter((item) =>
      ["new", "used"].includes(item.book.type),
    );
    const digital = cartItems.filter((item) => item.book.type === "digital");
    const payload = paperCheckoutPayload(form, paper);
    if (attempt.current) {
      return recoverOrder();
    }
    if (cartItems.some((item) => !item.available)) {
      return setCheckoutError("Có tin không còn bán. Hãy cập nhật lại giỏ.");
    }
    if (paper.length && (!shippingServices.length || shippingError)) {
      return setCheckoutError(
        "Chưa tải được dịch vụ giao hàng. Vui lòng thử lại.",
      );
    }
    posting.current = true;
    setSubmitting(true);
    setCheckoutError("");
    try {
      if (!(await checkCartPrices())) {
        return;
      }
      if (paper.length && form.get("saveAddress") === "on") {
        const updated = await profileService.addAddress({
          label: "Địa chỉ đặt hàng",
          receiverName: payload.receiverName,
          phone: payload.receiverPhone,
          address: payload.receiverAddress,
          isDefault: !(profile.addresses || []).length,
        });
        setProfile(updated);
      }
      if (paper.length) {
        const saved = { ...payload, idempotencyKey: newCheckoutKey() };
        rememberAttempt(saved);
        const order = await orderService.create(saved);
        finishPaperOrder(order, saved.items, digital.length > 0);
      } else if (digital.length) {
        const result = await digitalOrderService.create(
          digital.map((item) => item.id),
        );
        if (result.order.status === "paid") {
          await finishDigitalOrder(result.order);
        } else {
          setPaymentOrder(result.order);
        }
      }
      setCheckout(false);
      setCartOpen(false);
    } catch (error) {
      if ([400, 403, 404, 409].includes(error.status)) {
        rememberAttempt(null);
      }
      setCheckoutError(
        error.status === 409 || error.status === 404
          ? apiMessage(error) + " Hãy cập nhật lại giỏ."
          : apiMessage(error),
      );
    } finally {
      posting.current = false;
      setSubmitting(false);
    }
  }

  return {
    submitting,
    checkoutError,
    pendingOrder,
    refreshCart,
    recoverOrder,
    placeOrder,
  };
}
