import { useEffect, useRef, useState } from "react";
import { chatService, apiMessage } from "../services/api.js";
import { refreshChat } from "./useChatUnread.js";

const mergeMessages = (old, incoming) =>
  [
    ...new Map([...old, ...incoming].map((item) => [item.id, item])).values(),
  ].sort((a, b) => a.sequence - b.sequence);

export default function useChatThread(id) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const refresh = useRef(() => {});
  const currentId = useRef(id);
  currentId.current = id;
  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setError("");
    setHasOlder(false);
    setLoadingOlder(false);
    if (!id) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    let active = true,
      running = false,
      initialized = false,
      cursor = 0,
      readThrough = 0;
    setBusy(true);
    const load = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        let more;
        do {
          const data = await chatService.messages(
            id,
            initialized ? { after: cursor, limit: 50 } : {},
            controller.signal,
          );
          if (!active) return;
          setConversation(data.conversation);
          setMessages((old) => mergeMessages(old, data.items));
          if (!initialized) setHasOlder(data.hasMore);
          more = initialized && data.hasMore;
          initialized = true;
          cursor = Math.max(
            cursor,
            ...data.items.map((message) => message.sequence),
          );
        } while (more && active);
        if (cursor > readThrough && !document.hidden) {
          await chatService.read(id, cursor, controller.signal);
          if (!active) return;
          readThrough = cursor;
          refreshChat();
        }
        if (active) setError("");
      } catch (error) {
        if (active) setError(apiMessage(error));
      } finally {
        running = false;
        if (active) setBusy(false);
      }
    };
    refresh.current = load;
    load();
    const timer = setInterval(load, 2000);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      refresh.current = () => {};
    };
  }, [id]);
  const addMessage = (message) => {
    setMessages((old) => mergeMessages(old, [message]));
    refresh.current();
    refreshChat();
  };
  const loadOlder = async () => {
    if (loadingOlder || !messages.length || !hasOlder) return;
    setLoadingOlder(true);
    try {
      const data = await chatService.messages(id, {
        before: messages[0].sequence,
      });
      if (currentId.current !== id) return;
      setMessages((old) => mergeMessages(old, data.items));
      setHasOlder(data.hasMore);
      setError("");
    } catch (error) {
      if (currentId.current === id) setError(apiMessage(error));
    } finally {
      if (currentId.current === id) setLoadingOlder(false);
    }
  };
  return {
    conversation,
    messages,
    busy,
    error,
    hasOlder,
    loadingOlder,
    loadOlder,
    addMessage,
    retry: () => refresh.current(),
  };
}
