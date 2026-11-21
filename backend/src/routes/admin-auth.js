// Admin đăng nhập riêng; không cung cấp route đăng ký công khai.
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { checkCredentials } from "../utils/credentials.js";
import { adminResponse } from "../utils/user.js";
import { requireLogin, requireAdmin } from "../middleware/auth.js";
const router = Router();
router.post("/login", async (req, res) => {
  const identifier =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const normalizedBody = {
    ...req.body,
    email: identifier === "admin" ? "admin@bookmarket.local" : identifier,
  };
  const message = checkCredentials(normalizedBody);
  if (message) {
    return res.status(400).json({
      message,
    });
  }
  const admin = await Admin.findOne({
    email: normalizedBody.email,
  }).select("+passwordHash");
  if (
    !admin ||
    !(await bcrypt.compare(req.body.password, admin.passwordHash))
  ) {
    return res.status(401).json({
      message: "Email hoặc mật khẩu quản trị không đúng.",
    });
  }
  const token = jwt.sign(
    {
      id: admin.id,
      accountType: "admin",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      algorithm: "HS256",
    },
  );
  res.json({
    token,
    user: adminResponse(admin),
  });
});
router.get("/me", requireLogin, requireAdmin, (req, res) =>
  res.json({
    user: adminResponse(req.user),
  }),
);
export default router;
