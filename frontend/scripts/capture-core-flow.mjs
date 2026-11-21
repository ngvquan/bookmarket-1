import { chromium, request } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const baseURL = "http://127.0.0.1:5173";
const output = path.resolve("../screenshots/luong-mua-sach");
const password = "BookMarket123!";
await fs.mkdir(output, { recursive: true });

const api = await request.newContext({ baseURL });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const suffix = Date.now().toString().slice(-7);

async function post(url, data, token) {
  const response = await api.post(url, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok()) throw new Error(`${url}: ${response.status()} ${await response.text()}`);
  return response.json();
}
async function patch(url, data, token) {
  const response = await api.patch(url, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) throw new Error(`${url}: ${response.status()} ${await response.text()}`);
  return response.json();
}
async function register(name) {
  return post("/api/auth/register", {
    name,
    email: `bao-cao-${crypto.randomUUID()}@example.com`,
    password,
  });
}
async function seller(name) {
  const account = await register(name);
  await post(
    "/api/shops",
    {
      name,
      description: "Gian hàng dùng minh họa luồng mua sách trong báo cáo.",
      contactName: "Nguyễn Văn An",
      contactPhone: "0901234567",
      contactEmail: account.user.email,
      pickupAddress: {
        province: "Thành phố Hồ Chí Minh",
        ward: "Phường Bến Thành",
        detail: "12 Đường Sách",
      },
      registrationConfirmed: true,
    },
    account.token,
  );
  return account;
}
async function contextFor(token) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1100 },
  });
  if (token)
    await context.addInitScript(
      (value) => localStorage.setItem("bookmarket-v1-token", value),
      token,
    );
  return context;
}
async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: path.join(output, `${name}.png`),
    fullPage,
    animations: "disabled",
  });
  console.log(`${name}.png`);
}

