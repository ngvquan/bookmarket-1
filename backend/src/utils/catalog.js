// Tạo/liên kết tác giả, tác phẩm và phiên bản; không thay thông tin dùng chung của seller khác.
import {
  Author,
  Publisher,
  Category,
  Book,
  Edition,
  Listing,
} from "../models/index.js";
import { normalize, escapeRegex } from "./text.js";

// Đọc quan hệ rồi trả metadata phẳng để giao diện hiện tại tiếp tục sử dụng.
export async function editionDetails(id, session = null) {
  const edition = await Edition.findById(id)
    .session(session)
    .populate("publisherId")
    .populate({
      path: "bookId",
      populate: [
        {
          path: "authorIds",
        },
        {
          path: "categoryId",
        },
      ],
    });
  if (!edition || !edition.bookId || !edition.bookId.categoryId) {
    throw new Error("Thiếu liên kết phiên bản/tác phẩm.");
  }
  const book = edition.bookId;
  return {
    editionId: String(edition._id),
    bookId: String(book._id),
    authorIds: book.authorIds.map((author) => String(author._id)),
    categoryId: String(book.categoryId._id),
    publisherId: edition.publisherId ? String(edition.publisherId._id) : null,
    title: book.title,
    author: book.authorIds.map((author) => author.name).join("; "),
    category: book.categoryId.name,
    isbn: edition.isbn || "",
    publisher: edition.publisherId?.name || "",
    year: edition.year,
    binding: edition.binding,
  };
}

// So sánh metadata, không so sánh giá/tình trạng vì các trường đó thuộc riêng từng offer.
function sameMetadata(current, data) {
  const currentAuthors = current.author
    .split(";")
    .map((name) => normalize(name.trim()))
    .sort()
    .join(";");
  const nextAuthors = data.author
    .split(";")
    .map((name) => normalize(name.trim()))
    .sort()
    .join(";");
  return (
    normalize(current.title) === normalize(data.title) &&
    currentAuthors === nextAuthors &&
    normalize(current.category) === normalize(data.category) &&
    normalize(current.publisher) === normalize(data.publisher) &&
    current.year === data.year &&
    current.binding === data.binding
  );
}

