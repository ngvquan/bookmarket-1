// Chỉ những quy trình đã có trong BookMarket; kênh hỗ trợ và quy định hoàn tiền cần chủ sàn xác nhận.
export const policies = {
  payment: "Sách giấy hiện đặt hàng với COD. Ebook trả tiền qua VietQR; sau khi webhook xác nhận khoản chuyển hợp lệ, hệ thống tự cấp quyền vào Thư viện. Không chuyển tiền cho bất kỳ tài khoản nào ngoài QR hiển thị trên đơn.",
  shipping: "Đơn sách giấy có dịch vụ giao tiêu chuẩn hoặc nhanh và mã theo dõi mô phỏng. BookMarket chưa kết nối hãng vận chuyển thật; thời gian giao cụ thể chưa được công bố.",
  returns: "Đơn đã giao có thể được quản trị viên cập nhật trạng thái hoàn hàng trong luồng mô phỏng. Điều kiện, thời hạn và quy trình đổi trả chính thức cần chủ sàn xác nhận.",
  refunds: "BookMarket chưa có chức năng tự động hoàn tiền. Mình không thể cam kết thời hạn hay điều kiện hoàn tiền khi chính sách chính thức chưa được cung cấp.",
  seller: "Người bán đăng nhập tài khoản người dùng, mở Đăng ký rạp sách và hoàn thiện liên hệ cùng địa chỉ lấy hàng. Shop đủ hồ sơ mới có thể đăng sách mới hoặc ebook; sách cũ không bắt buộc có shop.",
  support: "Hiện chưa có email, số điện thoại hay trang hỗ trợ được xác minh trong dự án. Chủ sàn cần cung cấp kênh liên hệ chính thức để mình hướng dẫn bạn liên hệ nhân viên.",
};

export function policyForQuestion(question) {
  const text = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  if (/khieu nai|lien he|ho tro|nhan vien/.test(text)) return "support";
  if (/hoan tien/.test(text)) return "refunds";
  if (/doi tra|tra hang|bao hanh/.test(text)) return "returns";
  if (/van chuyen|giao hang|ship/.test(text)) return "shipping";
  if (/thanh toan|vietqr|chuyen khoan|cod/.test(text)) return "payment";
  if (/dang ky ban|mo shop|gian hang|ban sach/.test(text)) return "seller";
  return null;
}
