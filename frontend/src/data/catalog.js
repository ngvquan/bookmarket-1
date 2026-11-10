// Ba loại tin: sách mới, sách cũ và ebook; mục mua sách gộp mới/cũ.
export const categories = [
  "Tất cả",
  "Văn học",
  "Phát triển bản thân",
  "Kinh tế",
  "Tâm lý",
  "Thiếu nhi",
];

export const types = {
  new: {
    label: "Sách mới",
    path: "/mua-sach?type=new",
    eyebrow: "MỞ MỘT TRANG MỚI",
    title: "Sách mới",
    description:
      "Khám phá sách mới từ nhiều nhà bán. So sánh giá và chọn phiên bản phù hợp.",
  },
  used: {
    label: "Sách cũ",
    path: "/mua-sach?type=used",
    eyebrow: "CŨ VỚI NGƯỜI, MỚI VỚI TA",
    title: "Chợ sách cũ",
    description:
      "Mua sách đã đọc từ cộng đồng. Xem kỹ tình trạng và thông tin người bán trước khi chọn.",
  },
  digital: {
    label: "Sách điện tử",
    path: "/digital",
    eyebrow: "CẢ THƯ VIỆN TRONG TÚI BẠN",
    title: "Sách điện tử",
    description:
      "Mua ebook bằng VietQR. Quyền sở hữu được lưu trong thư viện theo tài khoản.",
  },
};

// Mục mua sắm gộp sách giấy; loại tin new/used vẫn dùng cho đăng bán và tồn kho.
export const catalogSections = {
  physical: {
    label: "Mua sách",
    path: "/mua-sach",
    title: "Mua sách",
    description:
      "Tìm sách mới và sách đã đọc trong cùng một nơi. Lọc theo tình trạng, giá và người bán để chọn bản phù hợp.",
  },
  digital: types.digital,
};
