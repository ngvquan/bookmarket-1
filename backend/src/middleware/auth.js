// JWT chỉ ra loại tài khoản; quyền được xác nhận bằng collection tương ứng trong DB.
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
export async function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Bạn cần đăng nhập.",
    });
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.",
    });
  }
  if (
    typeof payload.id !== "string" ||
    !/^[a-f0-9]{24}$/i.test(payload.id) ||
    !["user", "admin"].includes(payload.accountType)
  ) {
    return res.status(401).json({
      message: "Phiên cũ không còn hợp lệ. Hãy đăng nhập lại.",
    });
  }
  let account;
  if (payload.accountType === "admin") {
    account = await Admin.findById(payload.id);
  } else {
    account = await User.findById(payload.id);
  }
  if (!account) {
    return res.status(401).json({
      message: "Tài khoản không còn tồn tại.",
    });
  }
  req.user = account;
  req.accountType = payload.accountType;
  next();
}
export function requireAdmin(req, res, next) {
  if (req.accountType !== "admin") {
    return res.status(403).json({
      message: "Chỉ quản trị viên được thực hiện thao tác này.",
    });
  }
  next();
}

// Admin chỉ quản trị; không dùng token admin để tạo shop hoặc tin bán của khách hàng.
export function requireUser(req, res, next) {
  if (req.accountType !== "user") {
    return res.status(403).json({
      message: "Hãy dùng tài khoản người dùng cho chức năng mua/bán.",
    });
  }
  next();
}
