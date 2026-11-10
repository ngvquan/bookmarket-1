export const shopDraft = (shop, profile) => ({
  name: shop?.name || "",
  description: shop?.description || "",
  contactName: shop?.contactName || profile?.name || "",
  contactPhone: shop?.contactPhone || "",
  contactEmail: shop?.contactEmail || profile?.email || "",
  province: shop?.pickupAddress?.province || "",
  ward: shop?.pickupAddress?.ward || "",
  detail: shop?.pickupAddress?.detail || "",
});

export function shopPayload(draft) {
  const { province, ward, detail, ...fields } = draft;
  const data = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value.trim()]),
  );
  if ([province, ward, detail].some((value) => value.trim()))
    data.pickupAddress = {
      province: province.trim(),
      ward: ward.trim(),
      detail: detail.trim(),
    };
  return data;
}

export default function ShopFields({
  section,
  draft,
  onChange,
  required = true,
  disabled = false,
}) {
  const input = (name, extra = {}) => ({
    name,
    value: draft[name],
    onChange: (event) => onChange(name, event.target.value),
    disabled,
    ...extra,
  });
  if (section === "shop")
    return (
      <div className="shop-registration-fields">
        <label>
          Tên gian hàng
          <input
            {...input("name", {
              required: true,
              maxLength: 120,
              "aria-label": "Tên gian hàng",
            })}
            placeholder="Ví dụ: Tiệm sách Mùa Thu"
          />
          <small>Tên này hiển thị với người mua trên sàn.</small>
        </label>
        <label>
          Giới thiệu
          <textarea
            {...input("description", {
              required: true,
              maxLength: 1500,
              "aria-label": "Giới thiệu",
            })}
            rows={4}
            placeholder="Giới thiệu sách bạn bán và điều người mua có thể mong đợi ở shop."
          />
          <small>{draft.description.length}/1500 ký tự</small>
        </label>
      </div>
    );
  return (
    <div className="shop-registration-fields">
      <div className="shop-registration-row">
        <label>
          Người liên hệ
          <input
            {...input("contactName", {
              required,
              minLength: 2,
              maxLength: 100,
              autoComplete: "name",
            })}
            placeholder="Họ và tên người phụ trách"
          />
        </label>
        <label>
          Số điện thoại liên hệ
          <input
            {...input("contactPhone", {
              required,
              type: "tel",
              maxLength: 20,
              autoComplete: "tel",
              pattern: "(0[35789][0-9]{8}|[+]84[35789][0-9]{8})",
            })}
            placeholder="0901234567 hoặc +84901234567"
          />
        </label>
      </div>
      <label>
        Email liên hệ
        <input
          {...input("contactEmail", {
            required,
            type: "email",
            maxLength: 254,
            autoComplete: "email",
          })}
          placeholder="shop@email.com"
        />
      </label>
      <div className="shop-registration-address-heading">
        <h3>Địa chỉ lấy và nhận trả sách</h3>
        <p>
          Thông tin này dành cho chủ shop quản lý, không hiển thị trên gian hàng
          công khai.
        </p>
      </div>
      <div className="shop-registration-row">
        <label>
          Tỉnh / thành phố
          <input
            {...input("province", {
              required,
              minLength: 2,
              maxLength: 80,
              autoComplete: "address-level1",
            })}
            placeholder="Ví dụ: Thành phố Hồ Chí Minh"
          />
        </label>
        <label>
          Phường / xã
          <input
            {...input("ward", {
              required,
              maxLength: 100,
              autoComplete: "address-level2",
            })}
            placeholder="Tên phường hoặc xã"
          />
        </label>
      </div>
      <label>
        Địa chỉ cụ thể
        <textarea
          {...input("detail", {
            required,
            minLength: 5,
            maxLength: 200,
            autoComplete: "street-address",
            "aria-label": "Địa chỉ cụ thể",
          })}
          rows={2}
          placeholder="Số nhà, tên đường, tòa nhà…"
        />
      </label>
    </div>
  );
}
