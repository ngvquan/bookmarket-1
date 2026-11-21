import { useState } from "react";

export default function CheckoutAddressFields({ profile }) {
  const addresses = profile?.addresses || [];
  const initial =
    addresses.find((item) => item.isDefault) || addresses[0] || null;
  const [selectedId, setSelectedId] = useState(initial?.id || "");
  const [values, setValues] = useState({
    name: initial?.receiverName || profile?.name || "",
    phone: initial?.phone || "",
    address: initial?.address || "",
  });
  function select(event) {
    const id = event.target.value;
    setSelectedId(id);
    const selected = addresses.find((item) => item.id === id);
    setValues(
      selected
        ? {
            name: selected.receiverName,
            phone: selected.phone,
            address: selected.address,
          }
        : { name: profile?.name || "", phone: "", address: "" },
    );
  }
  const change = (event) =>
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  return (
    <>
      {addresses.length > 0 && (
        <label>
          Địa chỉ đã lưu
          <select
            aria-label="Chọn địa chỉ nhận hàng"
            value={selectedId}
            onChange={select}
          >
            <option value="">Nhập địa chỉ mới</option>
            {addresses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.isDefault ? " · Mặc định" : ""} — {item.address}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Họ và tên
        <input
          name="name"
          value={values.name}
          onChange={change}
          required
          maxLength={120}
          placeholder="Người nhận sách"
          autoComplete="name"
        />
      </label>
      <label>
        Số điện thoại
        <input
          name="phone"
          value={values.phone}
          onChange={change}
          type="tel"
          required
          minLength={9}
          maxLength={15}
          placeholder="090 123 4567"
          autoComplete="tel"
        />
      </label>
      <label>
        Địa chỉ nhận sách
        <textarea
          name="address"
          value={values.address}
          onChange={change}
          required
          maxLength={1000}
          placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành"
          autoComplete="street-address"
        />
      </label>
      {!selectedId && addresses.length < 3 && (
        <label className="checkbox-line">
          <input type="checkbox" name="saveAddress" />
          Lưu địa chỉ này để dùng lần sau
        </label>
      )}
    </>
  );
}
