import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  BookOpen,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { chatService, apiMessage } from "../services/api.js";
import useChatThread from "../hooks/useChatThread.js";

const clock = (date) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
const day = (date) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("");
const clientMessageId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export default function ChatPage({ profile, seller = false, unread }) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const base = seller ? "/nguoi-ban/tin-nhan" : "/tin-nhan";
  const role = seller ? "seller" : "buyer";
  const [page, setPage] = useState(1);
  const [inbox, setInbox] = useState({ items: [], total: 0, pages: 0 });
  const [inboxBusy, setInboxBusy] = useState(true);
  const [inboxError, setInboxError] = useState("");
  const reloadInbox = useRef(() => {});
  const thread = useChatThread(conversationId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const pending = useRef(null);
  const currentId = useRef(conversationId);
  currentId.current = conversationId;
  const scroll = useRef(null);
  const restoreScroll = useRef(null);
  const follow = useRef(true);
  const composer = useRef(null);

  useEffect(() => {
    let active = true,
      running = false;
    const controller = new AbortController();
    setInboxBusy(true);
    const load = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        const data = await chatService.list(role, page, controller.signal);
        if (active) {
          setInbox(data);
          setInboxError("");
        }
      } catch (error) {
        if (active) setInboxError(apiMessage(error));
      } finally {
        running = false;
        if (active) setInboxBusy(false);
      }
    };
    reloadInbox.current = load;
    load();
    const timer = setInterval(load, 5000);
    window.addEventListener("bookmarket-chat-update", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("bookmarket-chat-update", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [role, page]);
  useEffect(() => {
    setDraft("");
    setSendError("");
    setSending(false);
    pending.current = null;
    follow.current = true;
    restoreScroll.current = null;
  }, [conversationId]);
  useEffect(() => {
    if (thread.conversation && thread.conversation.role !== role) {
      navigate(
        `${thread.conversation.role === "seller" ? "/nguoi-ban/tin-nhan" : "/tin-nhan"}/${conversationId}`,
        { replace: true },
      );
    }
  }, [
    thread.conversation?.id,
    thread.conversation?.role,
    role,
    conversationId,
    navigate,
  ]);
  useLayoutEffect(() => {
    if (!scroll.current) return;
    if (restoreScroll.current) {
      const old = restoreScroll.current;
      scroll.current.scrollTop =
        old.top + scroll.current.scrollHeight - old.height;
      restoreScroll.current = null;
    } else if (follow.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [thread.messages]);

  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !thread.conversation) return;
    const id = conversationId;
    if (pending.current?.text !== text)
      pending.current = { text, clientId: clientMessageId() };
    setSending(true);
    setSendError("");
    try {
      const data = await chatService.send(id, pending.current);
      if (currentId.current !== id) return;
      follow.current = true;
      thread.addMessage(data.message);
      setDraft((current) => (current.trim() === text ? "" : current));
      pending.current = null;
      composer.current?.focus();
    } catch (error) {
      if (currentId.current === id) setSendError(apiMessage(error));
    } finally {
      if (currentId.current === id) setSending(false);
    }
  };

  return (
    <div
      className={`chat-page ${seller ? "chat-seller" : "shell page-content"}`}
    >
      <div className="chat-page-heading">
        <div>
          <span className="eyebrow">KẾT NỐI NGƯỜI YÊU SÁCH</span>
          <h1>Tin nhắn</h1>
          <p>
            {seller
              ? "Trao đổi và tư vấn sách cho người mua."
              : "Hỏi người bán về sách, tình trạng và giao hàng."}
          </p>
        </div>
        <Link
          className="text-link"
          to={seller ? "/tin-nhan" : "/nguoi-ban/tin-nhan"}
        >
          {seller ? "Hộp thư mua sách" : "Hộp thư bán hàng"}
          {(seller ? unread?.buyer : unread?.seller) > 0 && (
            <span className="chat-badge">
              {seller ? unread.buyer : unread.seller}
            </span>
          )}
        </Link>
      </div>
      <div
        className={`chat-workspace ${conversationId ? "chat-has-selection" : ""}`}
      >
        <aside className="chat-inbox" aria-label="Danh sách cuộc trò chuyện">
          <div className="chat-inbox-heading">
            <strong>{seller ? "Người mua" : "Người bán"}</strong>
            <span>{inbox.total} cuộc trò chuyện</span>
            <button
              className="icon-button"
              aria-label="Làm mới hộp thư"
              onClick={() => reloadInbox.current()}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {inboxError && (
            <p className="chat-inline-error" role="alert">
              {inboxError}
              <button onClick={() => reloadInbox.current()}>Thử lại</button>
            </p>
          )}
          <nav className="chat-conversations" aria-label="Các cuộc trò chuyện">
            {inboxBusy && (
              <p className="chat-muted" role="status">
                Đang tải hộp thư…
              </p>
            )}
            {!inboxBusy && !inbox.items.length && (
              <div className="chat-inbox-empty">
                <MessageCircle size={28} />
                <strong>Chưa có cuộc trò chuyện</strong>
                <p>
                  {seller
                    ? "Tin nhắn từ người mua sẽ xuất hiện tại đây."
                    : "Mở chi tiết sách và chọn Chat với người bán."}
                </p>
              </div>
            )}
            {inbox.items.map((item) => (
              <Link
                key={item.id}
                to={`${base}/${item.id}`}
                className={`chat-conversation ${item.id === conversationId ? "active" : ""}`}
                aria-current={item.id === conversationId ? "page" : undefined}
              >
                <span className="chat-avatar">{initials(item.other.name)}</span>
                <span className="chat-conversation-copy">
                  <span>
                    <strong>{item.other.name}</strong>
                    <time dateTime={item.lastMessageAt}>
                      {clock(item.lastMessageAt)}
                    </time>
                  </span>
                  <span className={item.unread ? "unread" : ""}>
                    {item.lastText || item.book?.title || "Bắt đầu trò chuyện"}
                  </span>
                </span>
                {item.unread > 0 && (
                  <span
                    className="chat-badge"
                    aria-label={`${item.unread} tin chưa đọc`}
                  >
                    {item.unread > 99 ? "99+" : item.unread}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          {inbox.pages > 1 && (
            <nav className="chat-pagination" aria-label="Trang hộp thư">
              <button
                disabled={page === 1}
                aria-label="Trang hộp thư trước"
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {page} / {inbox.pages}
              </span>
              <button
                disabled={page >= inbox.pages}
                aria-label="Trang hộp thư sau"
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </aside>
        <section className="chat-thread" aria-label="Cuộc trò chuyện">
          {!conversationId ? (
            <div className="chat-thread-empty">
              <span>
                <MessageCircle size={42} strokeWidth={1.4} />
              </span>
              <h2>Chọn một cuộc trò chuyện</h2>
              <p>Kết nối trực tiếp để tìm cuốn sách phù hợp.</p>
              <Link className="button button-outline" to="/mua-sach">
                Khám phá sách
              </Link>
            </div>
          ) : (
            <>
              <header className="chat-thread-heading">
                <Link
                  className="icon-button chat-back"
                  aria-label="Về danh sách tin nhắn"
                  to={base}
                >
                  <ArrowLeft size={19} />
                </Link>
                <span className="chat-avatar">
                  {thread.conversation
                    ? initials(thread.conversation.other.name)
                    : "…"}
                </span>
                <div>
                  <h2>
                    {thread.conversation?.other.name || "Cuộc trò chuyện"}
                  </h2>
                  <p>Tin nhắn được lưu và tự cập nhật</p>
                </div>
              </header>
              {thread.conversation?.book && (
                <div className="chat-book-context">
                  <BookOpen size={20} />
                  <div>
                    <small>Trao đổi về cuốn sách</small>
                    <strong>{thread.conversation.book.title}</strong>
                    <span>{thread.conversation.book.author}</span>
                  </div>
                </div>
              )}
              {thread.error && (
                <div role="alert" className="chat-inline-error">
                  {thread.error}
                  <button onClick={thread.retry}>Thử kết nối lại</button>
                </div>
              )}
              <div
                className="chat-message-scroll"
                ref={scroll}
                onScroll={() => {
                  const box = scroll.current;
                  follow.current =
                    box.scrollHeight - box.scrollTop - box.clientHeight < 80;
                }}
              >
                {thread.busy && (
                  <p className="chat-muted" role="status">
                    Đang tải tin nhắn…
                  </p>
                )}
                {thread.hasOlder && (
                  <button
                    className="chat-load-older"
                    disabled={thread.loadingOlder}
                    onClick={() => {
                      restoreScroll.current = {
                        top: scroll.current.scrollTop,
                        height: scroll.current.scrollHeight,
                      };
                      thread.loadOlder();
                    }}
                  >
                    {thread.loadingOlder ? "Đang tải…" : "Tin nhắn cũ hơn"}
                  </button>
                )}
                {!thread.busy &&
                  thread.conversation &&
                  !thread.messages.length && (
                    <div className="chat-first-message">
                      <MessageCircle size={26} />
                      <p>Gửi lời chào và câu hỏi đầu tiên của bạn.</p>
                    </div>
                  )}
                <div
                  className="chat-messages"
                  role="log"
                  aria-label="Nội dung cuộc trò chuyện"
                  aria-live="polite"
                  aria-relevant="additions text"
                >
                  {thread.messages.map((message, index) => (
                    <div key={message.id}>
                      {(!index ||
                        day(message.createdAt) !==
                          day(thread.messages[index - 1].createdAt)) && (
                        <p className="chat-day">{day(message.createdAt)}</p>
                      )}
                      <div
                        className={`chat-message ${message.senderId === profile.id ? "mine" : "theirs"}`}
                      >
                        <p>{message.text}</p>
                        <small>
                          <time dateTime={message.createdAt}>
                            {clock(message.createdAt)}
                          </time>
                          {message.senderId === profile.id && (
                            <span>
                              {message.sequence <=
                              (thread.conversation?.otherReadSequence || 0)
                                ? "Đã xem"
                                : "Đã gửi"}
                            </span>
                          )}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <form className="chat-composer" onSubmit={send}>
                {sendError && (
                  <p className="chat-inline-error" role="alert">
                    {sendError} Nội dung được giữ để bạn gửi lại.
                  </p>
                )}
                <div>
                  <textarea
                    ref={composer}
                    aria-label="Nội dung tin nhắn"
                    placeholder="Nhập tin nhắn…"
                    maxLength={2000}
                    value={draft}
                    disabled={!thread.conversation}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      setSendError("");
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        event.currentTarget.form.requestSubmit();
                      }
                    }}
                  />
                  <button
                    className="button button-dark"
                    type="submit"
                    disabled={!draft.trim() || sending || !thread.conversation}
                    aria-label={sendError ? "Gửi lại tin nhắn" : "Gửi tin nhắn"}
                  >
                    <Send size={18} />
                    <span>
                      {sending ? "Đang gửi…" : sendError ? "Gửi lại" : "Gửi"}
                    </span>
                  </button>
                </div>
                <small>
                  <span>Enter để gửi · Shift + Enter để xuống dòng</span>
                  <span>{draft.length}/2000</span>
                </small>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
