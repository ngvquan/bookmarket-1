// File này gom các service nghiệp vụ mà component dùng để gọi API BookMarket.
import { initialBooks } from "../data/books.js";
import { extraBookPresentation } from "../data/extraBooks.js";
import extraCovers from "../data/extraCovers.json";
import {
  api,
  apiBaseUrl,
  apiMessage,
  fileRequest,
  getToken,
  saveToken,
} from "./http.js";

export { api, apiMessage, getToken, saveToken } from "./http.js";

// Bìa mẫu thuộc frontend; đánh giá thật được lấy riêng từ /reviews.
function presentListing(listing) {
  const source =
    initialBooks.find((book) => book.id === listing.id) ||
    (listing.id.startsWith("offer-b2-")
      ? initialBooks.find((book) => book.id === "b2")
      : null) ||
    extraBookPresentation(listing.id);
  const images = (listing.imageIds || []).map((imageId) => ({
    id: imageId,
    url: `${apiBaseUrl}/listings/${encodeURIComponent(listing.id)}/images/${encodeURIComponent(imageId)}`,
  }));
  return {
    ...listing,
    images,
    style: source?.style || "peace",
    coverTitle: source?.coverTitle || listing.title,
    coverUrl: images[0]?.url || extraCovers[source?.slug] || listing.coverUrl,
    subtitle: source?.subtitle,
  };
}
export const reviewService = {
  list(listingId, page = 1) {
    return api("/reviews?" + new URLSearchParams({ listingId, page }));
  },
  eligibility(listingId) {
    return api("/reviews/eligibility?" + new URLSearchParams({ listingId }));
  },
  create(body) {
    return api("/reviews", { method: "POST", body });
  },
  shopList(params = {}) {
    return api("/reviews/shop?" + new URLSearchParams(params));
  },
  reply(id, text) {
    return api(`/reviews/${encodeURIComponent(id)}/reply`, {
      method: "PUT",
      body: { text },
    });
  },
  removeReply(id) {
    return api(`/reviews/${encodeURIComponent(id)}/reply`, {
      method: "DELETE",
    });
  },
};
export const digitalOrderService = {
  create(listingIds) {
    return api("/digital-orders", { method: "POST", body: { listingIds } });
  },
  status(id) {
    return api(`/digital-orders/${encodeURIComponent(id)}/status`);
  },
  cancel(id) {
    return api(`/digital-orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });
  },
  mine(params = {}) {
    return api("/digital-orders/mine?" + new URLSearchParams(params));
  },
  async library() {
    const result = await api("/library");
    return { items: result.items.map(presentListing) };
  },
  admin(params = {}) {
    return api("/admin/digital-orders?" + new URLSearchParams(params));
  },
  bankTransactions(params = {}) {
    return api("/admin/bank-transactions?" + new URLSearchParams(params));
  },
  markPaid(id, body) {
    return api(`/admin/digital-orders/${encodeURIComponent(id)}/mark-paid`, {
      method: "PATCH",
      body,
    });
  },
};
export const chatService = {
  start(body) {
    return api("/conversations", { method: "POST", body });
  },
  list(role, page = 1, signal) {
    return api(`/conversations?role=${role}&page=${page}`, { signal });
  },
  unread() {
    return api("/conversations/unread");
  },
  messages(id, query = {}, signal) {
    return api(
      `/conversations/${encodeURIComponent(id)}/messages?${new URLSearchParams(query)}`,
      { signal },
    );
  },
  send(id, body) {
    return api(`/conversations/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      body,
    });
  },
  read(id, through, signal) {
    return api(`/conversations/${encodeURIComponent(id)}/read`, {
      method: "POST",
      body: { through },
      signal,
    });
  },
};
export const authService = {
  async restore() {
    if (!getToken()) {
      return null;
    }
    try {
      return await authService.me();
    } catch (error) {
      if (error.status === 401) {
        return null;
      }
      throw error;
    }
  },
  async authenticate({ register, admin, name, email, password }) {
    const path = admin
      ? "/admin/auth/login"
      : register
        ? "/auth/register"
        : "/auth/login";
    const body = register
      ? {
          name,
          email,
          password,
        }
      : {
          email,
          password,
        };
    const data = await api(path, {
      method: "POST",
      body,
    });
    saveToken(data.token);
    return await authService.me();
  },
  async me() {
    return (await api("/auth/me")).user;
  },
  logout() {
    saveToken(null);
  },
};
export const profileService = {
  async updateName(name) {
    return (await api("/auth/profile", { method: "PATCH", body: { name } }))
      .user;
  },
  async addAddress(address) {
    return (await api("/auth/addresses", { method: "POST", body: address }))
      .user;
  },
  async updateAddress(id, address) {
    return (
      await api(`/auth/addresses/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: address,
      })
    ).user;
  },
  async removeAddress(id) {
    return (
      await api(`/auth/addresses/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    ).user;
  },
  async addFavorite(id) {
    return (
      await api(`/auth/favorites/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: {},
      })
    ).favorites;
  },
  async removeFavorite(id) {
    return (
      await api(`/auth/favorites/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    ).favorites;
  },
};
export const notificationService = {
  list(params = {}) {
    return api("/notifications?" + new URLSearchParams(params));
  },
  read(id) {
    return api(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    });
  },
  readAll() {
    return api("/notifications/read-all", { method: "PATCH" });
  },
};
export const listingService = {
  async suggestions(params = {}) {
    return (await api("/listings/suggestions?" + new URLSearchParams(params)))
      .items;
  },
  async sellers(params = {}) {
    return await api("/listings/sellers?" + new URLSearchParams(params));
  },
  async get(id) {
    return presentListing(
      (await api("/listings/" + encodeURIComponent(id))).listing,
    );
  },
  async recommendations(id, limit = 3) {
    const data = await api(
      `/listings/${encodeURIComponent(id)}/recommendations?limit=${limit}`,
    );
    return {
      sameAuthor: data.sameAuthor.map(presentListing),
      sameCategory: data.sameCategory.map(presentListing),
    };
  },
  // Mỗi lần lấy đúng một trang; mine/admin là URL có middleware riêng phía server.
  async search(params = {}) {
    let path = "/listings";
    if (params.scope === "mine") {
      path += "/mine";
    }
    if (params.scope === "all") {
      path += "/admin";
    }
    const query = new URLSearchParams();
    for (const key in params) {
      if (key !== "scope" && params[key] !== undefined && params[key] !== "") {
        query.set(key, params[key]);
      }
    }
    const data = await api(path + "?" + query.toString());
    return { ...data, items: data.items.map(presentListing) };
  },
  async save(book, id) {
    const path = id ? "/listings/" + encodeURIComponent(id) : "/listings";
    return presentListing(
      (
        await api(path, {
          method: id ? "PATCH" : "POST",
          body: book,
        })
      ).listing,
    );
  },
  async uploadImage(id, image) {
    return presentListing(
      (
        await api(`/listings/${encodeURIComponent(id)}/images`, {
          method: "POST",
          headers: { "Content-Type": image.type },
          _rawBody: image,
        })
      ).listing,
    );
  },
  async removeImage(id, imageId) {
    return presentListing(
      (
        await api(
          `/listings/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`,
          { method: "DELETE" },
        )
      ).listing,
    );
  },
  async uploadEbook(id, file) {
    return presentListing(
      (
        await api(`/listings/${encodeURIComponent(id)}/ebook`, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          _rawBody: file,
        })
      ).listing,
    );
  },
  async remove(id) {
    await api("/listings/" + encodeURIComponent(id), {
      method: "DELETE",
    });
  },
  async moderate(id, status) {
    return presentListing(
      (
        await api(`/listings/${encodeURIComponent(id)}/moderation`, {
          method: "PATCH",
          body: {
            status,
          },
        })
      ).listing,
    );
  },
  async sold(id) {
    return presentListing(
      (
        await api(`/listings/${encodeURIComponent(id)}/sold`, {
          method: "PATCH",
        })
      ).listing,
    );
  },
  async visibility(id, hidden) {
    return presentListing(
      (
        await api(`/listings/${encodeURIComponent(id)}/visibility`, {
          method: "PATCH",
          body: { hidden },
        })
      ).listing,
    );
  },
};
export const ebookService = {
  preview(id) {
    return fileRequest(`/listings/${encodeURIComponent(id)}/preview`);
  },
  full(id) {
    return fileRequest(`/listings/${encodeURIComponent(id)}/ebook`);
  },
};
export const shopService = {
  async mine() {
    return (await api("/shops")).items[0] || null;
  },
  async save(shop, id) {
    return (
      await api(id ? "/shops/" + id : "/shops", {
        method: id ? "PATCH" : "POST",
        body: shop,
      })
    ).shop;
  },
};

