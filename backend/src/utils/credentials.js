// Validate thông tin đăng nhập dùng chung cho hai collection, không thay đổi mật khẩu.
export function checkCredentials(body) {
  if (
    !body ||
    typeof body.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
    body.email.length > 254
  ) {
    return "Email không hợp lệ.";
  }
  if (
    typeof body.password !== "string" ||
    !body.password.trim() ||
    body.password.length < 6 ||
    Buffer.byteLength(body.password, "utf8") > 72
  ) {
    return "Mật khẩu cần ít nhất 6 ký tự và tối đa 72 byte.";
  }
  return "";
}
