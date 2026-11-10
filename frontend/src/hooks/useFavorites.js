// Hook này đồng bộ sách yêu thích và chống gửi trùng request cho cùng một sách.
import { useEffect, useRef, useState } from "react";
import { apiMessage, profileService } from "../services/api.js";

export default function useFavorites({ profile, setProfile, notify }) {
  const [favorites, setFavorites] = useState([]);
  const pendingRequests = useRef(new Set());

  useEffect(() => {
    const savedFavorites =
      profile?.role === "user" ? profile.favorites || [] : [];
    setFavorites(savedFavorites);
  }, [profile?.id, profile?.favorites?.join(",")]);

  async function toggleFavorite(id) {
    if (!profile || profile.role === "admin") {
      notify("Đăng nhập tài khoản người dùng để lưu sách yêu thích.");
      return;
    }
    if (pendingRequests.current.has(id)) {
      return;
    }

    const adding = !favorites.includes(id);
    pendingRequests.current.add(id);
    setFavorites((current) =>
      adding
        ? [...new Set([...current, id])]
        : current.filter((value) => value !== id),
    );

    try {
      const saved = await (adding
        ? profileService.addFavorite(id)
        : profileService.removeFavorite(id));
      setFavorites(saved);
      setProfile((current) =>
        current?.id === profile.id ? { ...current, favorites: saved } : current,
      );
    } catch (error) {
      setFavorites((current) =>
        adding
          ? current.filter((value) => value !== id)
          : [...new Set([...current, id])],
      );
      notify(apiMessage(error));
    } finally {
      pendingRequests.current.delete(id);
    }
  }

  return { favorites, toggleFavorite };
}
