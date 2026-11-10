// Định dạng tiền và chuẩn hóa chữ để tìm kiếm không dấu.
export const money = (value) =>
  new Intl.NumberFormat("vi-VN").format(value) + "₫";

export const normalize = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
