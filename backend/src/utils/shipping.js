// Tính phí tại server để tổng đơn không phụ thuộc số tiền client gửi.
// Tên dịch vụ hư cấu; dùng chung cho đặt hàng và API danh sách dịch vụ.
export const shippingServices = {
  standard: { name: "Tiết kiệm", fee: 25000, days: "3–5 ngày" },
  fast: { name: "Nhanh", fee: 40000, days: "1–2 ngày" },
};

export function getShippingFee(service) {
  if (!Object.hasOwn(shippingServices, service)) {
    const error = new Error("Dịch vụ giao hàng phải là standard hoặc fast.");
    error.status = 400;
    throw error;
  }
  return shippingServices[service].fee;
}
