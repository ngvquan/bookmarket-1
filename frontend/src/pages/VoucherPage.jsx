import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { voucherService, apiMessage } from "../services/api.js";
import { money } from "../utils/format.js";
import PageTitle from "../components/PageTitle.jsx";
import "../styles/vouchers.css";

function discountLabel(voucher) {
  return voucher.kind === "percent"
    ? `Giảm ${voucher.value}%${voucher.maxDiscount ? `, tối đa ${money(voucher.maxDiscount)}` : ""}`
    : `Giảm ${money(voucher.value)}`;
}

function statusLabel(voucher) {
  if (voucher.status === "used") return "Đã dùng";
  if (voucher.status === "reserved") return "Đang chờ thanh toán";
  if (voucher.status === "revoked") return "Đã thu hồi";
  if (new Date(voucher.expiresAt) <= new Date()) return "Hết hạn";
  return "Có thể dùng";
}

export default function VoucherPage({ seller = false, profile }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const targetBuyerId = seller ? params.get("buyerId") : null;
  const targetOrder = seller ? params.get("order") : null;
  const [useOrderBuyer, setUseOrderBuyer] = useState(Boolean(targetBuyerId));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("fixed");
  const [buyers, setBuyers] = useState([]);
  const [recipientMode, setRecipientMode] = useState("buyers");
  const [selectedBuyerIds, setSelectedBuyerIds] = useState([]);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [buyersLoading, setBuyersLoading] = useState(true);
  const [buyersError, setBuyersError] = useState("");

  async function load() {
    setError("");
    try {
      const data = await (seller ? voucherService.seller() : voucherService.mine());
      setItems(data.items || []);
    } catch (requestError) {
      setError(apiMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [seller, profile?.id]);
  useEffect(() => {
    if (!seller) return;
    let active = true;
    setBuyersLoading(true);
    setBuyersError("");
    voucherService.buyers().then((data) => {
      if (!active) return;
      setBuyers(data.items || []);
    }).catch((requestError) => {
      if (!active) return;
      setBuyersError(apiMessage(requestError));
    }).finally(() => {
      if (active) setBuyersLoading(false);
    });
    return () => { active = false; };
  }, [seller, profile?.id]);

  const visibleBuyers = buyers.filter((buyer) =>
    `${buyer.name} ${buyer.email}`.toLocaleLowerCase("vi-VN")
      .includes(buyerSearch.toLocaleLowerCase("vi-VN")));
  const selectableBuyers = visibleBuyers.slice(0, 50);
  const allVisibleSelected = selectableBuyers.length > 0 &&
    selectableBuyers.every((buyer) => selectedBuyerIds.includes(buyer.id));

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const date = String(data.get("expiresAt"));
      const offer = {
        kind,
        value: Number(data.get("value")),
        minSubtotal: Number(data.get("minSubtotal") || 0),
        maxDiscount: kind === "percent" ? Number(data.get("maxDiscount") || 0) : 0,
        expiresAt: new Date(`${date}T23:59:59`).toISOString(),
      };
      let count = 1;
      if (useOrderBuyer && targetBuyerId) {
        await voucherService.create({ buyerId: targetBuyerId, ...offer });
      } else if (recipientMode === "buyers") {
        count = selectedBuyerIds.length;
        if (!count) throw new Error("Chọn ít nhất một người mua.");
        if (count === 1)
          await voucherService.create({ buyerId: selectedBuyerIds[0], ...offer });
        else
          await voucherService.createBulk({ buyerIds: selectedBuyerIds, ...offer });
      } else {
        const emails = String(data.get("buyerEmails") || "")
          .split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean);
        if (!emails.length) throw new Error("Nhập email người mua.");
        count = emails.length;
        if (emails.length === 1)
          await voucherService.create({ buyerEmail: emails[0], ...offer });
        else
          await voucherService.createBulk({ buyerEmails: emails, ...offer });
      }
      form.reset();
      setKind("fixed");
      setSelectedBuyerIds([]);
      setBuyerSearch("");
      setMessage(`Đã gửi ${count} voucher tới ${count} người mua.`);
      await load();
    } catch (requestError) {
      setError(apiMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(voucher) {
    if (!window.confirm(`Thu hồi voucher ${voucher.code}?`)) return;
    setBusy(true);
    setError("");
    try {
      await voucherService.revoke(voucher._id);
      setMessage("Đã thu hồi voucher.");
      await load();
    } catch (requestError) {
      setError(apiMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <div className="voucher-page">
      {seller && (
        <form className="voucher-form" onSubmit={create}>
          <h2>Tạo voucher cho người mua</h2>
          <p>{targetBuyerId && useOrderBuyer
            ? "Voucher sẽ xuất hiện trực tiếp trong tài khoản người mua của đơn này."
            : "Chọn người mua đã đặt hàng ở shop hoặc nhập email người mua khác. Mỗi người nhận một voucher riêng."}</p>
          {targetBuyerId && useOrderBuyer && (
            <p className="info-box">
              Gửi trực tiếp cho người mua của đơn #{String(targetOrder || "").slice(-8)}.
              <button type="button" className="text-link" onClick={() => setUseOrderBuyer(false)}>Dùng email khác</button>
            </p>
          )}
          {(!targetBuyerId || !useOrderBuyer) && (
            <div className="voucher-recipient-modes" role="group" aria-label="Cách chọn người nhận">
              <button type="button" className={recipientMode === "buyers" ? "selected" : ""}
                onClick={() => setRecipientMode("buyers")}>Khách đã mua</button>
              <button type="button" className={recipientMode === "emails" ? "selected" : ""}
                onClick={() => setRecipientMode("emails")}>Nhập email</button>
            </div>
          )}
          <div className="voucher-fields">
            {(!targetBuyerId || !useOrderBuyer) && recipientMode === "buyers" && (
              <div className="voucher-recipient-field">
                <label>Tìm người mua
                  <input type="search" value={buyerSearch} onChange={(event) => setBuyerSearch(event.target.value)}
                    placeholder="Tên hoặc email người mua" />
                </label>
                {buyersLoading ? <p>Đang tải người mua…</p> : buyersError ? (
                  <p className="danger-text">{buyersError}</p>
                ) : !buyers.length ? (
                  <p>Database hiện tại chưa ghi nhận đơn mua cho tài khoản này. Bạn có thể dùng mục Nhập email.</p>
                ) : (
                  <>
                    <label className="voucher-select-all">
                      <input type="checkbox" checked={allVisibleSelected} disabled={!visibleBuyers.length}
                        onChange={() => setSelectedBuyerIds(allVisibleSelected
                          ? [] : selectableBuyers.map((buyer) => buyer.id))} />
                      Chọn tất cả đang hiện (tối đa 50)
                    </label>
                    <div className="voucher-buyer-list">
                      {!visibleBuyers.length && <p>Không tìm thấy người mua khớp với từ khóa.</p>}
                      {visibleBuyers.map((buyer) => (
                        <label key={buyer.id}>
                          <input type="checkbox" checked={selectedBuyerIds.includes(buyer.id)}
                            disabled={selectedBuyerIds.length >= 50 && !selectedBuyerIds.includes(buyer.id)}
                            onChange={(event) => setSelectedBuyerIds((current) => event.target.checked
                              ? [...current, buyer.id] : current.filter((id) => id !== buyer.id))} />
                          <span>{buyer.name}<small>{buyer.email}</small></span>
                        </label>
                      ))}
                    </div>
                    <p>Đã chọn {selectedBuyerIds.length}/50 người mua.</p>
                  </>
                )}
              </div>
            )}
            {(!targetBuyerId || !useOrderBuyer) && recipientMode === "emails" && (
              <label>Email người mua
                <textarea name="buyerEmails" required rows="4" placeholder={"nguoi-mua-1@example.com\nnguoi-mua-2@example.com"} />
              </label>
            )}
            <label>Loại giảm giá
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="fixed">Giảm số tiền</option>
                <option value="percent">Giảm phần trăm</option>
              </select>
            </label>
            <label>{kind === "percent" ? "Phần trăm giảm" : "Số tiền giảm (đ)"}
              <input name="value" type="number" min="1" max={kind === "percent" ? "100" : "1000000"} step="1" required />
            </label>
            <label>Đơn tối thiểu từ shop (đ)<input name="minSubtotal" type="number" min="0" max="100000000" step="1" defaultValue="0" /></label>
            {kind === "percent" && (
              <label>Giảm tối đa (đ, để 0 nếu không giới hạn)<input name="maxDiscount" type="number" min="0" max="1000000" step="1" defaultValue="0" /></label>
            )}
            <label>Hạn dùng<input name="expiresAt" type="date" min={new Date().toISOString().slice(0, 10)} required /></label>
          </div>
          <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Tạo và gửi voucher"}</button>
        </form>
      )}
      {message && <p className="info-box" role="status">{message}</p>}
      {error && <p className="danger-text" role="alert">{error}</p>}
      <section className="voucher-list" aria-label={seller ? "Voucher đã gửi" : "Voucher của tôi"}>
        <h2>{seller ? "Voucher đã gửi" : "Voucher của tôi"}</h2>
        {loading ? <p>Đang tải voucher…</p> : !items.length ? (
          <p>{seller ? "Bạn chưa gửi voucher nào." : "Bạn chưa nhận được voucher nào."}</p>
        ) : items.map((voucher) => (
          <article className="voucher-card" key={voucher._id}>
            <div>
              <strong>{discountLabel(voucher)}</strong>
              <span className="voucher-code">{voucher.code}</span>
              <small>{seller
                ? `Gửi tới ${voucher.buyerId?.name || "Người mua"} (${voucher.buyerId?.email || ""})`
                : `Từ ${voucher.sellerId?.name || "người bán"}`}</small>
              <small>Đơn từ {money(voucher.minSubtotal)} · Hạn {new Date(voucher.expiresAt).toLocaleDateString("vi-VN")}</small>
            </div>
            <div className="voucher-card-actions">
              <span>{statusLabel(voucher)}</span>
              {seller && voucher.status === "active" && (
                <button type="button" className="button button-outline button-small" disabled={busy} onClick={() => revoke(voucher)}>Thu hồi</button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );

  return seller ? content : (
    <div className="shell page-content">
      <PageTitle title="Voucher của tôi" description="Ưu đãi người bán gửi trực tiếp cho bạn. Chọn voucher khi thanh toán sách của họ." />
      {content}
    </div>
  );
}
