import { useEffect, useRef, useState } from "react";
import { reviewService, apiMessage } from "../services/api.js";
import Pagination from "./Pagination.jsx";

export default function BookReviews({ listingId, profile, onLogin }) {
  const [data, setData] = useState({
    items: [],
    total: 0,
    average: 0,
    pages: 0,
  });
  const [eligibility, setEligibility] = useState(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const customer = !!profile && profile.role !== "admin";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setEligibility(null);
    Promise.all([
      reviewService.list(listingId, page),
      customer ? reviewService.eligibility(listingId) : Promise.resolve(null),
    ])
      .then(([reviews, permission]) => {
        if (active) {
          setData(reviews);
          setEligibility(permission);
        }
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
  }, [listingId, profile?.id, customer, page, revision]);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !eligibility?.canReview) return;
    submitting.current = true;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      // Server tự tìm đơn của tài khoản; form không gửi ID người mua hoặc trạng thái đơn.
      await reviewService.create({
        listingId,
        rating,
        comment: comment.trim(),
      });
      setEligibility({
        canReview: false,
        alreadyReviewed: true,
        message: "Bạn đã đánh giá sách này rồi.",
      });
      setSuccess("Đã gửi đánh giá. Cảm ơn bạn!");
      setComment("");
      setPage(1);
      setRevision((value) => value + 1);
    } catch (error) {
      setError(apiMessage(error));
      // Quyền có thể đổi ở tài khoản khác hoặc đơn đã hoàn hàng; khóa form cho đến khi kiểm tra lại.
      if ([403, 409].includes(error.status)) setEligibility(null);
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  return (
    <section className="book-reviews" aria-label="Đánh giá sách">
      <div className="review-summary">
        <h3>Đánh giá từ người mua</h3>
        <span>
          {data.total
            ? `${data.average.toLocaleString("vi-VN")} / 5 · ${data.total} đánh giá`
            : "Chưa có đánh giá"}
        </span>
      </div>
      <p className="review-hint">
        Chỉ người mua có đơn đã hoàn thành mới được đánh giá bản sách của người
        bán này.
      </p>
      {success && (
        <p role="status" className="review-success">
          {success}
        </p>
      )}
      {loading && <p role="status">Đang tải đánh giá…</p>}
      {error && (
        <p role="alert" className="danger-text">
          {error}{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => setRevision((value) => value + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
      {!loading && !error && !profile && (
        <p className="review-hint">
          Đăng nhập để kiểm tra quyền đánh giá.{" "}
          {onLogin && (
            <button type="button" className="text-link" onClick={onLogin}>
              Đăng nhập
            </button>
          )}
        </p>
      )}
      {!loading && !error && eligibility && (
        <p className="review-hint">{eligibility.message}</p>
      )}
      {!loading && eligibility?.canReview && (
        <form className="form-stack review-form" onSubmit={submit}>
          <label>
            Số sao
            <select
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              disabled={sending}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} sao
                </option>
              ))}
            </select>
          </label>
          <label>
            Nhận xét
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              required
              maxLength={2000}
              rows={4}
              disabled={sending}
              placeholder="Chia sẻ cảm nhận về sách bạn đã mua"
            />
          </label>
          <button
            className="button button-dark"
            disabled={sending || !comment.trim()}
          >
            {sending ? "Đang gửi…" : "Gửi đánh giá"}
          </button>
        </form>
      )}
      <div className="review-list">
        {data.items.map((review) => (
          <article className="review-item" key={review.id}>
            <div className="review-heading">
              <strong>{review.buyerName}</strong>
              <span
                className="review-score"
                aria-label={`${review.rating} trên 5 sao`}
              >
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </span>
            </div>
            <div className="review-meta">
              <span>Đã mua hàng</span>
              <time dateTime={review.createdAt}>
                {new Date(review.createdAt).toLocaleDateString("vi-VN")}
              </time>
            </div>
            <p>{review.comment}</p>
            {review.reply && (
              <div className="review-reply">
                <strong>Phản hồi của {review.reply.shopName}</strong>
                <p>{review.reply.text}</p>
              </div>
            )}
          </article>
        ))}
      </div>
      <Pagination data={data} busy={loading} onPage={setPage} />
    </section>
  );
}