// Đơn giấy lưu server; ebook không gửi tới các API này.
export const orderService = {
  async create(body) {
    return (await api("/orders", { method: "POST", body })).order;
  },
  async mine(params = {}) {
    return api("/orders/mine?" + new URLSearchParams(params));
  },
  async get(id) {
    return (await api("/orders/" + encodeURIComponent(id))).order;
  },
  async cancel(id, reason = "") {
    return (
      await api(`/sub-orders/${encodeURIComponent(id)}/cancel`, {
        method: "PATCH",
        body: { reason },
      })
    ).subOrder;
  },
  async received(id) {
    return (
      await api(`/sub-orders/${encodeURIComponent(id)}/received`, {
        method: "PATCH",
      })
    ).subOrder;
  },
};
export const shopOrderService = {
  async list(params = {}) {
    return api("/sub-orders/shop?" + new URLSearchParams(params));
  },
  async confirm(id) {
    return (
      await api(`/sub-orders/${encodeURIComponent(id)}/confirm`, {
        method: "PATCH",
      })
    ).subOrder;
  },
  async ship(id) {
    return (
      await api(`/sub-orders/${encodeURIComponent(id)}/ship`, {
        method: "PATCH",
      })
    ).subOrder;
  },
  cancel: orderService.cancel,
};
export const adminOrderService = {
  async list(params = {}) {
    return api("/admin/orders?" + new URLSearchParams(params));
  },
  async shipments(params = {}) {
    return api("/admin/sub-orders?" + new URLSearchParams(params));
  },
  async shipping(id, status, note) {
    return (
      await api(`/admin/sub-orders/${encodeURIComponent(id)}/shipping`, {
        method: "PATCH",
        body: { status, note },
      })
    ).subOrder;
  },
};
export const shippingService = {
  async list() {
    const data = await api("/shipping/services");
    if (
      !Array.isArray(data?.items) ||
      !data.items.length ||
      data.items.some(
        (item) =>
          !item ||
          typeof item.id !== "string" ||
          !item.id ||
          typeof item.name !== "string" ||
          !Number.isSafeInteger(item.fee) ||
          item.fee < 0,
      )
    ) {
      throw new Error(
        "Dữ liệu phí giao từ máy chủ không hợp lệ. Vui lòng thử lại.",
      );
    }
    return data.items;
  },
};
