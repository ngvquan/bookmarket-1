import { useEffect, useState } from "react";
import { reviewService, apiMessage } from "../services/api.js";
import Pagination from "./Pagination.jsx";
import { Empty } from "./UI.jsx";

export default function SellerReviews() {
  const [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [data, setData] = useState({
    items: [],
    page: 1,
    pages: 0,
    total: 0,
    unreplied: 0,
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    reviewService
      .shopList({ page, replied: filter })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setError(apiMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter, page, revision]);
  async function save(event, review) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await reviewService.reply(review.id, text.trim());
      setEditing(null);
      setText("");
      setRevision((value) => value + 1);
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove(review) {
    if (busy || !window.confirm("Xóa phản hồi này?")) return;
    setBusy(true);
    setError("");
    try {
      await reviewService.removeReply(review.id);
      setRevision((value) => value + 1);
    } catch (error) {
      setError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="seller-reviews">
      <div className="dashboard-tabs">
        {[
          ["all", "Tất cả"],
          ["no", `Chưa trả lời (${data.unreplied})`],
          ["yes", "Đã trả lời"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => {
              setFilter(value);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="danger-text">
          {error}
        </p>
      )}
      {loading && <p role="status">Đang tải đánh giá…</p>}
      {!loading && !data.items.length && (
        <Empty
          title="Chưa có đánh giá"
          description="Đánh giá từ người mua sẽ xuất hiện tại đây."
          action={null}
        />
      )}
      {data.items.map((review) => (
        <article className="review-item seller-review-item" key={review.id}>
          <strong>{review.bookTitle}</strong>
          <div className="review-heading">
            <span>{review.buyerName}</span>
            <span className="review-score">
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </span>
          </div>
          <p>{review.comment}</p>
          {review.reply && (
            <div className="review-reply">
              <strong>Phản hồi của gian hàng</strong>
              <p>{review.reply.text}</p>
            </div>
          )}
          {editing === review.id ? (
            <form
              className="form-stack"
              onSubmit={(event) => save(event, review)}
            >
              <label>
                Phản hồi
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </label>
              <div className="form-row">
                <button
                  className="button button-dark button-small"
                  disabled={busy || !text.trim()}
                >
                  Lưu
                </button>
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => setEditing(null)}
                >
                  Hủy
                </button>
              </div>
            </form>
          ) : (
            <div className="form-row">
              <button
                className="button button-outline button-small"
                onClick={() => {
                  setEditing(review.id);
                  setText(review.reply?.text || "");
                }}
              >
                {review.reply ? "Sửa phản hồi" : "Trả lời"}
              </button>
              {review.reply && (
                <button
                  className="button button-outline button-small danger-text"
                  disabled={busy}
                  onClick={() => remove(review)}
                >
                  Xóa phản hồi
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      <Pagination data={data} onPage={setPage} busy={loading || busy} />
    </section>
  );
}
