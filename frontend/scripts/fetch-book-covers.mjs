// Product-cover thumbnails for the local demonstration, with source provenance.
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
async function download(url) {
  const { stdout } = await execute(
    process.platform === "win32" ? "curl.exe" : "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "20",
      url,
    ],
    { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 },
  );
  return stdout;
}
const pages = {
  orange:
    "https://www.netabooks.vn/cay-cam-ngot-cua-toi-jose-mauro-de-vasconcelos",
  alchemist: "https://www.netabooks.vn/nha-gia-kim",
  slow: "https://www.netabooks.vn/buoc-cham-lai-giua-the-gian-voi-va",
  midnight: "https://www.netabooks.vn/thu-vien-nua-dem-matt-haig",
  habits:
    "https://www.alphabooks.vn/atomic-habits-thay-doi-ti-hon-hieu-qua-bat-ngo",
  courage: "https://nhanam.vn/dam-bi-ghet",
  flowers: "https://www.netabooks.vn/toi-thay-hoa-vang-tren-co-xanh",
  meaning: "https://www.netabooks.vn/di-tim-le-song",
  youth: "https://www.netabooks.vn/tuoi-tre-dang-gia-bao-nhieu-rosie-nguyen",
  prince: "https://www.netabooks.vn/hoang-tu-be",
  forest: "https://www.netabooks.vn/rung-na-uy",
  ocean: "https://www.netabooks.vn/mot-thoang-ta-ruc-ro-o-nhan-gian",
};
await mkdir("public/covers", { recursive: true });
const sources = [];
for (const [style, page] of Object.entries(pages)) {
  try {
    const html = (await download(page)).toString("utf8");
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const tag = tags.find((value) =>
      /(?:property|name)=["']og:image["']/i.test(value),
    );
    const url = tag
      ?.match(/content=["']([^"']+)/i)?.[1]
      ?.replaceAll("&amp;", "&");
    if (!url) throw new Error("No cover metadata");
    const data = await download(new URL(url, page).href);
    if (
      !(data[0] === 0xff && data[1] === 0xd8) &&
      !(data[0] === 0x89 && data[1] === 0x50) &&
      data.toString("ascii", 0, 4) !== "RIFF"
    )
      throw new Error("Invalid image");
    if (data.length < 2000) throw new Error("Placeholder image");
    await writeFile(`public/covers/${style}.jpg`, data);
    sources.push({ style, page, image: url, file: `/covers/${style}.jpg` });
    console.log(`${style}: ${data.length} bytes`);
  } catch (error) {
    console.log(`${style}: ${error.message}`);
  }
}
await writeFile(
  "public/covers/sources.json",
  JSON.stringify(sources, null, 2) + "\n",
);
