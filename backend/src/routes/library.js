import { Router } from "express";
import { EbookAccess, Listing } from "../models/index.js";
import { requireLogin, requireUser } from "../middleware/auth.js";
import { listingResponse } from "../utils/listing.js";
import { editionDetails } from "../utils/catalog.js";
const router = Router();
router.get("/", requireLogin, requireUser, async (req, res) => {
  const access = await EbookAccess.find({ buyerId: req.user.id }).sort({
    grantedAt: -1,
    _id: -1,
  });
  const listings = await Listing.find({
    _id: { $in: access.map((entry) => entry.listingId) },
  });
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const items = [];
  for (const entry of access) {
    const listing = listingById.get(entry.listingId);
    // Tin có thể đã bị gỡ trước khi tiền về; quyền vẫn gắn với phiên bản khách đã trả tiền.
    const details = await editionDetails(entry.editionId);
    const current = listing
      ? await listingResponse(listing)
      : { id: entry.listingId, shop: "Tin đã gỡ", price: 0 };
    items.push({
      ...current,
      ...details,
      type: "digital",
      grantedAt: entry.grantedAt,
    });
  }
  res.json({ items });
});
export default router;
