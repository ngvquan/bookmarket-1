import { createHash } from "node:crypto";
import { DigitalOrder, EbookAccess, Listing } from "../src/models/index.js";
import { editionDetails } from "../src/utils/catalog.js";
import { withOrderTransaction } from "../src/utils/order-transaction.js";
// Chỉ là dữ liệu minh họa khi chủ động chạy seed; không nằm trong luồng thanh toán thật.
export async function seedEbookLibrary(reader) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Không seed thư viện ở production.");
  if (await EbookAccess.exists({ buyerId: reader._id })) return;
  const listing = await Listing.findOne({
    type: "digital",
    sellerId: { $ne: reader._id },
    status: "approved",
  }).sort({ _id: 1 });
  if (!listing) return;
  const metadata = await editionDetails(listing.editionId);
  const code =
    "BM" +
    createHash("sha256")
      .update("seed-library:" + reader.id)
      .digest("hex")
      .slice(0, 10)
      .toUpperCase();
  await withOrderTransaction(async (session) => {
    let order = await DigitalOrder.findOne({ transferCode: code }).session(
      session,
    );
    if (!order)
      [order] = await DigitalOrder.create(
        [
          {
            buyerId: reader._id,
            items: [
              {
                listingId: listing.id,
                sellerId: listing.sellerId,
                editionId: listing.editionId,
                title: metadata.title,
                author: metadata.author,
                price: listing.price,
              },
            ],
            total: listing.price,
            status: "paid",
            transferCode: code,
            cartKey: "seed-library",
            expiresAt: new Date(),
            paidAt: new Date(),
            paidAmount: listing.price,
            bankTransactionId: "SEED-LIBRARY-" + reader.id,
          },
        ],
        { session },
      );
    await EbookAccess.updateOne(
      { buyerId: reader._id, listingId: listing.id },
      {
        $setOnInsert: {
          buyerId: reader._id,
          listingId: listing.id,
          editionId: listing.editionId,
          digitalOrderId: order._id,
          grantedAt: new Date(),
        },
      },
      { upsert: true, session },
    );
  });
}
