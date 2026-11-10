// Giữ lần đặt chưa nhận được kết quả trong tab, kể cả khi tải lại trang.
// Dữ liệu này không cấp quyền: server vẫn kiểm tra JWT, giá và kho.
export function pendingCheckout(userId, value) {
  const key = `bookmarket-pending-checkout:${userId}`;
  try {
    if (value === undefined)
      return JSON.parse(sessionStorage.getItem(key) || "null");
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Nếu storage bị chặn, ref trong React vẫn giữ mã cho lần thử lại. */
  }
  return null;
}

export function newCheckoutKey() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // getRandomValues dùng được cả khi mở web qua địa chỉ mạng nội bộ.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
