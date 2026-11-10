// Chỉ trả thông tin cần cho UI; không đưa passwordHash vào JSON.
import Shop from "../models/Shop.js";
import { canPublishShopBooks } from "./shop.js";
export function shopResponse(shop) {
  return {
    id: String(shop._id),
    ownerId: String(shop.ownerId),
    sellerId: String(shop.ownerId),
    name: shop.name,
    description: shop.description,
    contactName: shop.contactName || "",
    contactPhone: shop.contactPhone || "",
    contactEmail: shop.contactEmail || "",
    pickupAddress: shop.pickupAddress
      ? {
          province: shop.pickupAddress.province,
          ward: shop.pickupAddress.ward,
          detail: shop.pickupAddress.detail,
        }
      : null,
    registrationCompletedAt: shop.registrationCompletedAt || null,
    isRegistrationComplete: canPublishShopBooks(shop),
  };
}
export async function userResponse(user) {
  const shop = await Shop.findOne({
    ownerId: user._id,
  });
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    addresses: (user.addresses || []).map((address) => ({
      id: String(address._id),
      label: address.label,
      receiverName: address.receiverName,
      phone: address.phone,
      address: address.address,
      isDefault: address.isDefault,
    })),
    favorites: [...(user.favorites || [])],
    role: "user",
    accountType: "user",
    shopId: shop ? String(shop._id) : null,
    shop: shop ? shopResponse(shop) : null,
  };
}

// role ở JSON chỉ tương thích UI; collection admins không cần lưu field role.
export function adminResponse(admin) {
  return {
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
    role: "admin",
    accountType: "admin",
    shopId: null,
    shop: null,
  };
}
