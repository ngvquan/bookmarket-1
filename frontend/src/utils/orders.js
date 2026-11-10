// Nhãn hiển thị; quyền và chuyển trạng thái thực tế do server kiểm tra.
export const buyerOrderTabs = [
  ["pending", "Chờ xác nhận"],
  ["to-ship", "Chờ giao hàng"],
  ["to-receive", "Nhận hàng"],
  ["cancelled", "Đã hủy"],
];
export const orderStatuses = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  returned: "Đã hoàn hàng",
};
// Bộ lọc gộp hai bước kỹ thuật delivered/completed thành một mục dễ hiểu.
export const orderStatusFilters = [
  ["pending", "Chờ xác nhận"],
  ["confirmed", "Đã xác nhận"],
  ["shipping", "Đang giao"],
  ["finished", "Hoàn thành"],
  ["cancelled", "Đã hủy"],
  ["returned", "Đã hoàn hàng"],
];
export function statusTone(status) {
  if (["cancelled", "returned"].includes(status)) return "red";
  if (["pending", "confirmed", "shipping"].includes(status)) return "amber";
  return "green";
}
