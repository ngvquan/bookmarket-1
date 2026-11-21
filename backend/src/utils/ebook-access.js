import { EbookAccess, Listing } from "../models/index.js";
export async function hasEbookAccess(userId, listingId) {
  if (!userId) return false;
  return !!(
    (await EbookAccess.exists({ buyerId: userId, listingId })) ||
    (await Listing.exists({
      _id: listingId,
      type: "digital",
      sellerId: userId,
    }))
  );
}
