// Tải thumbnail từ trang sản phẩm, giữ nguồn và chỉ ánh xạ các ảnh tải thành công.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { extraBooks } from "../src/data/extraBooks.js";
const execute = promisify(execFile);
const normalize = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d");
const slugify = (value) =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const openLibraryTitles = {
  "tat-den": "Tat Den",
  "lao-hac": "Lao Hac",
  "chuong-nguyen-hon-ai": "For Whom the Bell Tolls",
  "ke-truy-tim-dieu": "The Kite Runner",
  "7-thoi-quen-hieu-qua": "The 7 Habits of Highly Effective People",
  "lam-ra-lam-choi-ra-choi": "Deep Work",
  "chu-nghia-toi-gian-so": "Digital Minimalism",
  "suc-manh-cua-thoi-quen": "The Power of Habit",
  "diem-bung-phat": "The Tipping Point",
  "nguoi-giau-co-nhat-thanh-babylon": "The Richest Man in Babylon",
  "cha-giau-cha-ngheo": "Rich Dad Poor Dad",
  "nha-dau-tu-thong-minh": "The Intelligent Investor",
  "tu-tot-den-vi-dai": "Good to Great",
  "khoi-nghiep-tinh-gon": "The Lean Startup",
  "chien-luoc-dai-duong-xanh": "Blue Ocean Strategy",
  "tu-khong-den-mot": "Zero to One",
  "kinh-te-hoc-hai-huoc": "Freakonomics",
  "marketing-gioi-phai-kiem-duoc-tien": "The End of Marketing as We Know It",
  "thao-tung-tam-ly": "Healing from Hidden Abuse",
  "tam-ly-hoc-dam-dong": "The Crowd",
  flow: "Flow",
  "maybe-you-should-talk-to-someone": "Maybe You Should Talk to Someone",
  "the-body-keeps-the-score": "The Body Keeps the Score",
  "charlie-va-nha-may-socola": "Charlie and the Chocolate Factory",
  "emil-o-lang-lonneberga": "Emil i Lonneberga",
};
const verifiedCoverSources = {
  "tat-den": {
    page: "https://minhlongbook.vn/products/sach-tat-den-tai-ban",
    image:
      "https://product.hstatic.net/1000237375/product/bia_truoc_08_b4497226ce524fd79a1d81b9086b99a9_master.jpg",
  },
  "lao-hac": {
    page: "https://nxbvanhoc.com.vn/lao-hac",
    image:
      "https://bizweb.dktcdn.net/thumb/1024x1024/100/370/339/products/z4529778288710-9a538b8bcac451561af81cd240d963a1.jpg?v=1689758099500",
  },
  "emil-o-lang-lonneberga": {
    page: "https://www.rabensjogren.se/bok/9789129668001/emil-i-lonneberga",
    image:
      "https://images.rabensjogren.se/6a821c78-bc28-4d9b-8ed7-8201c3fa6b46",
  },
};
async function download(url) {
  const { stdout } = await execute(
    process.platform === "win32" ? "curl.exe" : "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "15",
      "--user-agent",
      "BookMarketStudentProject/1.0 (local learning project)",
      url,
    ],
    { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 },
  );
  return stdout;
}
const getMeta = (html, property) =>
  (html.match(/<meta\b[^>]*>/gi) || [])
    .find((tag) =>
      new RegExp(`(?:property|name)=["']${property}["']`, "i").test(tag),
    )
    ?.match(/content=["']([^"']+)/i)?.[1]
    ?.replaceAll("&amp;", "&");

async function openLibraryCover(book) {
  if (verifiedCoverSources[book.slug]) {
    return verifiedCoverSources[book.slug];
  }
  const searchTitle = openLibraryTitles[book.slug] || book.title;
  const params = new URLSearchParams({
    title: searchTitle,
    author: book.author.split(";")[0],
    limit: "5",
  });
  const response = JSON.parse(
    (await download(`https://openlibrary.org/search.json?${params}`)).toString(
      "utf8",
    ),
  );
  const expectedTitle = normalize(searchTitle);
  const exactMatch = response.docs?.find(
    (item) =>
      item.cover_i &&
      (normalize(item.title || "").includes(expectedTitle) ||
        expectedTitle.includes(normalize(item.title || ""))),
  );
  // API đã tìm theo cả tên và tác giả; bản đầu có ảnh là dự phòng cho tên dịch.
  const match = exactMatch || response.docs?.find((item) => item.cover_i);
  if (!match) return null;
  return {
    page: `https://openlibrary.org${match.key}`,
    image: `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg`,
  };
}
await mkdir("public/covers/extra", { recursive: true });
const mapping = JSON.parse(await readFile("src/data/extraCovers.json", "utf8"));
let sources = [];
try {
  sources = JSON.parse(
    await readFile("public/covers/extra/sources.json", "utf8"),
  );
} catch {}
const queue = extraBooks.filter((book) => !mapping[book.slug]);
async function worker() {
  while (queue.length) {
    const book = queue.shift();
    const candidates = [
      ...new Set([
        book.slug,
        `${book.slug}-${slugify(book.author.split(";")[0])}`,
        slugify(book.title),
      ]),
    ];
    let found = false;
    for (const slug of candidates) {
      const page = `https://www.netabooks.vn/${slug}`;
      try {
        const html = (await download(page)).toString("utf8");
        const title = getMeta(html, "og:title") || "";
        if (!normalize(title).includes(normalize(book.title).slice(0, 22)))
          continue;
        const url = getMeta(html, "og:image");
        if (!url) continue;
        const data = await download(
          new URL(url, page).href.replace(/^http:/, "https:"),
        );
        if (
          data.length < 2000 ||
          (!(data[0] === 0xff && data[1] === 0xd8) &&
            !(data[0] === 0x89 && data[1] === 0x50) &&
            data.toString("ascii", 0, 4) !== "RIFF")
        )
          continue;
        const file = `/covers/extra/${book.slug}.jpg`;
        await writeFile(`public${file}`, data);
        mapping[book.slug] = file;
        sources.push({
          slug: book.slug,
          title: book.title,
          page,
          image: url,
          file,
        });
        console.log(`${book.slug}: downloaded`);
        found = true;
        break;
      } catch {}
    }
    if (!found) {
      try {
        const source = await openLibraryCover(book);
        if (source) {
          const data = await download(source.image);
          if (data.length >= 2000 && data[0] === 0xff && data[1] === 0xd8) {
            const file = `/covers/extra/${book.slug}.jpg`;
            await writeFile(`public${file}`, data);
            mapping[book.slug] = file;
            sources.push({
              slug: book.slug,
              title: book.title,
              page: source.page,
              image: source.image,
              file,
            });
            console.log(`${book.slug}: downloaded from Open Library`);
            found = true;
          }
        }
      } catch {}
    }
    if (!found) console.log(`${book.slug}: use illustrated fallback`);
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()));
await writeFile(
  "src/data/extraCovers.json",
  JSON.stringify(mapping, null, 2) + "\n",
);
await writeFile(
  "public/covers/extra/sources.json",
  JSON.stringify(sources, null, 2) + "\n",
);
console.log(`Saved ${Object.keys(mapping).length} covers with provenance.`);
