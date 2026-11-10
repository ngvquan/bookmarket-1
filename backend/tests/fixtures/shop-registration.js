export const registrationData = (changes = {}) => ({
  name: "Gian sách mẫu",
  description: "Gian hàng bán và giới thiệu sách cho bạn đọc.",
  contactName: "Nguyễn Văn An",
  contactPhone: "0901234567",
  contactEmail: "shop@example.com",
  pickupAddress: {
    province: "Thành phố Hồ Chí Minh",
    ward: "Phường Bến Thành",
    detail: "12 Đường Sách",
  },
  registrationConfirmed: true,
  ...changes,
});
