import { chromium, request } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseURL = "http://127.0.0.1:5173";
const output = path.resolve("../screenshots/chuc-nang");
const recaptureFrom = Number(process.env.RECAPTURE_FROM || 999);
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const api = await request.newContext({ baseURL });

async function token(endpoint, email, password) {
  const response = await api.post(endpoint, { data: { email, password } });
  if (!response.ok())
    throw new Error(`${endpoint}: HTTP ${response.status()} ${await response.text()}`);
  return (await response.json()).token;
}

async function contextFor(authToken) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  if (authToken)
    await context.addInitScript(
      (value) => localStorage.setItem("bookmarket-v1-token", value),
      authToken,
    );
  return context;
}

async function capture(page, name, route, readySelector) {
  const target = path.join(output, `${name}.png`);
  if (Number(name.slice(0, 2)) < recaptureFrom)
    try {
      await fs.access(target);
      console.log(`${name}.png (da co)`);
      return;
    } catch {}
  await page.goto(route, { waitUntil: "domcontentloaded" });
  if (readySelector)
    await page
      .locator(readySelector)
      .first()
      .waitFor({ timeout: 30000 })
      .catch(() => {});
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: target,
    fullPage: false,
  });
  console.log(`${name}.png`);
}

try {
  const publicContext = await contextFor();
  const publicPage = await publicContext.newPage();
  await capture(publicPage, "01-trang-chu", "/", ".commerce-header");
  await capture(publicPage, "02-mua-sach", "/mua-sach", ".catalog-layout");
  await capture(publicPage, "03-ebook", "/digital", ".catalog-layout");
  await capture(
    publicPage,
    "04-tim-kiem-nang-cao",
    "/tim-kiem-nang-cao",
    ".advanced-search-page",
  );
  await capture(publicPage, "05-cac-nha-ban", "/nha-ban", ".commerce-header");
  await publicContext.close();

  const readerToken = await token(
    "/api/auth/login",
    "reader@bookmarket.local",
    "BookMarket123!",
  );
  const readerContext = await contextFor(readerToken);
  const readerPage = await readerContext.newPage();
  await capture(readerPage, "06-ho-so", "/ho-so", ".commerce-header");
  await capture(readerPage, "07-don-hang", "/don-hang", ".commerce-header");
  await capture(readerPage, "08-thu-vien-ebook", "/thu-vien", ".commerce-header");
  await capture(readerPage, "09-yeu-thich", "/yeu-thich", ".commerce-header");
  await capture(readerPage, "10-thong-bao", "/thong-bao", ".commerce-header");
  await capture(readerPage, "11-tin-nhan", "/tin-nhan", ".commerce-header");
  await readerContext.close();

  const sellerToken = await token(
    "/api/auth/login",
    "seller-5a7d4392@bookmarket.local",
    "BookMarket123!",
  );
  const sellerContext = await contextFor(sellerToken);
  const sellerPage = await sellerContext.newPage();
  await capture(
    sellerPage,
    "12-nguoi-ban-san-pham",
    "/nguoi-ban/san-pham",
    ".seller-sidebar",
  );
  await capture(
    sellerPage,
    "13-nguoi-ban-don-hang",
    "/nguoi-ban/don-hang",
    ".seller-sidebar",
  );
  await capture(
    sellerPage,
    "14-nguoi-ban-danh-gia",
    "/nguoi-ban/danh-gia",
    ".seller-sidebar",
  );
  await capture(
    sellerPage,
    "15-cau-hinh-gian-hang",
    "/nguoi-ban/gian-hang",
    ".seller-sidebar",
  );
  await sellerContext.close();

  const adminToken = await token(
    "/api/admin/auth/login",
    "admin@bookmarket.local",
    "123456",
  );
  const adminContext = await contextFor(adminToken);
  const adminPage = await adminContext.newPage();
  await capture(adminPage, "16-trang-quan-tri", "/quan-tri", ".admin-page");
  for (const [name, label] of [
    ["17-admin-don-hang", "Đơn hàng"],
    ["18-admin-don-ebook", "Đơn ebook"],
    ["19-admin-giao-dich", "Giao dịch"],
  ]) {
    const button = adminPage.getByRole("button", { name: label, exact: true });
    if (await button.count()) {
      await button.click();
      await adminPage.waitForTimeout(1000);
      await adminPage.screenshot({ path: path.join(output, `${name}.png`) });
      console.log(`${name}.png`);
    }
  }
  await adminContext.close();
} finally {
  await api.dispose();
  await browser.close();
}

console.log(output);
