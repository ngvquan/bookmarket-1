import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronRight,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { aiService, apiBaseUrl, apiMessage, listingService } from "../services/api.js";
import { money } from "../utils/format.js";

const storageKey = "bookmarket-ai-chat-v2";
const welcome = {
  role: "assistant",
  content:
    "Chào bạn! Mình là trợ lý BookMarket. Mình có thể hỏi để hiểu sở thích, tìm sách đang bán, hoặc giải đáp về mua sắm và đơn hàng. Bạn đang tìm sách cho ai?",
};
const quickQuestions = ["Gợi ý sách hay", "Sách dưới 100k", "Chính sách đổi trả", "Tra đơn hàng"];

function readStoredMessages() {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey));
    if (
      Array.isArray(value) &&
      value.length &&
      value.every(
        (item) =>
          ["user", "assistant"].includes(item?.role) &&
          typeof item.content === "string",
      )
    ) {
      return value.slice(-20);
    }
  } catch {}
  return [welcome];
}

export default function AiAssistant({ onOpenBook, onAddToCart }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(readStoredMessages);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [source, setSource] = useState(null);
  const [provider, setProvider] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (suggestion) => {
    const content = (suggestion ?? draft).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }].slice(-10);
    setMessages(next);
    setDraft("");
    setRecommendations([]);
    setLoading(true);
    try {
      const result = await aiService.chat(next);
      setSource(result.source);
      setProvider(result.provider || null);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.message },
      ]);
      setRecommendations(result.recommendations || []);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: apiMessage(error),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const openRecommendation = async (item) => {
    try {
      const book = await listingService.get(item.id);
      setOpen(false);
      onOpenBook(book);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: apiMessage(error), error: true }]);
    }
  };

  const resetConversation = () => {
    setMessages([welcome]);
    setDraft("");
    setRecommendations([]);
    setSource(null);
    setProvider(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  };

  return (
    <aside className={`ai-assistant ${open ? "is-open" : ""}`}>
      {open && (
        <section
          className="ai-assistant-panel"
          role="dialog"
          aria-label="Trợ lý AI BookMarket"
        >
          <header className="ai-assistant-header">
            <span className="ai-assistant-avatar">
              <Bot size={21} />
            </span>
            <div>
              <strong>Trợ lý BookMarket</strong>
              <span>
                <Sparkles size={12} />
                {source === "ai"
                  ? provider === "ollama"
                    ? "AI local · Qwen3"
                    : "AI đang trả lời"
                  : source === "catalog"
                    ? "Gợi ý sách đang bán"
                    : "Trợ lý tìm sách"}
              </span>
            </div>
            <button
              type="button"
              title="Bắt đầu cuộc trò chuyện mới"
              aria-label="Bắt đầu lại cuộc trò chuyện"
              onClick={resetConversation}
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              aria-label="Đóng trợ lý"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
          </header>

          <div className="ai-assistant-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                className={`ai-message ai-message-${message.role} ${message.error ? "is-error" : ""}`}
                key={`${message.role}-${index}`}
              >
                {message.content}
              </div>
            ))}
            {loading && (
              <div className="ai-message ai-message-assistant ai-message-loading">
                <LoaderCircle size={16} /> Đang trả lời…
              </div>
            )}
            {!!recommendations.length && !loading && (
              <div className="ai-recommendations">
                {recommendations.map((item) => (
                  <div className="ai-book-card" key={item.id}>
                    {item.imageId && <img alt="" src={`${apiBaseUrl}/listings/${encodeURIComponent(item.id)}/images/${encodeURIComponent(item.imageId)}`} />}
                    <button type="button" onClick={() => openRecommendation(item)}>
                      <span><strong>{item.title}</strong><small>{item.author} · {money(item.price)}</small><small>{item.reason}</small></span>
                      <ChevronRight size={16} />
                    </button>
                    <button type="button" className="ai-add-cart" onClick={async () => {
                      try { await onAddToCart(await listingService.get(item.id)); }
                      catch (error) { setMessages((current) => [...current, { role: "assistant", content: apiMessage(error), error: true }]); }
                    }}>Thêm vào giỏ</button>
                  </div>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length === 1 && (
            <div className="ai-quick-questions">
              {quickQuestions.map((question) => (
                <button
                  type="button"
                  key={question}
                  onClick={() => send(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form
            className="ai-assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <textarea
              value={draft}
              maxLength={1200}
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
              }}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Bạn muốn tìm sách gì?"
              aria-label="Câu hỏi cho trợ lý BookMarket"
            />
            <button
              type="submit"
              aria-label="Gửi câu hỏi"
              disabled={!draft.trim() || loading}
            >
              <Send size={18} />
            </button>
          </form>
          <p className="ai-assistant-note">
            Giá và tình trạng sách lấy từ tin đăng đang bán. Trợ lý không đặt hàng giúp bạn.
          </p>
        </section>
      )}

      <button
        className="ai-assistant-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Đóng trợ lý AI" : "Mở trợ lý AI"}
        aria-expanded={open}
      >
        {open ? <X size={24} /> : <MessageCircle size={25} />}
        {!open && <span>Hỏi AI</span>}
      </button>
    </aside>
  );
}
