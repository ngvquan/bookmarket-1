import { useEffect, useState } from "react";
import { chatService } from "../services/api.js";

const empty = { buyer: 0, seller: 0, total: 0 };
export const refreshChat = () =>
  window.dispatchEvent(new Event("bookmarket-chat-update"));
export default function useChatUnread(profile) {
  const [state, setState] = useState({ userId: null, counts: empty });
  useEffect(() => {
    if (!profile || profile.role === "admin") return;
    let active = true,
      busy = false;
    const load = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const counts = await chatService.unread();
        if (active) setState({ userId: profile.id, counts });
      } catch {
        /* Hộp thư hiển thị lỗi kết nối khi mở; badge không chặn trang mua sách. */
      } finally {
        busy = false;
      }
    };
    load();
    const timer = setInterval(load, 5000);
    window.addEventListener("bookmarket-chat-update", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("bookmarket-chat-update", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [profile?.id, profile?.role]);
  return profile && state.userId === profile.id && profile.role !== "admin"
    ? state.counts
    : empty;
}
