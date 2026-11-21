export const sellerSections = [
  {
    id: "products",
    path: "/nguoi-ban/san-pham",
    label: "Sản phẩm",
    title: "Quản lý sách",
    description:
      "Đăng sách, cập nhật giá, tồn kho và theo dõi trạng thái duyệt.",
  },
  {
    id: "orders",
    path: "/nguoi-ban/don-hang",
    label: "Đơn bán hàng",
    title: "Đơn bán hàng",
    description: "Xác nhận đơn, giao sách và theo dõi đơn do bạn bán.",
  },
  {
    id: "reviews",
    path: "/nguoi-ban/danh-gia",
    label: "Đánh giá",
    title: "Đánh giá từ người mua",
    description: "Xem và phản hồi đánh giá về sách bạn đã bán.",
  },
  {
    id: "chat",
    path: "/nguoi-ban/tin-nhan",
    label: "Tin nhắn",
    title: "Tin nhắn",
    description: "Trao đổi với người mua về sách và giao hàng.",
  },
  {
    id: "shop",
    path: "/nguoi-ban/gian-hang",
    label: "Thông tin gian hàng",
    title: "Thông tin gian hàng",
    description: "Quản lý tên và giới thiệu gian hàng công khai của bạn.",
  },
];

export const sellerPath = (section) =>
  sellerSections.find((item) => item.id === section)?.path || "/nguoi-ban";
export const isSellerArea = (path) =>
  path.replace(/\/$/, "") !== "/nguoi-ban/dang-ky" &&
  (path === "/gian-hang" ||
    path === "/nguoi-ban" ||
    path.startsWith("/nguoi-ban/"));
