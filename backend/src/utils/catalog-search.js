// Tìm ID phiên bản theo metadata ở các collection đã tách; handler listings dùng các ID này để phân trang.
import {
  Author,
  Publisher,
  Category,
  Book,
  Edition,
  User,
  Shop,
} from "../models/index.js";
import { normalize, escapeRegex } from "./text.js";
export async function catalogFilters(query) {
  const bookFilter = {};
  if (query.title?.trim()) {
    bookFilter.titleSearch = {
      $regex: escapeRegex(normalize(query.title.trim())),
    };
  }
  if (query.author?.trim()) {
    const authors = await Author.find({
      nameSearch: {
        $regex: escapeRegex(normalize(query.author.trim())),
      },
    }).select("_id");
    bookFilter.authorIds = {
      $in: authors.map((author) => author._id),
    };
  }
  if (query.category && query.category !== "Tất cả") {
    const category = await Category.findOne({
      nameSearch: normalize(query.category),
    });
    bookFilter.categoryId = category?._id || null;
  }
  const editionFilter = {};
  if (Object.keys(bookFilter).length) {
    const books = await Book.find(bookFilter).select("_id");
    editionFilter.bookId = {
      $in: books.map((book) => book._id),
    };
  }
  if (query.publisher?.trim()) {
    const publishers = await Publisher.find({
      nameSearch: {
        $regex: escapeRegex(normalize(query.publisher.trim())),
      },
    }).select("_id");
    editionFilter.publisherId = {
      $in: publishers.map((publisher) => publisher._id),
    };
  }
  if (query.binding) {
    editionFilter.binding = query.binding;
  }
  const term = query.q?.trim();
  let isbn = query.isbn?.trim();
  const numericTerm = term && /^[\d\s-]+[xX]?$/.test(term);
  if (!isbn && numericTerm) {
    isbn = term;
  }
  if (isbn) {
    const prefix = isbn.replace(/[\s-]/g, "").toUpperCase();
    if (!/^\d{3,13}X?$/.test(prefix)) {
      return {
        editions: [],
        general: null,
      };
    }
    editionFilter.isbn = {
      $regex: "^" + escapeRegex(prefix),
      $options: "i",
    };
  }
  let editions = null;
  if (Object.keys(editionFilter).length) {
    editions = (await Edition.find(editionFilter).select("_id")).map(
      (edition) => edition._id,
    );
  }
  let general = null;
  if (term && !numericTerm) {
    const expression = {
      $regex: escapeRegex(normalize(term)),
    };
    const authors = await Author.find({
      nameSearch: expression,
    }).select("_id");
    const publishers = await Publisher.find({
      nameSearch: expression,
    }).select("_id");
    const books = await Book.find({
      $or: [
        {
          titleSearch: expression,
        },
        {
          authorIds: {
            $in: authors.map((author) => author._id),
          },
        },
      ],
    }).select("_id");
    const matches = await Edition.find({
      $or: [
        {
          bookId: {
            $in: books.map((book) => book._id),
          },
        },
        {
          publisherId: {
            $in: publishers.map((publisher) => publisher._id),
          },
        },
      ],
    }).select("_id");
    const users = await User.find({
      name: {
        $regex: escapeRegex(term),
        $options: "i",
      },
    }).select("_id");
    const shops = await Shop.find({
      name: {
        $regex: escapeRegex(term),
        $options: "i",
      },
    }).select("ownerId");
    general = {
      $or: [
        {
          editionId: {
            $in: matches.map((edition) => edition._id),
          },
        },
        {
          sellerId: {
            $in: [
              ...users.map((user) => user._id),
              ...shops.map((shop) => shop.ownerId),
            ],
          },
        },
      ],
    };
  }
  return {
    editions,
    general,
  };
}
