import { useEffect, useState } from "react";
import { digitalOrderService, apiMessage } from "../services/api.js";
import { digitalStatuses } from "./DigitalOrders.jsx";
import { money } from "../utils/format.js";
import Pagination from "./Pagination.jsx";
export default function AdminDigitalOrders() {
  const [data, setData] = useState({ items: [], pages: 0 }),
    [page, setPage] = useState(1);
  const [bankData, setBankData] = useState({ items: [], pages: 0 }),
    [bankPage, setBankPage] = useState(1);
  const [status, setStatus] = useState("pending_payment"),
    [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    digitalOrderService
      .admin({ page, ...(status ? { status } : {}) })
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((error) => {
        if (active) setError(apiMessage(error));
      });
    return () => {
      active = false;
    };
  }, [page, status, revision]);
  useEffect(() => {
    let active = true;
    digitalOrderService
      .bankTransactions({ page: bankPage, resolved: false })
      .then((result) => {
        if (active) setBankData(result);
      })
      .catch((error) => {
        if (active) setError(apiMessage(error));
      });
    return () => {
      active = false;
    };
  }, [bankPage, revision]);
  return (
    <section className="admin-digital-orders">
      <h2>Đơn ebook</h2>
      <section className="unmatched-transactions">
        <h3>Giao dịch chưa khớp</h3>
        {bankData.items.map((item) => (
          <article className="order-card" key={item._id}>
            <strong>{item.transactionId}</strong>
            <p>
              {money(item.amount)} · {reasonLabels[item.reason]}
            </p>
            <small>
              {item.description || "Không có nội dung chuyển khoản"}
            </small>
          </article>
        ))}
        {!bankData.items.length && <p>Không có giao dịch chưa khớp.</p>}
        <Pagination data={bankData} onPage={setBankPage} />
      </section>
      <label className="order-filter">
        Trạng thái ebook
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả</option>
          {Object.entries(digitalStatuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {data.items.map((order) => (
        <article className="order-card" key={order._id}>
          <div className="order-heading">
            <strong>{order.transferCode}</strong>
            <span>{digitalStatuses[order.status]}</span>
          </div>
          <p>
            {order.items.map((item) => item.title).join(", ")} ·{" "}
            {money(order.total)}
          </p>
          {["pending_payment", "expired"].includes(order.status) && (
            <ManualPayment
              order={order}
              transactions={bankData.items}
              onSaved={() => setRevision((value) => value + 1)}
            />
          )}
        </article>
      ))}
      {!data.items.length && <p>Không có đơn ebook trong mục này.</p>}
      <Pagination data={data} onPage={setPage} />
    </section>
  );
}
const reasonLabels = {
  no_code: "Không có mã đơn",
  no_order: "Không tìm thấy đơn",
  not_enough: "Chưa đủ tiền",
  wrong_account: "Sai tài khoản nhận",
  order_cancelled: "Đơn đã hủy",
  outgoing: "Giao dịch tiền ra",
};
function ManualPayment({ order, transactions, onSaved }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [transaction, setTransaction] = useState(""),
    [amount, setAmount] = useState("");
  function choose(event) {
    const found = transactions.find(
      (item) => item.transactionId === event.target.value,
    );
    setTransaction(found?.transactionId || "");
    setAmount(found ? String(found.amount) : "");
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await digitalOrderService.markPaid(order._id, {
        bankTransactionId: String(form.get("transaction")).trim(),
        paidAmount: Number(form.get("amount")),
      });
      onSaved();
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="button button-outline" onClick={() => setOpen(!open)}>
        Đánh dấu đã thanh toán
      </button>
      {open && (
        <form className="form-stack" onSubmit={submit}>
          <p>Chỉ xác nhận sau khi đã kiểm tra tiền vào tài khoản ngân hàng.</p>
          <label>
            Chọn giao dịch chưa khớp
            <select
              aria-label="Chọn giao dịch chưa khớp"
              value={
                transactions.some((item) => item.transactionId === transaction)
                  ? transaction
                  : ""
              }
              onChange={choose}
            >
              <option value="">Nhập tay</option>
              {transactions.map((item) => (
                <option key={item._id} value={item.transactionId}>
                  {item.transactionId} · {money(item.amount)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mã giao dịch ngân hàng
            <input
              name="transaction"
              required
              maxLength={120}
              value={transaction}
              onChange={(event) => setTransaction(event.target.value)}
            />
          </label>
          <label>
            Số tiền thực nhận
            <input
              name="amount"
              type="number"
              required
              min={order.total}
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            Xác nhận đã nhận tiền
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
