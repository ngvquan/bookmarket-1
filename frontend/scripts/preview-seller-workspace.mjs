// Kiểm tra trực quan bằng tài khoản demo có sẵn; chỉ đọc API, không tạo/sửa đơn hoặc tin.
import { chromium, expect } from "@playwright/test";
import dotenv from "../../backend/node_modules/dotenv/lib/main.js";
import { mkdir } from "node:fs/promises";
dotenv.config({ path: new URL("../../backend/.env", import.meta.url) });
const baseURL = process.env.PREVIEW_BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ baseURL, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("test-results/seller-workspace", { recursive: true });
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/nguoi-ban");
  await page.locator(".seller-welcome").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "test-results/seller-workspace/welcome-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.screenshot({
    path: "test-results/seller-workspace/welcome-mobile.png",
    fullPage: true,
  });
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: process.env.DEMO_SELLER_EMAIL || "extra-shop-01@bookmarket.local",
      password: process.env.SEED_PASSWORD || "BookMarket123!",
    },
  });
  if (!login.ok())
    throw new Error(`Không đăng nhập được tài khoản demo: ${login.status()}`);
  const account = await login.json();
  await page.addInitScript(
    (token) => localStorage.setItem("bookmarket-v1-token", token),
    account.token,
  );
  for (const [name, path, ready] of [
    ["overview", "/nguoi-ban", ".seller-stat-cards"],
    ["products", "/nguoi-ban/san-pham", ".management-row"],
    ["orders", "/nguoi-ban/don-hang", ".order-filter"],
    ["chat", "/nguoi-ban/tin-nhan", ".chat-workspace"],
    ["shop", "/nguoi-ban/gian-hang", ".shop-form"],
  ]) {
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await page.locator(ready).first().waitFor();
      await page.evaluate(async () => {
        for (const image of document.images) image.loading = "eager";
        await Promise.all(
          [...document.images].map((image) => image.decode().catch(() => {})),
        );
        await document.fonts.ready;
        window.scrollTo(0, 0);
      });
      const dimensions = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(dimensions.document, `${name} tại ${width}px`).toBeLessThanOrEqual(
        width,
      );
      expect(
        await page.locator(".commerce-header, .commerce-footer").count(),
      ).toBe(0);
      if (width === 1440 || width === 360)
        await page.screenshot({
          path: `test-results/seller-workspace/${name}-${width === 1440 ? "desktop" : "mobile"}.png`,
          fullPage: true,
          animations: "disabled",
        });
      console.log(`${name} ${width}px: OK`);
    }
  }
  await page
    .getByRole("link", { name: "Xem trang người bán", exact: true })
    .click();
  await expect(page.locator(".commerce-header")).toBeVisible();
  await expect(page.locator(".seller-header")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log("Public storefront and page errors: OK");
} finally {
  await browser.close();
}
