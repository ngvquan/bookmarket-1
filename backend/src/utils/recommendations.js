import { Book, Edition, Listing } from "../models/index.js";
import { listingResponse } from "./listing.js";

const publicOffer = {
  type: { $in: ["new", "used", "digital"] },
  status: "approved",
  $or: [{ type: { $nin: ["new", "used"] } }, { stock: { $gt: 0 } }],
};

async function findOffers(editionIds, limit) {
  if (!editionIds.length) return [];
  return Listing.aggregate([
    { $match: { ...publicOffer, editionId: { $in: editionIds } } },
    { $sort: { price: 1, _id: 1 } },
    {
      $group: {
        _id: {
          $cond: [{ $in: ["$type", ["new", "used"]] }, "$editionId", "$_id"],
        },
        listing: { $first: "$$ROOT" },
        offerCount: { $sum: 1 },
      },
    },
    {
      $replaceRoot: {
        newRoot: { $mergeObjects: ["$listing", { offerCount: "$offerCount" }] },
      },
    },
    { $sort: { createdAt: -1, _id: 1 } },
    { $limit: limit },
  ]);
}

async function format(rows) {
  const items = [];
  for (const row of rows) {
    const listing = await Listing.findById(row._id);
    if (listing)
      items.push({
        ...(await listingResponse(listing)),
        offerCount: row.offerCount,
      });
  }
  return items;
}

export async function getRecommendations(listing, limit = 6) {
  const edition = await Edition.findById(listing.editionId)
    .select("bookId")
    .populate({ path: "bookId", select: "authorIds categoryId" });
  if (!edition?.bookId) return { sameAuthor: [], sameCategory: [] };
  const source = edition.bookId;
  const books = await Book.find({
    $or: [
      { authorIds: { $in: source.authorIds } },
      { categoryId: source.categoryId },
    ],
  })
    .select("authorIds categoryId")
    .lean();
  const authorBooks = new Set(
    books
      .filter((book) =>
        book.authorIds.some((id) =>
          source.authorIds.some((sourceId) => String(sourceId) === String(id)),
        ),
      )
      .map((book) => String(book._id)),
  );
  const categoryBooks = new Set(
    books
      .filter(
        (book) =>
          String(book.categoryId) === String(source.categoryId) &&
          !authorBooks.has(String(book._id)),
      )
      .map((book) => String(book._id)),
  );
  const editions = await Edition.find({
    bookId: { $in: [...authorBooks, ...categoryBooks] },
  })
    .select("bookId")
    .lean();
  const sameAuthorIds = [],
    sameCategoryIds = [];
  for (const item of editions) {
    if (String(item._id) === String(listing.editionId)) continue;
    (authorBooks.has(String(item.bookId))
      ? sameAuthorIds
      : sameCategoryIds
    ).push(item._id);
  }
  const [authorRows, categoryRows] = await Promise.all([
    findOffers(sameAuthorIds, limit),
    findOffers(sameCategoryIds, limit),
  ]);
  const [sameAuthor, sameCategory] = await Promise.all([
    format(authorRows),
    format(categoryRows),
  ]);
  return { sameAuthor, sameCategory };
}
