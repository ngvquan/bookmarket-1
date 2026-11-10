import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import PageTitle from "../components/PageTitle.jsx";
import { apiMessage, profileService } from "../services/api.js";

export default function ProfilePage({ profile, setProfile, notify }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  async function saveName(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const user = await profileService.updateName(
        new FormData(event.currentTarget).get("name"),
      );
      setProfile(user);
      notify("Đã cập nhật tên tài khoản.");
    } catch (error) {
      notify(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function saveAddress(data, id) {
    setBusy(true);
    try {
      const user = await (id
        ? profileService.updateAddress(id, data)
        : profileService.addAddress(data));
      setProfile(user);
      setAdding(false);
      setEditing(null);
      notify(id ? "Đã cập nhật địa chỉ." : "Đã lưu địa chỉ mới.");
    } catch (error) {
      notify(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function removeAddress(id) {
    if (!confirm("Xóa địa chỉ này?")) return;
    setBusy(true);
    try {
      setProfile(await profileService.removeAddress(id));
      notify("Đã xóa địa chỉ.");
    } catch (error) {
      notify(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const addresses = profile.addresses || [];
  return (
    <div className="shell page-content profile-page">
      <PageTitle
        eyebrow="TÀI KHOẢN CỦA BẠN"
        title="Hồ sơ cá nhân"
        description="Cập nhật tên và các địa chỉ dùng khi đặt sách."
      />
      <section className="profile-panel">
        <div className="profile-section-title">
          <UserRound size={20} />
          <div>
            <h2>Thông tin tài khoản</h2>
            <p>Email không thể thay đổi trong phiên bản hiện tại.</p>
          </div>
        </div>
        <form className="profile-name-form" onSubmit={saveName}>
          <label>
            Tên hiển thị
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={profile.name}
            />
          </label>
          <label>
            Email
            <input value={profile.email} disabled />
          </label>
          <button className="button button-dark" disabled={busy}>
            Lưu tên
          </button>
        </form>
      </section>
      <section className="profile-panel">
        <div className="profile-address-heading">
          <div className="profile-section-title">
            <MapPin size={20} />
            <div>
              <h2>Địa chỉ nhận hàng</h2>
              <p>Đã lưu {addresses.length}/3 địa chỉ.</p>
            </div>
          </div>
          {addresses.length < 3 && !adding && (
            <button
              className="button button-outline button-small"
              onClick={() => {
                setAdding(true);
                setEditing(null);
              }}
            >
              <Plus size={15} />
              Thêm địa chỉ
            </button>
          )}
        </div>
        {addresses.length ? (
          <div className="saved-address-list">
            {addresses.map((address) => (
              <article
                key={address.id}
                className={address.isDefault ? "default" : ""}
              >
                <div>
                  <strong>
                    {address.label}
                    {address.isDefault && <span>Mặc định</span>}
                  </strong>
                  <p>
                    {address.receiverName} · {address.phone}
                  </p>
                  <p>{address.address}</p>
                </div>
                <div>
                  <button
                    aria-label={`Sửa ${address.label}`}
                    onClick={() => {
                      setEditing(address);
                      setAdding(false);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    aria-label={`Xóa ${address.label}`}
                    onClick={() => removeAddress(address.id)}
                    disabled={busy}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          !adding && <p className="info-box">Bạn chưa lưu địa chỉ nhận hàng.</p>
        )}
        {(adding || editing) && (
          <AddressForm
            key={editing?.id || "new"}
            address={editing}
            busy={busy}
            onCancel={() => {
              setAdding(false);
              setEditing(null);
            }}
            onSave={saveAddress}
          />
        )}
      </section>
    </div>
  );
}

function AddressForm({ address, busy, onCancel, onSave }) {
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave(
      {
        label: form.get("label"),
        receiverName: form.get("receiverName"),
        phone: form.get("phone"),
        address: form.get("address"),
        isDefault: form.get("isDefault") === "on",
      },
      address?.id,
    );
  }
  return (
    <form className="form-stack address-form" onSubmit={submit}>
      <h3>{address ? "Sửa địa chỉ" : "Thêm địa chỉ"}</h3>
      <label>
        Tên gợi nhớ
        <input
          name="label"
          required
          maxLength={50}
          defaultValue={address?.label || "Nhà riêng"}
        />
      </label>
      <div className="form-row">
        <label>
          Người nhận
          <input
            name="receiverName"
            required
            maxLength={120}
            defaultValue={address?.receiverName || ""}
          />
        </label>
        <label>
          Số điện thoại
          <input
            name="phone"
            type="tel"
            required
            minLength={9}
            maxLength={15}
            defaultValue={address?.phone || ""}
          />
        </label>
      </div>
      <label>
        Địa chỉ đầy đủ
        <textarea
          name="address"
          required
          maxLength={1000}
          defaultValue={address?.address || ""}
        />
      </label>
      <label className="checkbox-line">
        <input
          name="isDefault"
          type="checkbox"
          defaultChecked={address?.isDefault || false}
        />
        Dùng làm địa chỉ mặc định
      </label>
      <div className="form-actions">
        <button
          type="button"
          className="button button-outline"
          onClick={onCancel}
        >
          Hủy
        </button>
        <button className="button button-dark" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu địa chỉ"}
        </button>
      </div>
    </form>
  );
}
