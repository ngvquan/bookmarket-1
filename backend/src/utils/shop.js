// Chỉ lấy dữ liệu shop được phép sửa; chủ shop và thời điểm đăng ký do server đặt.
export function readShop(body, { partial = false, registered = false } = {}) {
  const fields = [
    "name",
    "description",
    "contactName",
    "contactPhone",
    "contactEmail",
    "pickupAddress",
  ];
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (key) =>
        !fields.includes(key) && !(key === "registrationConfirmed" && !partial),
    )
  ) {
    return {
      message:
        "Thông tin shop không hợp lệ; không được tự đổi chủ hoặc trạng thái shop.",
    };
  }
  if (!partial && body.registrationConfirmed !== true)
    return { message: "Hãy xác nhận thông tin đăng ký gian hàng." };
  const data = {};
  const rules = {
    name: [1, 120, "Tên gian hàng"],
    description: [1, 1500, "Giới thiệu"],
    contactName: [2, 100, "Tên người liên hệ"],
    contactPhone: [1, 20, "Số điện thoại"],
    contactEmail: [3, 254, "Email liên hệ"],
  };
  for (const [field, [min, max, label]] of Object.entries(rules)) {
    if (partial && body[field] === undefined) continue;
    if (typeof body[field] !== "string")
      return { message: `${label} không được để trống.` };
    let value = body[field].trim();
    if (field === "contactPhone") value = value.replace(/[\s().-]/g, "");
    if (field === "contactEmail") value = value.toLowerCase();
    const optional =
      partial && !registered && !["name", "description"].includes(field);
    if (value.length > max || (value.length < min && !(optional && !value)))
      return { message: `${label} cần từ ${min} đến ${max} ký tự.` };
    if (
      field === "contactPhone" &&
      value &&
      !/^(?:0[35789]\d{8}|\+84[35789]\d{8})$/.test(value)
    )
      return {
        message: "Số điện thoại Việt Nam cần 10 số hoặc bắt đầu bằng +84.",
      };
    if (
      field === "contactEmail" &&
      value &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    )
      return { message: "Email liên hệ không hợp lệ." };
    data[field] = value;
  }
  if (!partial || body.pickupAddress !== undefined) {
    const address = body.pickupAddress;
    if (
      !address ||
      typeof address !== "object" ||
      Array.isArray(address) ||
      Object.keys(address).some(
        (key) => !["province", "ward", "detail"].includes(key),
      )
    )
      return { message: "Hãy điền đầy đủ địa chỉ lấy và nhận trả sách." };
    const pickupAddress = {};
    for (const [key, min, max, label] of [
      ["province", 2, 80, "Tỉnh / thành phố"],
      ["ward", 1, 100, "Phường / xã"],
      ["detail", 5, 200, "Địa chỉ cụ thể"],
    ]) {
      if (
        typeof address[key] !== "string" ||
        address[key].trim().length < min ||
        address[key].trim().length > max
      )
        return { message: `${label} cần từ ${min} đến ${max} ký tự.` };
      pickupAddress[key] = address[key].trim();
    }
    data.pickupAddress = pickupAddress;
  }
  if (!Object.keys(data).length)
    return { message: "Chưa có thông tin cần sửa." };
  return { data };
}

// Có shop chưa đủ: phải có đầy đủ hồ sơ hợp lệ mới được bán sách mới/ebook.
export function hasCompleteShopDetails(shop) {
  if (!shop) return false;
  const body = Object.fromEntries(
    [
      "name",
      "description",
      "contactName",
      "contactPhone",
      "contactEmail",
      "pickupAddress",
    ].map((key) => [key, shop[key]?.toObject?.() || shop[key]]),
  );
  return !readShop({ ...body, registrationConfirmed: true }).message;
}

export function canPublishShopBooks(shop) {
  return shop?.isRegistrationComplete === true && hasCompleteShopDetails(shop);
}
