// File này gửi HTTP, quản lý JWT và đổi lỗi API thành Error cho giao diện.
export const apiBaseUrl = import.meta.env.VITE_API_URL || "/api";

const tokenKey = "bookmarket-v1-token";

export function getToken() {
  // Khách vẫn xem được sách khi trình duyệt chặn quyền truy cập storage.
  try {
    return localStorage.getItem(tokenKey);
  } catch {
    return null;
  }
}

export function saveToken(token) {
  try {
    if (token) {
      localStorage.setItem(tokenKey, token);
    } else {
      localStorage.removeItem(tokenKey);
    }
  } catch {
    throw new Error(
      "Trình duyệt không cho lưu token. Hãy cho phép lưu dữ liệu rồi đăng nhập lại.",
    );
  }
}

export async function api(path, options = {}) {
  const { _rawBody, ...requestOptions } = options;
  const headers = { ...options.headers };
  const token = getToken();

  if (token) {
    headers.Authorization = "Bearer " + token;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(apiBaseUrl + path, {
      ...requestOptions,
      headers,
      credentials: "omit",
      body:
        _rawBody !== undefined
          ? _rawBody
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(
      "Không kết nối được API. Hãy kiểm tra backend rồi thử lại.",
    );
  }

  if (response.status === 204) {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error(
      response.status >= 500
        ? "API đang tạm thời gián đoạn. Vui lòng thử lại."
        : "API không trả JSON hợp lệ. Hãy kiểm tra địa chỉ máy chủ.",
    );
    error.status = response.status;
    error.retryable = true;
    throw error;
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      token &&
      path !== "/auth/login" &&
      path !== "/auth/register" &&
      path !== "/admin/auth/login"
    ) {
      saveToken(null);
      window.dispatchEvent(new Event("bookmarket-auth-expired"));
    }
    const error = new Error(data.message || "Không thực hiện được yêu cầu.");
    error.status = response.status;
    error.listingId = data.listingId;
    throw error;
  }

  return data;
}

export async function fileRequest(path) {
  const headers = {};
  const token = getToken();
  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  let response;
  try {
    response = await fetch(apiBaseUrl + path, {
      headers,
      credentials: "omit",
    });
  } catch {
    throw new Error(
      "Không kết nối được API. Hãy kiểm tra backend rồi thử lại.",
    );
  }

  if (!response.ok) {
    let message = "Không mở được ebook.";
    try {
      message = (await response.json()).message || message;
    } catch {}
    if (response.status === 401 && token) {
      saveToken(null);
      window.dispatchEvent(new Event("bookmarket-auth-expired"));
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.blob();
}

export function apiMessage(error) {
  return error.message || "Không thực hiện được yêu cầu. Vui lòng thử lại.";
}