try {
  const [sellerA, sellerB, buyer] = await Promise.all([
    seller(`Nhà sách Minh Anh ${suffix}`),
    seller(`Nhà sách Mộc Miên ${suffix}`),
    register(`Khách hàng báo cáo ${suffix}`),
  ]);
  const admin = await post("/api/admin/auth/login", {
    email: "admin@bookmarket.local",
    password: "123456",
  });
  const isbn = `978${suffix.padStart(10, "0")}`;
  const metadata = {
    type: "new",
    title: `Sách minh họa luồng mua hàng ${suffix}`,
    author: "Tác giả BookMarket",
    isbn,
    publisher: "NXB BookMarket",
    year: 2026,
    binding: "Bìa mềm",
    category: "Văn học",
    description: "Hai nhà sách cùng bán một ISBN để người mua so sánh giá.",
    stock: 5,
  };
  const offerA = (await post("/api/listings", { ...metadata, price: 85000 }, sellerA.token)).listing;
  const offerB = (await post("/api/listings", { ...metadata, price: 72000 }, sellerB.token)).listing;
  const other = (
    await post(
      "/api/listings",
      {
        ...metadata,
        title: `Cuốn sách thứ hai cho giỏ hàng ${suffix}`,
        isbn: `979${suffix.padStart(10, "0")}`,
        price: 64000,
      },
      sellerA.token,
    )
  ).listing;

  const publicContext = await contextFor();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`/mua-sach?q=${encodeURIComponent(metadata.title)}`);
  await publicPage.locator(".book-card").first().waitFor({ timeout: 30000 });
  await publicPage.locator(".book-title").first().click();
  await publicPage.locator(".offer-row").first().waitFor();
  await shot(publicPage, "01-chi-tiet-sach-so-sanh-nhieu-nguoi-ban");
  await publicContext.close();

  const buyerContext = await contextFor(buyer.token);
  await buyerContext.addInitScript(
    (items) =>
      localStorage.setItem("bookmarket-v1-cart", JSON.stringify(items)),
    [
      { id: offerB.id, quantity: 1, snapshot: offerB },
      { id: other.id, quantity: 1, snapshot: other },
    ],
  );
  const buyerPage = await buyerContext.newPage();
  await buyerPage.goto(`/mua-sach?q=${encodeURIComponent(metadata.title)}`);
  await buyerPage.locator(".book-card").first().waitFor({ timeout: 30000 });
  await buyerPage.getByRole("button", { name: /Giỏ hàng/ }).click();
  await buyerPage.locator(".cart-seller-group").nth(1).waitFor();
  await shot(buyerPage, "02-gio-hang-gop-theo-nguoi-ban");
  await buyerPage.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }).click();
  await buyerPage.getByLabel("Họ và tên", { exact: true }).fill("Khách hàng BookMarket");
  await buyerPage.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
  await buyerPage.getByLabel("Địa chỉ nhận sách", { exact: true }).fill("12 Đường Sách, TP.HCM");
  await shot(buyerPage, "03-popup-thanh-toan-dia-chi-van-chuyen-cod");

  // Tạo một đơn độc lập rồi đưa tới trạng thái đã giao để chụp timeline và nút nhận hàng.
  const order = (await post(
    "/api/orders",
    {
      idempotencyKey: crypto.randomUUID(),
      receiverName: "Khách hàng BookMarket",
      receiverPhone: "0901234567",
      receiverAddress: "12 Đường Sách, TP.HCM",
      items: [{ listingId: offerB.id, quantity: 1 }],
    },
    buyer.token,
  )).order;
  const subId = order.subOrders[0]._id;
  await patch(`/api/sub-orders/${subId}/confirm`, {}, sellerB.token);
  await patch(`/api/sub-orders/${subId}/ship`, {}, sellerB.token);
  await patch(`/api/admin/sub-orders/${subId}/shipping`, { status: "delivered", note: "Đã giao tận tay khách hàng" }, admin.token);
  await buyerPage.goto(`/don-hang/${order._id}`);
  await buyerPage.locator(".shipment-timeline").waitFor({ timeout: 30000 });
  await shot(buyerPage, "04-chi-tiet-don-hang-timeline-da-nhan-hoan-hang", true);
  await buyerContext.close();

  // Buyer mới để tạo một đơn VietQR đang chờ mà không ảnh hưởng thư viện mẫu.
  const ebookBuyer = await register(`Khách mua ebook ${suffix}`);
  const ebookContext = await contextFor(ebookBuyer.token);
  const ebookPage = await ebookContext.newPage();
  await ebookPage.goto("/digital");
  await ebookPage.locator(".book-card").first().waitFor({ timeout: 30000 });
  await ebookPage.locator(".book-card").first().getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  await ebookPage.getByRole("button", { name: /Giỏ hàng/ }).click();
  await ebookPage.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }).click();
  await ebookPage.getByRole("button", { name: "Thanh toán ebook bằng VietQR", exact: true }).click();
  await ebookPage.getByRole("dialog", { name: "THANH TOÁN EBOOK", exact: true }).waitFor();
  await shot(ebookPage, "05-popup-thanh-toan-ebook-vietqr");
  await ebookContext.close();

  const readerLogin = await post("/api/auth/login", {
    email: "reader@bookmarket.local",
    password,
  });
  const readerContext = await contextFor(readerLogin.token);
  const readerPage = await readerContext.newPage();
  await readerPage.goto("/thu-vien");
  await readerPage.getByRole("button", { name: "Đọc sách", exact: true }).first().waitFor({ timeout: 30000 });
  await readerPage.getByRole("button", { name: "Đọc sách", exact: true }).first().click();
  await readerPage.locator("iframe.pdf-frame").waitFor({ timeout: 30000 });
  await shot(readerPage, "06-trinh-doc-ebook-doc-day-du");
  await readerContext.close();
} finally {
  await api.dispose();
  await browser.close();
}

console.log(output);
