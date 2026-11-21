import { useEffect, useState } from "react";
import { digitalOrderService, apiMessage } from "../services/api.js";
import { useLocation } from "react-router-dom";
// Gắn dữ liệu với tài khoản để không hiện thư viện cũ khi đổi người dùng.
export default function useEbookLibrary(profile) {
  const { pathname } = useLocation();
  const [data, setData] = useState({ owner: null, items: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function refresh() {
    if (!profile || profile.role === "admin") return;
    setLoading(true);
    setError("");
    try {
      const result = await digitalOrderService.library();
      setData({ owner: profile.id, items: result.items });
      return result.items;
    } catch (error) {
      setError(apiMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    setError("");
    setLoading(!!profile && profile.role !== "admin");
    if (profile && profile.role !== "admin")
      digitalOrderService
        .library()
        .then((result) => {
          if (active) setData({ owner: profile.id, items: result.items });
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
  }, [profile?.id, profile?.role, pathname]);
  return {
    ownedBooks: data.owner === profile?.id ? data.items : [],
    refreshLibrary: refresh,
    libraryLoading: loading,
    libraryError: error,
  };
}
