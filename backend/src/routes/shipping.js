// Cùng nguồn cấu hình với tính tiền để frontend không ghi cứng phí giao.
import { Router } from "express";
import { shippingServices } from "../utils/shipping.js";
const router = Router();
router.get("/services", (req, res) => {
  const items = [];
  for (const id of Object.keys(shippingServices))
    items.push({ id, ...shippingServices[id] });
  res.json({ items });
});
export default router;
