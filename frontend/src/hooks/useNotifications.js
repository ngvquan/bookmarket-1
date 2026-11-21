import { useCallback, useEffect, useRef, useState } from "react";
import { apiMessage, notificationService } from "../services/api.js";

export default function useNotifications(profile, showToast) {
  const [data, setData] = useState({ items: [], total: 0, unread: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef("");
  const owner = useRef("");
  const toast = useRef(showToast);
  toast.current = showToast;
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!profile || profile.role === "admin") return;
      if (!silent) setLoading(true);
      try {
        const result = await notificationService.list({ page: 1, limit: 50 });
        const firstId = result.items[0]?.id || "";
        if (
          owner.current === profile.id &&
          latest.current &&
          firstId &&
          firstId !== latest.current
        ) {
          const fresh = result.items.find((item) => item.id === firstId);
          if (fresh) toast.current(fresh.title);
        }
        owner.current = profile.id;
        latest.current = firstId;
        setData(result);
        setError("");
      } catch (error) {
        if (!silent) setError(apiMessage(error));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [profile?.id, profile?.role],
  );
  useEffect(() => {
    latest.current = "";
    owner.current = profile?.id || "";
    if (!profile || profile.role === "admin") {
      setData({ items: [], total: 0, unread: 0 });
      return;
    }
    load();
    // Polling đơn giản, phù hợp đồ án: shop nhận thông báo đơn mới trong tối đa khoảng 5 giây.
    const timer = setInterval(() => load({ silent: true }), 5000);
    return () => clearInterval(timer);
  }, [profile?.id, profile?.role, load]);
  async function read(id) {
    await notificationService.read(id);
    setData((current) => ({
      ...current,
      unread: Math.max(
        0,
        current.unread -
          (current.items.find((item) => item.id === id && !item.readAt)
            ? 1
            : 0),
      ),
      items: current.items.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    }));
  }
  async function readAll() {
    await notificationService.readAll();
    setData((current) => ({
      ...current,
      unread: 0,
      items: current.items.map((item) => ({
        ...item,
        readAt: item.readAt || new Date().toISOString(),
      })),
    }));
  }
  return { ...data, loading, error, refresh: load, read, readAll };
}
