// Đăng ký/đăng nhập bằng một JWT 7 ngày; không dùng cookie hay refresh token.
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { userResponse, adminResponse } from "../utils/user.js";
import { checkCredentials } from "../utils/credentials.js";
const router = Router();
router.post("/register", async (req, res) => {
  const message = checkCredentials(req.body);
  if (message) {
    return res.status(400).json({
      message,
    });
  }
  if (
    typeof req.body.name !== "string" ||
    !req.body.name.trim() ||
    req.body.name.trim().length > 100
  ) {
    return res.status(400).json({
      message: "Tên cần từ 1 đến 100 ký tự.",
    });
  }
  if (req.body.role !== undefined) {
    return res.status(400).json({
      message: "Không được chỉ định role khi đăng ký.",
    });
  }
  const email = req.body.email.trim().toLowerCase();
  if (
    await User.exists({
      email,
    })
  ) {
    return res.status(409).json({
      message: "Email đã được sử dụng.",
    });
  }
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({
    name: req.body.name.trim(),
    email,
    passwordHash,
  });
  const token = jwt.sign(
    {
      id: String(user._id),
      accountType: "user",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      algorithm: "HS256",
    },
  );
  res.status(201).json({
    token,
    user: await userResponse(user),
  });
});
router.post("/login", async (req, res) => {
  const message = checkCredentials(req.body);
  if (message) {
    return res.status(400).json({
      message,
    });
  }
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({
    email,
  }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    return res.status(401).json({
      message: "Email hoặc mật khẩu không đúng.",
    });
  }
  const token = jwt.sign(
    {
      id: String(user._id),
      accountType: "user",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      algorithm: "HS256",
    },
  );
  res.json({
    token,
    user: await userResponse(user),
  });
});
router.get("/me", requireLogin, async (req, res) => {
  res.json({
    user:
      req.accountType === "admin"
        ? adminResponse(req.user)
        : await userResponse(req.user),
  });
});

router.patch("/profile", requireLogin, requireUser, async (req, res) => {
  if (
    !req.body ||
    Object.keys(req.body).some((key) => key !== "name") ||
    typeof req.body.name !== "string" ||
    !req.body.name.trim() ||
    req.body.name.trim().length > 100
  ) {
    return res.status(400).json({ message: "Tên cần từ 1 đến 100 ký tự." });
  }
  req.user.name = req.body.name.trim();
  await req.user.save();
  res.json({ user: await userResponse(req.user) });
});

router.post("/addresses", requireLogin, requireUser, async (req, res) => {
  const data = readAddress(req.body);
  if (data.message) return res.status(400).json({ message: data.message });
  const duplicate = req.user.addresses.find(
    (item) => addressKey(item) === addressKey(data.value),
  );
  if (duplicate)
    return res.json({
      user: await userResponse(req.user),
      addressId: String(duplicate._id),
      duplicate: true,
    });
  if (req.user.addresses.length >= 3)
    return res
      .status(409)
      .json({
        message: "Bạn đã lưu tối đa 3 địa chỉ. Hãy xóa hoặc sửa địa chỉ cũ.",
      });
  if (data.value.isDefault || req.user.addresses.length === 0)
    req.user.addresses.forEach((item) => {
      item.isDefault = false;
    });
  req.user.addresses.push({
    ...data.value,
    isDefault: data.value.isDefault || req.user.addresses.length === 0,
  });
  await req.user.save();
  const saved = req.user.addresses.at(-1);
  res
    .status(201)
    .json({ user: await userResponse(req.user), addressId: String(saved._id) });
});

router.patch("/addresses/:id", requireLogin, requireUser, async (req, res) => {
  const address = req.user.addresses.id(req.params.id);
  if (!address)
    return res.status(404).json({ message: "Không tìm thấy địa chỉ." });
  const data = readAddress(req.body);
  if (data.message) return res.status(400).json({ message: data.message });
  if (data.value.isDefault)
    req.user.addresses.forEach((item) => {
      item.isDefault = false;
    });
  Object.assign(address, data.value);
  // Luôn giữ ít nhất một địa chỉ mặc định để bước đặt hàng tự chọn đúng địa chỉ.
  if (!req.user.addresses.some((item) => item.isDefault))
    address.isDefault = true;
  await req.user.save();
  res.json({ user: await userResponse(req.user) });
});

router.delete("/addresses/:id", requireLogin, requireUser, async (req, res) => {
  const address = req.user.addresses.id(req.params.id);
  if (!address)
    return res.status(404).json({ message: "Không tìm thấy địa chỉ." });
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && req.user.addresses.length)
    req.user.addresses[0].isDefault = true;
  await req.user.save();
  res.json({ user: await userResponse(req.user) });
});

router.put(
  "/favorites/:listingId",
  requireLogin,
  requireUser,
  async (req, res) => {
    const id = req.params.listingId;
    if (
      typeof id !== "string" ||
      !id ||
      id.length > 200 ||
      !(await Listing.exists({ _id: id }))
    )
      return res
        .status(404)
        .json({ message: "Không tìm thấy sách để yêu thích." });
    if (!req.user.favorites.includes(id)) {
      if (req.user.favorites.length >= 500)
        return res.status(409).json({ message: "Danh sách yêu thích đã đầy." });
      req.user.favorites.push(id);
      await req.user.save();
    }
    res.json({ favorites: [...req.user.favorites] });
  },
);

router.delete(
  "/favorites/:listingId",
  requireLogin,
  requireUser,
  async (req, res) => {
    req.user.favorites = req.user.favorites.filter(
      (id) => id !== req.params.listingId,
    );
    await req.user.save();
    res.json({ favorites: [...req.user.favorites] });
  },
);

function readAddress(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Object.keys(body).some(
      (key) =>
        !["label", "receiverName", "phone", "address", "isDefault"].includes(
          key,
        ),
    )
  )
    return { message: "Thông tin địa chỉ không hợp lệ." };
  const value = {
    label: typeof body.label === "string" ? body.label.trim() : "",
    receiverName:
      typeof body.receiverName === "string" ? body.receiverName.trim() : "",
    phone: typeof body.phone === "string" ? body.phone.trim() : "",
    address: typeof body.address === "string" ? body.address.trim() : "",
    isDefault: body.isDefault === true,
  };
  if (!value.label || value.label.length > 50)
    return { message: "Tên địa chỉ cần từ 1 đến 50 ký tự." };
  if (!value.receiverName || value.receiverName.length > 120)
    return { message: "Tên người nhận không hợp lệ." };
  if (!/^[0-9+ ]{9,15}$/.test(value.phone) || !/[0-9]/.test(value.phone))
    return { message: "Số điện thoại không hợp lệ." };
  if (!value.address || value.address.length > 1000)
    return { message: "Địa chỉ nhận hàng không hợp lệ." };
  return { value };
}
function addressKey(value) {
  return [value.receiverName, value.phone, value.address]
    .map((item) => String(item).trim().toLowerCase())
    .join("|");
}
export default router;
