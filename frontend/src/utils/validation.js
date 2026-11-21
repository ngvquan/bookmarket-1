// Bỏ khoảng trắng thừa ở nội dung và chặn trường bắt buộc rỗng; giữ nguyên mật khẩu.
export function trimRequired(event) {
  const form = event.currentTarget;
  for (const field of form.querySelectorAll("input,textarea")) {
    if (!["password", "file"].includes(field.type)) {
      field.value = field.value.trim();
    }
    if (
      field.required &&
      (!field.value.trim() ||
        (field.minLength > 0 && field.value.length < field.minLength))
    ) {
      field.setCustomValidity(
        "Vui lòng nhập nội dung hợp lệ, không chỉ khoảng trắng.",
      );
      field.addEventListener("input", () => field.setCustomValidity(""), {
        once: true,
      });
      field.reportValidity();
      return false;
    }
  }
  return true;
}