// ISBN đã có thì tái sử dụng đúng phiên bản; metadata sai trả 409 thay vì sửa sách của người khác.
export async function resolveEdition(data, currentEditionId = null) {
  data = { ...data };
  let existing = null;
  if (data.isbn) {
    existing = await Edition.findOne({
      isbn: data.isbn,
    });
  }
  // Form không chọn loại bìa: giữ metadata của ISBN có sẵn, dùng mặc định cho bản mới.
  data.binding ??= existing?.binding || "Bìa mềm";
  if (existing) {
    const details = await editionDetails(existing._id);
    if (sameMetadata(details, data)) {
      return existing._id;
    }
    const sameCurrent =
      currentEditionId && String(existing._id) === String(currentEditionId);
    const otherOffer = await Listing.exists({
      editionId: existing._id,
      ...(sameCurrent
        ? {
            _id: {
              $ne: data.listingId,
            },
          }
        : {}),
    });
    if (!sameCurrent || otherOffer) {
      const error = new Error(
        "ISBN này thuộc một phiên bản đã có. Hãy dùng đúng metadata; không thể đổi thông tin chung của tin người khác.",
      );
      error.status = 409;
      throw error;
    }
  }
  if (!data.isbn && currentEditionId) {
    const current = await editionDetails(currentEditionId);
    if (!current.isbn && sameMetadata(current, data)) {
      return currentEditionId;
    }
  }
  const authorIds = [];
  const names = data.author
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length || names.length > 10) {
    const error = new Error(
      "Cần từ 1 đến 10 tác giả, phân cách bằng dấu chấm phẩy.",
    );
    error.status = 400;
    throw error;
  }
  for (const name of names) {
    const author = await Author.findOneAndUpdate(
      {
        nameSearch: normalize(name),
      },
      {
        $setOnInsert: {
          name,
          nameSearch: normalize(name),
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
    if (!authorIds.some((id) => String(id) === String(author._id))) {
      authorIds.push(author._id);
    }
  }
  const category = await Category.findOneAndUpdate(
    {
      nameSearch: normalize(data.category),
    },
    {
      $setOnInsert: {
        name: data.category,
        nameSearch: normalize(data.category),
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
  let publisher = null;
  if (data.publisher) {
    publisher = await Publisher.findOneAndUpdate(
      {
        nameSearch: normalize(data.publisher),
      },
      {
        $setOnInsert: {
          name: data.publisher,
          nameSearch: normalize(data.publisher),
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
  }
  const catalogKey = JSON.stringify([
    normalize(data.title),
    authorIds.map(String).sort(),
    String(category._id),
  ]);
  const book = await Book.findOneAndUpdate(
    {
      catalogKey,
    },
    {
      $setOnInsert: {
        title: data.title,
        titleSearch: normalize(data.title),
        authorIds,
        categoryId: category._id,
        catalogKey,
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
  if (existing) {
    existing.bookId = book._id;
    existing.publisherId = publisher?._id || null;
    existing.year = data.year;
    existing.binding = data.binding;
    await existing.save();
    return existing._id;
  }
  // Chỉ còn dùng cho dữ liệu legacy/internal; API tạo tin mới đã bắt buộc ISBN.
  const edition = await Edition.create({
    bookId: book._id,
    isbn: data.isbn || undefined,
    publisherId: publisher?._id || null,
    year: data.year,
    binding: data.binding,
  });
  return edition._id;
}

// Gợi ý phiên bản đã có; người bán chọn ISBN, backend vẫn tự resolve lại khi lưu.
export async function suggestEditions({
  isbn = "",
  title = "",
  author = "",
  type = "used",
}) {
  const cleanIsbn = isbn.replace(/[\s-]/g, "").toUpperCase();
  const editionFilter = { isbn: { $exists: true, $ne: "" } };
  if (type === "digital") editionFilter.binding = "PDF";
  else editionFilter.binding = { $ne: "PDF" };
  let editions = [];
  if (cleanIsbn) {
    if (!/^[0-9X]{2,13}$/.test(cleanIsbn)) return [];
    editions = await Edition.find({
      ...editionFilter,
      isbn: { $regex: "^" + escapeRegex(cleanIsbn) },
    })
      .sort({ isbn: 1 })
      .limit(5);
  } else {
    const titleSearch = normalize(title).trim().replace(/\s+/g, " ");
    if (titleSearch.length < 2) return [];
    const bookFilter = {
      titleSearch: { $regex: "^" + escapeRegex(titleSearch) },
    };
    const authorSearch = normalize(author).trim().replace(/\s+/g, " ");
    if (authorSearch) {
      const authors = await Author.find({
        nameSearch: { $regex: "^" + escapeRegex(authorSearch) },
      })
        .select("_id")
        .limit(20);
      if (!authors.length) return [];
      bookFilter.authorIds = { $in: authors.map((item) => item._id) };
    }
    const books = await Book.find(bookFilter)
      .select("_id")
      .sort({ titleSearch: 1 })
      .limit(20);
    editions = await Edition.find({
      ...editionFilter,
      bookId: { $in: books.map((item) => item._id) },
    })
      .sort({ isbn: 1 })
      .limit(5);
  }
  const items = [];
  for (const edition of editions) {
    const details = await editionDetails(edition._id);
    const offerCount = await Listing.countDocuments({
      editionId: edition._id,
      type: { $in: ["new", "used"] },
      status: "approved",
      stock: { $gt: 0 },
    });
    items.push({ ...details, offerCount });
  }
  return items;
}

// Chỉ các field của offer được lưu trong listings.
export function offerFields(data) {
  return {
    type: data.type,
    price: data.price,
    stock: data.stock,
    condition: data.condition,
    description: data.description,
    location: data.location || "Việt Nam",
  };
}
