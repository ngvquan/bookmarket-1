import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("test-results/marketplace", { recursive: true });
async function loadImages() {
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = "eager";
    await Promise.all(
      [...document.images].map((image) => image.decode().catch(() => {})),
    );
    await document.fonts.ready;
  });
}
for (const [name, width, path] of [
  ["home-desktop", 1440, "/"],
  ["home-laptop", 1024, "/"],
  ["home-tablet", 768, "/"],
  ["home-mobile", 390, "/"],
  ["home-small", 360, "/"],
  ["catalog-desktop", 1440, "/mua-sach"],
  ["catalog-mobile", 390, "/mua-sach"],
  ["sellers-desktop", 1440, "/nha-ban"],
]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`http://127.0.0.1:5173${path}`);
  await page
    .getByRole("searchbox", { name: "Tìm sách trên BookMarket" })
    .waitFor();
  await page.waitForTimeout(300);
  await page
    .locator(path === "/nha-ban" ? ".seller-profile-card" : ".book-card")
    .first()
    .waitFor();
  await loadImages();
  await page.screenshot({
    path: `test-results/marketplace/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    name,
    JSON.stringify(
      await page.evaluate(() => ({
        viewport: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        cards: document.querySelectorAll(".book-card").length,
        brokenImages: [...document.images].filter(
          (image) => image.complete && !image.naturalWidth,
        ).length,
        overflow: [...document.querySelectorAll("main *")]
          .filter(
            (element) => element.getBoundingClientRect().right > innerWidth + 2,
          )
          .slice(0, 5)
          .map((element) => element.className),
      })),
    ),
  );
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.locator(".seller-profile-card").first().click();
await page.locator(".storefront-grid .book-card").first().waitFor();
await loadImages();
await page.screenshot({
  path: "test-results/marketplace/storefront-desktop.png",
  fullPage: true,
  animations: "disabled",
});
await page.goto("http://127.0.0.1:5173/tim-kiem?q=nha+gia+kim");
await page.locator(".catalog-grid .book-title").first().click();
await page.locator(".offer-row").nth(2).waitFor();
await loadImages();
await page.screenshot({
  path: "test-results/marketplace/product-desktop.png",
  animations: "disabled",
});
await page
  .getByRole("button", { name: "Thêm vào giỏ hàng", exact: true })
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Đóng", exact: true })
  .click();
await page
  .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
  .click();
await loadImages();
await page.screenshot({
  path: "test-results/marketplace/cart-desktop.png",
  animations: "disabled",
});
console.log("Page errors:", JSON.stringify(errors));
await browser.close();
