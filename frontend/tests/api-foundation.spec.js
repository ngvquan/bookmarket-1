// Kiểm tra COD và thanh toán ebook trên DB riêng; webhook dùng secret kiểm thử.
import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
const password = "BookMarket123!";
const paymentSecret =
  process.env.PLAYWRIGHT_PAYMENT_WEBHOOK_SECRET ||
  "e2e-only-payment-secret-at-least-32-characters";
const paymentAccountNo =
  process.env.PLAYWRIGHT_PAYMENT_ACCOUNT_NO || "123456789";
const uniqueIsbn = () =>
  `979${(BigInt("0x" + crypto.randomUUID().replaceAll("-", "").slice(0, 16)) % 10000000000n).toString().padStart(10, "0")}`;
test.beforeEach(async ({ page }) => {
  await page.route("https://img.vietqr.io/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/></svg>',
    }),
  );
});
const unique = () => `reader-${crypto.randomUUID()}@example.com`;
const shopRegistrationData = (name, description) => ({
  name,
  description,
  contactName: "Nguyễn Văn An",
  contactPhone: "0901234567",
  contactEmail: "shop@example.com",
  pickupAddress: {
    province: "Thành phố Hồ Chí Minh",
    ward: "Phường Bến Thành",
    detail: "12 Đường Sách",
  },
  registrationConfirmed: true,
});

async function completeShopRegistration(page, name, description) {
  await page.getByLabel("Tên gian hàng", { exact: true }).fill(name);
  await page.getByLabel("Giới thiệu", { exact: true }).fill(description);
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page.getByLabel("Người liên hệ", { exact: true }).fill("Nguyễn Văn An");
  await page
    .getByLabel("Số điện thoại liên hệ", { exact: true })
    .fill("0901234567");
  await page
    .getByLabel("Tỉnh / thành phố", { exact: true })
    .fill("Thành phố Hồ Chí Minh");
  await page
    .getByLabel("Phường / xã", { exact: true })
    .fill("Phường Bến Thành");
  await page
    .getByLabel("Địa chỉ cụ thể", { exact: true })
    .fill("12 Đường Sách");
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Tôi xác nhận thông tin chính xác/ })
    .check();
  await page
    .getByRole("button", { name: "Xác nhận đăng ký rạp sách", exact: true })
    .click();
  await expect(page).toHaveURL(/\/nguoi-ban$/);
  await expect(page.locator(".seller-sidebar")).toBeVisible();
  await expect(page.locator(".shop-registration-ready")).toContainText(name);
  await page
    .locator(".seller-sidebar")
    .getByRole("link", { name: "Thông tin gian hàng", exact: true })
    .click();
}

// Chuẩn bị offer riêng qua API; các thao tác chính vẫn kiểm tra bằng giao diện.
async function orderOffer(page, type = "new") {
  const name = "Shop test " + crypto.randomUUID().slice(0, 8);
  const sellerResponse = await page.request.post("/api/auth/register", {
    data: { name, email: unique(), password },
  });
  expect(sellerResponse.status()).toBe(201);
  const seller = await sellerResponse.json();
  const headers = { Authorization: "Bearer " + seller.token };
  expect(
    (
      await page.request.post("/api/shops", {
        headers,
        data: shopRegistrationData(name, "Shop kiểm thử giao hàng"),
      })
    ).status(),
  ).toBe(201);
  const title = "Hành trình test " + crypto.randomUUID().slice(0, 8);
  const draft = {
    type,
    title,
    author: "Tác giả test",
    isbn: uniqueIsbn(),
    category: "Văn học",
    description: "Sách kiểm thử",
    price: 60000,
    ...(type === "new" ? { stock: 3 } : { condition: "Còn tốt" }),
  };
  const posted = await page.request.post("/api/listings", {
    headers,
    data: draft,
  });
  expect(posted.status()).toBe(201);
  const book = (await posted.json()).listing;
  const adminResponse = await page.request.post("/api/admin/auth/login", {
    data: { email: "admin@bookmarket.local", password },
  });
  expect(adminResponse.status()).toBe(200);
  const admin = await adminResponse.json();
  expect(book.status).toBe("approved");
  return { seller, admin, book, name, title };
}
async function startPaperCheckout(page, offer) {
  await ready(page, "/mua-sach?q=" + encodeURIComponent(offer.title));
  await page
    .locator(".book-card")
    .filter({ hasText: offer.title })
    .getByRole("button", { name: "Thêm vào giỏ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tiến hành đặt hàng", exact: true })
    .click();
  await page.getByLabel("Họ và tên", { exact: true }).fill("Bạn đọc test");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
  await page
    .getByLabel("Địa chỉ nhận sách", { exact: true })
    .fill("12 Đường Sách, TP.HCM");
}
async function userPage(browser, sourcePage, token) {
  const context = await browser.newContext({
    baseURL: new URL(sourcePage.url()).origin,
  });
  await context.addInitScript(
    (value) => localStorage.setItem("bookmarket-v1-token", value),
    token,
  );
  return { context, page: await context.newPage() };
}
async function ready(page, path = "/") {
  await page.goto(path);
  await expect(page.locator(".seller-header, .commerce-header")).toBeVisible();
}
async function login(page, email = "reader@bookmarket.local", pass = password) {
  const admin = email === "admin@bookmarket.local";
  if (admin) {
    await page.goto("/quan-tri");
    await page
      .getByRole("button", { name: "Đăng nhập quản trị", exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  }
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(pass);
  await dialog
    .getByRole("button", {
      name: admin ? "Đăng nhập quản trị" : "Đăng nhập",
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
}
async function register(page) {
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await dialog.getByLabel("Tên của bạn", { exact: true }).fill("Bạn đọc thử");
  const email = unique();
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(password);
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/register"),
  );
  await dialog
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .first()
    .click();
  const data = await (await response).json();
  await expect(dialog).toHaveCount(0);
  return { ...data, email };
}
async function go(page, path) {
  await page.locator(`a[href="${path}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(path.replaceAll("/", "\\/") + "$"));
}

test("real public catalogue, metadata, offers and responsive pages", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const homeTitles = await page
    .locator(".home-book-grid .book-title")
    .allTextContents();
  expect(new Set(homeTitles).size).toBe(homeTitles.length);
  await page.screenshot({
    path: "test-results/stage1-home.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("searchbox", { name: "Tìm sách trên BookMarket" })
    .fill("nha gia kim");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page.locator(".catalog-grid .book-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Hiển thị danh sách", exact: true })
    .click();
  await expect(page.locator(".listing-row")).toHaveCount(1);
  await page.locator(".book-title").first().click();
  await expect(page.locator(".offer-row")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await go(page, "/nha-ban");
  await page.locator(".seller-profile-card").first().click();
  await expect(page).toHaveURL(/\/nha-ban\/[a-f0-9]{24}$/);
  await expect(page.locator(".book-card").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("adding books keeps home cards in place and preserves grouped offers", async ({
  page,
}) => {
  // Chuẩn bị đủ hai trang trên DB test; không phụ thuộc seed mở rộng đã chạy hay chưa.
  const offer = await orderOffer(page);
  const headers = { Authorization: "Bearer " + offer.seller.token };
  const cleanupIds = [offer.book.id];
  try {
    for (let index = 0; index < 13; index++) {
      const posted = await page.request.post("/api/listings", {
        headers,
        data: {
          type: "new",
          title: "Giỏ sách test " + crypto.randomUUID(),
          author: "Tác giả test",
          isbn: uniqueIsbn(),
          category: "Văn học",
          price: 20000,
          stock: 3,
          description: "Kiểm tra giữ nguyên danh sách",
        },
      });
      expect(posted.status()).toBe(201);
      cleanupIds.push((await posted.json()).listing.id);
    }
    const source = (await (await page.request.get("/api/listings/b2")).json())
      .listing;
    const groupedOffer = await page.request.post("/api/listings", {
      headers,
      data: {
        type: "new",
        title: source.title,
        author: source.author,
        category: source.category,
        isbn: source.isbn,
        publisher: source.publisher,
        year: source.year,
        binding: source.binding,
        price: 1000,
        stock: 3,
        description: "Bản bán cùng phiên bản để kiểm tra offerCount",
      },
    });
    expect(groupedOffer.status()).toBe(201);
    cleanupIds.push((await groupedOffer.json()).listing.id);
    await ready(page, "/mua-sach?page=2");
    await expect(
      page.locator(".catalog-grid .book-card").first(),
    ).toBeVisible();
    await page.locator(".commerce-header .logo").click();
    const titles = page.locator(".home-book-grid .book-title");
    await expect(titles).toHaveCount(12);
    const before = await titles.allTextContents();
    const first = page
      .locator(".home-book-grid .book-card")
      .filter({
        has: page.getByRole("button", { name: before[0], exact: true }),
      });
    const offersBefore = await first
      .locator(".card-other-offers")
      .allTextContents();
    await first
      .getByRole("button", { name: "Thêm vào giỏ", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".toast")).toContainText("Đã thêm sách vào giỏ");
    await expect(titles).toHaveText(before);
    await expect(first.locator(".card-other-offers")).toHaveText(offersBefore);
    const second = page
      .locator(".home-book-grid .book-card")
      .filter({
        has: page.getByRole("button", { name: before[1], exact: true }),
      });
    await second
      .getByRole("button", { name: "Thêm vào giỏ", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Giỏ hàng 2 sản phẩm", exact: true }),
    ).toBeVisible();
    await expect(titles).toHaveText(before);
    await page
      .getByRole("button", { name: "Giỏ hàng 2 sản phẩm", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(before[0]);
    await expect(page.getByRole("dialog")).toContainText(before[1]);
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(titles).toHaveText(before);
    await expect(page.locator(".market-shortcuts > a")).toHaveCount(4);
    await expect(
      page.locator('.market-shortcuts a[href="/nha-ban"]'),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Giỏ hàng 2 sản phẩm", exact: true }),
    ).toBeVisible();
  } finally {
    for (const id of cleanupIds)
      await page.request.delete("/api/listings/" + id, { headers });
  }
});

test("paper catalogue combines both conditions and preserves old links", async ({
  page,
}) => {
  await ready(page);
  const nav = page.locator("#primary-navigation");
  await expect(
    nav.getByRole("link", { name: "Mua sách", exact: true }),
  ).toHaveCount(1);
  await expect(
    nav.getByRole("link", { name: /^(Sách mới|Sách cũ)$/ }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Nhà bán sách", exact: true }),
  ).toHaveCount(0);
  const groupedResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/listings?") &&
      response.url().includes("type=physical"),
  );
  await nav.getByRole("link", { name: "Mua sách", exact: true }).click();
  const grouped = await (await groupedResponse).json();
  expect(new Set(grouped.items.map((book) => book.type))).toEqual(
    new Set(["new", "used"]),
  );
  // Catalog lớn có nhiều trang: không so tổng toàn sàn với chỉ 50 tin đầu.
  const offers = [];
  for (const type of ["new", "used"]) {
    let pages = 1;
    for (let number = 1; number <= pages; number++) {
      const data = await (
        await page.request.get(
          `/api/listings?type=${type}&limit=50&page=${number}`,
        )
      ).json();
      pages = data.pages;
      offers.push(...data.items);
    }
  }
  expect(grouped.total).toBe(
    new Set(offers.map((book) => book.editionId)).size,
  );
  expect(new Set(grouped.items.map((book) => book.editionId)).size).toBe(
    grouped.items.length,
  );
  await expect(
    page.getByRole("heading", { name: "Mua sách", exact: true }),
  ).toBeVisible();
  for (const [type, label, oldPath] of [
    ["new", "Sách mới", "/sach-moi"],
    ["used", "Sách cũ", "/sach-cu"],
  ]) {
    await page
      .getByRole("group", { name: "Lọc sách mới hoặc cũ" })
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp("type=" + type));
    await expect(
      page.locator(".catalog-grid .book-card").first(),
    ).toBeVisible();
    await ready(page, oldPath + "?q=nha+gia+kim&sort=price-up");
    await expect(page).toHaveURL(
      new RegExp("/mua-sach\\?q=nha\\+gia\\+kim&sort=price-up&type=" + type),
    );
    await expect(page.locator(".catalog-grid .book-card")).toHaveCount(1);
  }
});

test("marketplace navigation, filters and cart work on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "/mua-sach");
  await expect(page.locator("#catalog-filters")).toBeHidden();
  await page.getByRole("button", { name: "Lọc sách", exact: true }).click();
  await page
    .locator("#catalog-filters")
    .getByRole("button", { name: "Tâm lý", exact: true })
    .click();
  await expect(page).toHaveURL(/category=/);
  await expect(page.locator(".catalog-grid .book-card").first()).toBeVisible();
  await expect(
    page.locator(".catalog-grid .book-card .book-meta").first(),
  ).toContainText("Tâm lý");
  await page.getByRole("button", { name: /^Ẩn bộ lọc/ }).click();
  await expect(page.locator("#catalog-filters")).toBeHidden();
  await page.getByLabel("Sắp xếp sách").selectOption("price-up");
  await expect(page).toHaveURL(/sort=price-up/);
  await page
    .getByRole("button", { name: "Hiển thị danh sách", exact: true })
    .click();
  await expect(page.locator(".listing-row").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Hiển thị dạng lưới", exact: true })
    .click();
  await page
    .locator(".catalog-grid .book-card")
    .first()
    .getByRole("button", { name: "Thêm vào giỏ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
    .click();
  await expect(page.locator(".cart-seller-group").first()).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đóng", exact: true })
    .click();
  await page.getByRole("button", { name: "Mở menu", exact: true }).click();
  await expect(
    page
      .locator("#primary-navigation")
      .getByRole("link", { name: "Nhà bán sách", exact: true }),
  ).toHaveCount(0);
  await page
    .locator("#primary-navigation")
    .getByRole("link", { name: "Mua sách", exact: true })
    .click();
  await expect(page).toHaveURL(/\/mua-sach$/);
  await expect(
    page.getByRole("heading", { name: "Mua sách", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mở menu", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("shipping recovers automatically after a temporary non-JSON gateway error", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/shipping/services", async (route) => {
    calls++;
    if (calls === 1)
      await route.fulfill({
        status: 502,
        contentType: "text/plain",
        body: "Bad Gateway",
      });
    else await route.continue();
  });
  await ready(page);
  await page.locator(".home-book-grid .book-card .quick-add").first().click();
  await page
    .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".cart-totals")).toContainText("25.000");
  expect(calls).toBeGreaterThan(1);
  await expect(page.locator('.cart-modal [role="alert"]')).toHaveCount(0);
});

test("shipping outage blocks checkout, retry loads real fees after recovery", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/shipping/services", async (route) => {
    calls++;
    await route.fulfill({
      status: 503,
      contentType: "text/plain",
      body: "Backend unavailable",
    });
  });
  await ready(page);
  await page.locator(".home-book-grid .book-card .quick-add").first().click();
  await page
    .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
    .click();
  await expect(page.locator('.cart-modal [role="alert"]')).toContainText(
    "Không tải được phí giao",
  );
  await expect(
    page.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }),
  ).toBeDisabled();
  expect(calls).toBe(3);
  await page.unroute("**/api/shipping/services");
  await page
    .getByRole("button", { name: "Thử lại phí giao", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".cart-totals")).toContainText("25.000");
  await expect(page.locator('.cart-modal [role="alert"]')).toHaveCount(0);
});

test("invalid shipping data does not crash the cart and retry restores fees", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/shipping/services", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"items":{}}',
    }),
  );
  await ready(page);
  await page.locator(".home-book-grid .book-card .quick-add").first().click();
  await page
    .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
    .click();
  await expect(page.locator('.cart-modal [role="alert"]')).toContainText(
    "Không tải được phí giao",
  );
  await expect(
    page.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/api/shipping/services");
  await page
    .getByRole("button", { name: "Thử lại phí giao", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test("buyer and seller layouts are separate, routes survive reload and the shared session/cart remain", async ({
  page,
}) => {
  await ready(page);
  await page.locator(".home-book-grid .book-card .quick-add").first().click();
  await page.locator(".home-book-grid .favorite-button").first().click();
  await login(page);
  const savedToken = await page.evaluate(() =>
    localStorage.getItem("bookmarket-v1-token"),
  );
  const savedFavorites = await page.evaluate(() =>
    localStorage.getItem("bookmarket-v1-favorites"),
  );
  await page.getByRole("button", { name: /Tài khoản của/ }).click();
  await page
    .getByRole("link", { name: "Đăng ký rạp sách", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/dang-ky-rap-sach$/);
  await expect(page.locator(".commerce-header")).toBeVisible();
  await expect(page.locator(".seller-sidebar, .seller-header")).toHaveCount(0);
  await completeShopRegistration(
    page,
    "Rạp sách Bạn đọc",
    "Gian hàng thử luồng đăng ký trước khi mở giao diện bán hàng.",
  );
  await expect(page.locator(".seller-sidebar")).toBeVisible();
  await expect(page.locator(".commerce-header, .commerce-footer")).toHaveCount(
    0,
  );
  for (const [label, path] of [
    ["Sản phẩm", "/nguoi-ban/san-pham"],
    ["Đơn bán hàng", "/nguoi-ban/don-hang"],
    ["Thông tin gian hàng", "/nguoi-ban/gian-hang"],
    ["Thống kê", "/nguoi-ban"],
  ]) {
    await page
      .locator(".seller-sidebar")
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(path + "$"));
    await page.reload();
    await expect(
      page
        .locator(".seller-sidebar")
        .getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("link", { name: "Về trang mua sách", exact: true })
    .click();
  await expect(page.locator(".commerce-header")).toBeVisible();
  await expect(page.locator(".seller-sidebar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("bookmarket-v1-token")),
  ).toBe(savedToken);
  expect(
    await page.evaluate(() => localStorage.getItem("bookmarket-v1-favorites")),
  ).toBe(savedFavorites);
  await ready(page, "/gian-hang");
  await expect(page).toHaveURL(/\/nguoi-ban$/);
});

test("seller entry supports sign-in, sign-out, registration and shop setup in its own layout", async ({
  page,
}) => {
  await ready(page, "/nguoi-ban/san-pham");
  await expect(page.locator(".seller-welcome")).toBeVisible();
  await expect(
    page.locator(".commerce-header, .commerce-footer, .seller-sidebar"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Đăng nhập kênh người bán", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Đăng nhập kênh người bán",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("reader@bookmarket.local");
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".seller-sidebar")).toBeVisible();
  await expect(page).toHaveURL(/\/nguoi-ban\/san-pham$/);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.locator(".seller-welcome")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("bookmarket-v1-token")),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Đăng ký rạp sách", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên của bạn", { exact: true }).fill("Người bán mới");
  await dialog.getByLabel("Email", { exact: true }).fill(unique());
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await dialog
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dang-ky-rap-sach$/);
  await expect(page.locator(".seller-sidebar, .seller-header")).toHaveCount(0);
  await completeShopRegistration(
    page,
    "Gian hàng giao diện riêng",
    "Gian hàng kiểm thử chuyển khu vực",
  );
  await expect(page.locator(".seller-profile strong")).toHaveText(
    "Gian hàng giao diện riêng",
  );
  await page
    .getByRole("link", { name: "Xem trang người bán", exact: true })
    .click();
  await expect(page).toHaveURL(/\/nha-ban\/[a-f0-9]{24}$/);
  await expect(page.locator(".commerce-header")).toBeVisible();
  await expect(page.locator(".seller-header")).toHaveCount(0);
});

test("admin cannot use seller workspace", async ({ page }) => {
  await ready(page);
  await login(page, "admin@bookmarket.local");
  await ready(page, "/nguoi-ban");
  await expect(page.locator(".seller-access-denied")).toBeVisible();
  await expect(page.locator(".seller-sidebar")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Về trang quản trị", exact: true })
    .click();
  await expect(page).toHaveURL(/\/quan-tri$/);
});

test("invalid legacy cart item is labelled, excluded from money and badge", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "bookmarket-v1-cart",
      JSON.stringify([{ id: "removed-listing", quantity: 3 }]),
    );
  });
  await ready(page);
  await page
    .getByRole("button", { name: "Giỏ hàng 0 sản phẩm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Không còn bán");
  await expect(page.locator(".cart-totals > div strong")).toHaveText("0₫");
  await expect(
    page.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }),
  ).toBeDisabled();
});

test("register stores only JWT, cart and favorites; reload verifies me and logout removes token", async ({
  page,
}) => {
  await ready(page);
  const account = await register(page);
  expect(account.user.role).toBe("user");
  expect(account.user.id).toMatch(/^[a-f0-9]{24}$/);
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("bookmarket-v1-")),
  );
  expect(keys.sort()).toEqual([
    "bookmarket-v1-cart",
    "bookmarket-v1-favorites",
    "bookmarket-v1-token",
  ]);
  const cookies = await page.context().cookies();
  expect(cookies).toHaveLength(0);
  expect(
    await page.evaluate(() => localStorage.getItem("bookmarket-v1-token")),
  ).toBe(account.token);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Tài khoản của/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Tài khoản của/ }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("bookmarket-v1-token")),
  ).toBeNull();
  await expect(
    page.getByRole("button", { name: "Tài khoản", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrongpass123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đăng nhập", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "không đúng",
  );
});

test("admin route ignores forged local profile and denies a real non-admin", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "bookmarket-v1-profile",
      JSON.stringify({ id: "attacker", role: "admin" }),
    ),
  );
  await ready(page, "/quan-tri");
  await expect(page.locator("main")).toContainText("Đăng nhập để tiếp tục");
  await login(page);
  await expect(page.locator("main")).toContainText(
    "Bạn không có quyền truy cập",
  );
  await expect(page.locator(".admin-section-nav")).toHaveCount(0);
});

test("real admin can restore session and browse protected moderation data", async ({
  page,
}) => {
  await ready(page);
  await login(page, "admin@bookmarket.local");
  await go(page, "/quan-tri");
  await expect(page.locator(".admin-section-nav")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Duyệt tin", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".admin-section-nav")).not.toContainText(
    "Chờ duyệt",
  );
  await page.reload();
  await expect(page.locator(".admin-section-nav")).toBeVisible();
  await page.getByRole("button", { name: "Tin đăng", exact: true }).click();
  await expect(page.locator(".management-row").first()).toBeVisible();
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(page.locator(".catalog-pagination")).toContainText("Trang 2");
});

test("shop and listing CRUD publishes immediately without approval and survives reload", async ({
  page,
}) => {
  await ready(page);
  const account = await register(page);
  await go(page, "/nguoi-ban");
  await page
    .locator(".shop-cta")
    .getByRole("link", { name: "Đăng ký rạp sách", exact: true })
    .click();
  await completeShopRegistration(
    page,
    "Tiệm " + account.user.id.slice(-6),
    "Gian sách kiểm thử qua API.",
  );
  await expect(page.locator("main h1")).toContainText("Tiệm");
  await page.getByRole("button", { name: "Đăng sách", exact: true }).click();
  const title = "Sách API " + account.user.id;
  await page.getByLabel("Tên sách", { exact: true }).fill(title);
  await page.getByLabel("Tác giả", { exact: true }).fill("Tác giả thử");
  await page.getByLabel("ISBN (bắt buộc)", { exact: true }).fill(uniqueIsbn());
  await page
    .getByLabel("Một vài dòng về cuốn sách", { exact: true })
    .fill("Nội dung giới thiệu sách kiểm thử qua máy chủ.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đăng sách", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
  await expect(
    page.locator(".management-row").filter({ hasText: title }),
  ).toContainText("Đang hiển thị");
  const publicBooks = await (
    await page.request.get("/api/listings?q=" + encodeURIComponent(title))
  ).json();
  expect(publicBooks.items.some((book) => book.title === title)).toBe(true);
  await page.reload();
  await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
  await expect(
    page.locator(".management-row").filter({ hasText: title }),
  ).toContainText("Đang hiển thị");
  await page.getByRole("button", { name: "Sửa " + title, exact: true }).click();
  await page.getByLabel("Tên sách", { exact: true }).fill(title + " sửa");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const updatedPublic = await (
    await page.request.get(
      "/api/listings?q=" + encodeURIComponent(title + " sửa"),
    )
  ).json();
  expect(
    updatedPublic.items.some((book) => book.title === title + " sửa"),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Xóa " + title + " sửa", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
  await expect(
    page.locator(".management-row").filter({ hasText: title }),
  ).toHaveCount(0);
});

test("ISBN is required and selecting an existing title adds a comparable offer", async ({
  page,
}) => {
  await ready(page);
  const account = await register(page);
  const headers = { Authorization: "Bearer " + account.token };
  await go(page, "/nguoi-ban");
  await page
    .locator(".shop-cta")
    .getByRole("link", { name: "Đăng ký rạp sách", exact: true })
    .click();
  await completeShopRegistration(
    page,
    "Tiệm ISBN " + account.user.id.slice(-6),
    "Kiểm tra ghép phiên bản đã có.",
  );
  await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
  await page.getByRole("button", { name: "Đăng sách", exact: true }).click();
  const isbnInput = page.getByLabel("ISBN (bắt buộc)", { exact: true });
  expect(await isbnInput.evaluate((input) => input.required)).toBe(true);
  await page.getByLabel("Tên sách", { exact: true }).fill("Nhà giả kim");
  await page.getByLabel("Tác giả", { exact: true }).fill("Paulo");
  const suggestion = page
    .locator(".edition-suggestions button")
    .filter({ hasText: "9780000000026" })
    .first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(isbnInput).toHaveValue("9780000000026");
  await expect(page.locator(".shop-registration-saved")).toContainText(
    "phần so sánh",
  );
  await page
    .getByLabel("Một vài dòng về cuốn sách", { exact: true })
    .fill("Tin bán dùng chung phiên bản đã có.");
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/listings") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đăng sách", exact: true })
    .click();
  const result = await created;
  expect(result.status()).toBe(201);
  const listing = (await result.json()).listing;
  const source = (await (await page.request.get("/api/listings/b2")).json())
    .listing;
  expect(listing.editionId).toBe(source.editionId);
  const grouped = await (
    await page.request.get(
      `/api/listings?type=physical&group=edition&edition=${listing.editionId}`,
    )
  ).json();
  expect(grouped.items[0].offerCount).toBeGreaterThan(1);
  await page.request.delete("/api/listings/" + listing.id, { headers });
});

test("seller uploads a cover and PDF, then visitors can read a two-page preview", async ({
  page,
}) => {
  await ready(page);
  const account = await register(page);
  await go(page, "/nguoi-ban");
  await page
    .locator(".shop-cta")
    .getByRole("link", { name: "Đăng ký rạp sách", exact: true })
    .click();
  await completeShopRegistration(
    page,
    "Tiệm ebook " + account.user.id.slice(-6),
    "Kiểm tra ảnh và PDF ebook.",
  );
  await page.getByRole("link", { name: "Sản phẩm", exact: true }).click();
  await page.getByRole("button", { name: "Đăng sách", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Hình thức", exact: true })
    .selectOption("digital");
  const title = "Ebook PDF " + account.user.id;
  await page.getByLabel("Tên sách", { exact: true }).fill(title);
  await page.getByLabel("Tác giả", { exact: true }).fill("Tác giả PDF");
  await page.getByLabel("ISBN (bắt buộc)", { exact: true }).fill(uniqueIsbn());
  await page
    .getByLabel("Một vài dòng về cuốn sách", { exact: true })
    .fill("Ebook có file thật để kiểm tra quyền đọc.");
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+axtsAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel(/Ảnh sách/)
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: image });
  const document = await PDFDocument.create();
  document.addPage();
  document.addPage();
  document.addPage();
  await page
    .getByLabel(/File PDF ebook/)
    .setInputFiles({
      name: "ebook.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await document.save()),
    });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đăng sách", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".management-row").filter({ hasText: title }),
  ).toContainText("Đang hiển thị");
  const result = await (
    await page.request.get("/api/listings?q=" + encodeURIComponent(title))
  ).json();
  expect(result.items[0]).toMatchObject({ hasEbook: true });
  expect(result.items[0].imageIds).toHaveLength(1);
  await ready(page, "/digital?q=" + encodeURIComponent(title));
  await page
    .locator(".book-card")
    .filter({ hasText: title })
    .getByRole("button", { name: `Xem ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Đọc thử", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Bản xem trước · tối đa 2 trang",
  );
  await page.keyboard.press("Escape");
  await page.request.delete("/api/listings/" + result.items[0].id, {
    headers: { Authorization: "Bearer " + account.token },
  });
});

test("seller can publish and edit a used book with the simplified form and no shop", async ({
  page,
}) => {
  await ready(page);
  const account = await register(page);
  await go(page, "/nguoi-ban/san-pham");
  await page.getByRole("button", { name: "Đăng sách", exact: true }).click();
  for (const type of ["new", "digital"]) {
    await page
      .getByRole("combobox", { name: "Hình thức", exact: true })
      .selectOption(type);
    await expect(page.getByRole("dialog")).toContainText(
      "hoàn tất thông tin liên hệ và địa chỉ lấy hàng",
    );
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Đăng sách", exact: true }),
    ).toHaveCount(0);
  }
  await page
    .getByRole("combobox", { name: "Hình thức", exact: true })
    .selectOption("used");
  const title = "Sách cũ " + account.user.id;
  await page.getByLabel("Tên sách", { exact: true }).fill(title);
  await page.getByLabel("Tác giả", { exact: true }).fill("Tác giả thử");
  await page.getByLabel("ISBN (bắt buộc)", { exact: true }).fill(uniqueIsbn());
  await page
    .getByLabel("Một vài dòng về cuốn sách", { exact: true })
    .fill("Cuốn sách được đăng từ form mới và cũ rút gọn.");
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/listings") && r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đăng sách", exact: true })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect((await response.json()).listing.type).toBe("used");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Sửa " + title, exact: true }).click();
  await page.getByLabel("Giá bán (₫)", { exact: true }).fill("50000");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".management-row").filter({ hasText: title }),
  ).toContainText("50.000");
});

test("buyer follows a shop and seller can hide then show their own listing", async ({
  page,
  browser,
}) => {
  const offer = await orderOffer(page, "new");
  await ready(page);
  await register(page);
  await ready(page, `/nha-ban/${offer.seller.user.id}`);
  await page.getByRole("button", { name: /Theo dõi/ }).click();
  await expect(
    page.getByRole("button", { name: /Đang theo dõi/ }),
  ).toBeVisible();
  await ready(page, "/theo-doi");
  await expect(page.locator(".book-card")).toContainText(offer.title);

  const seller = await userPage(browser, page, offer.seller.token);
  try {
    await ready(seller.page, "/nguoi-ban/san-pham");
    const row = seller.page
      .locator(".management-row")
      .filter({ hasText: offer.title });
    await row.getByRole("button", { name: "Ẩn tin", exact: true }).click();
    await expect(row).toContainText("Đã ẩn");
    await row.getByRole("button", { name: "Hiện tin", exact: true }).click();
    await expect(row).toContainText("Đang hiển thị");
  } finally {
    await seller.context.close();
  }
});

test("profile, saved address, account favorites and order notifications persist", async ({
  page,
}) => {
  const offer = await orderOffer(page, "new");
  await ready(page);
  const buyer = await register(page);
  await ready(page, "/ho-so");
  await page.getByLabel("Tên hiển thị", { exact: true }).fill("Bạn đọc hồ sơ");
  await page.getByRole("button", { name: "Lưu tên", exact: true }).click();
  await page.getByRole("button", { name: "Thêm địa chỉ", exact: true }).click();
  await page.getByLabel("Tên gợi nhớ", { exact: true }).fill("Nhà riêng");
  await page.getByLabel("Người nhận", { exact: true }).fill("Nguyễn An");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
  await page
    .getByLabel("Địa chỉ đầy đủ", { exact: true })
    .fill("12 Đường Sách, TP.HCM");
  await page.getByRole("button", { name: "Lưu địa chỉ", exact: true }).click();
  await expect(page.locator(".saved-address-list")).toContainText(
    "12 Đường Sách, TP.HCM",
  );
  await page.reload();
  await expect(page.getByLabel("Tên hiển thị", { exact: true })).toHaveValue(
    "Bạn đọc hồ sơ",
  );

  await ready(page, "/mua-sach?q=" + encodeURIComponent(offer.title));
  const card = page.locator(".book-card").filter({ hasText: offer.title });
  const favoriteSaved = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/auth/favorites/${offer.book.id}`) &&
      response.request().method() === "PUT",
  );
  await card
    .getByRole("button", { name: `Yêu thích ${offer.title}`, exact: true })
    .click();
  expect((await favoriteSaved).status()).toBe(200);
  await page.reload();
  await ready(page, "/yeu-thich");
  await expect(
    page.locator(".book-card").filter({ hasText: offer.title }),
  ).toBeVisible();

  await ready(page, "/mua-sach?q=" + encodeURIComponent(offer.title));
  await page
    .locator(".book-card")
    .filter({ hasText: offer.title })
    .getByRole("button", { name: "Thêm vào giỏ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tiến hành đặt hàng", exact: true })
    .click();
  await expect(page.getByLabel("Chọn địa chỉ nhận hàng")).toContainText(
    "Nhà riêng",
  );
  await expect(page.locator('textarea[name="address"]')).toHaveValue(
    "12 Đường Sách, TP.HCM",
  );
  await page.keyboard.press("Escape");

  const orderResponse = await page.request.post("/api/orders", {
    headers: { Authorization: "Bearer " + buyer.token },
    data: {
      idempotencyKey: crypto.randomUUID(),
      receiverName: "Nguyễn An",
      receiverPhone: "0901234567",
      receiverAddress: "12 Đường Sách, TP.HCM",
      items: [{ listingId: offer.book.id, quantity: 1 }],
    },
  });
  expect(orderResponse.status()).toBe(201);
  const order = (await orderResponse.json()).order;
  expect(
    (
      await page.request.patch(
        `/api/sub-orders/${order.subOrders[0]._id}/confirm`,
        { headers: { Authorization: "Bearer " + offer.seller.token } },
      )
    ).status(),
  ).toBe(200);
  await ready(page, "/thong-bao");
  await expect(page.locator(".notification-list")).toContainText(
    "đã được người bán xác nhận",
  );
});

test("mixed checkout saves COD then pays ebook by webhook; library persists on reload", async ({
  page,
}) => {
  await ready(page);
  await register(page);
  await go(page, "/mua-sach");
  await page
    .locator(".book-card")
    .filter({ hasText: "Tôi thấy hoa vàng trên cỏ xanh" })
    .getByRole("button", { name: "Thêm vào giỏ", exact: true })
    .click();
  await go(page, "/digital");
  await page
    .locator(".book-card")
    .filter({ hasText: "Nghệ thuật của sự chú tâm" })
    .getByRole("button", { name: "Thêm vào giỏ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Giỏ hàng 2 sản phẩm", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tiến hành đặt hàng", exact: true })
    .click();
  await page.getByLabel("Họ và tên", { exact: true }).fill("Bạn đọc");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
  await page
    .getByLabel("Địa chỉ nhận sách", { exact: true })
    .fill("Đường Sách, TP.HCM");
  await page
    .getByRole("button", { name: "Xác nhận đặt hàng (COD)", exact: true })
    .click();
  await page.getByRole("button", { name: "Xem đơn hàng", exact: true }).click();
  await expect(page.locator(".order-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tiến hành đặt hàng", exact: true })
    .click();
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/digital-orders") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Thanh toán ebook bằng VietQR", exact: true })
    .click();
  const order = (await (await created).json()).order;
  await expect(
    page.getByRole("dialog", { name: "THANH TOÁN EBOOK", exact: true }),
  ).toContainText(order.transferCode);
  await expect(
    page.getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true }),
  ).toBeAttached();
  expect(
    (
      await page.request.post("/api/webhooks/bank-transaction", {
        headers: { Authorization: "Apikey " + paymentSecret },
        data: {
          id: crypto.randomUUID(),
          transferType: "in",
          transferAmount: order.total,
          content: order.transferCode,
          accountNumber: paymentAccountNo,
        },
      })
    ).status(),
  ).toBe(200);
  await expect(page).toHaveURL(/\/thu-vien$/, { timeout: 12000 });
  await page.getByRole("button", { name: "Đọc sách", exact: true }).click();
  await expect(page.locator("iframe.pdf-frame")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.reload();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await go(page, "/don-hang");
  await expect(page.locator(".order-card")).toHaveCount(2);
  expect(
    (await page.evaluate(() => Object.keys(localStorage))).some((key) =>
      /orders|library|profile|requests|shop|books/.test(key),
    ),
  ).toBe(false);
});

test("VietQR ebook keeps cart until paid, resumes from history and persists library", async ({
  page,
}) => {
  const offer = await orderOffer(page, "digital");
  await ready(page);
  const buyer = await register(page);
  await ready(page, "/digital?q=" + encodeURIComponent(offer.title));
  await page
    .locator(".book-card")
    .getByRole("button", { name: "Thêm vào giỏ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tiến hành đặt hàng", exact: true })
    .click();
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/digital-orders") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Thanh toán ebook bằng VietQR", exact: true })
    .click();
  const order = (await (await created).json()).order;
  const modal = page.getByRole("dialog", {
    name: "THANH TOÁN EBOOK",
    exact: true,
  });
  await expect(modal).toContainText(order.transferCode);
  await expect(
    modal.getByRole("img", { name: "Mã VietQR thanh toán ebook", exact: true }),
  ).toHaveAttribute("src", order.qrImageUrl);
  await expect(
    page.getByRole("button", { name: "Giỏ hàng 1 sản phẩm", exact: true }),
  ).toBeAttached();
  let reads = 0;
  page.on("request", (request) => {
    if (
      request.url().includes("/digital-orders/") &&
      request.url().endsWith("/status")
    )
      reads++;
  });
  await modal.getByRole("button", { name: "Đóng", exact: true }).click();
  const closedReads = reads;
  await page.waitForTimeout(3300);
  expect(reads).toBe(closedReads);
  await expect(
    (
      await page.request.get("/api/library", {
        headers: { Authorization: "Bearer " + buyer.token },
      })
    )
      .json()
      .then((data) => data.items.length),
  ).resolves.toBe(0);
  await ready(page, "/don-hang");
  await page
    .getByRole("button", { name: "Thanh toán ebook", exact: true })
    .click();
  await expect(modal).toContainText(order.transferCode);
  await page.screenshot({
    path: "test-results/vietqr-desktop.png",
    fullPage: true,
  });
  expect(
    (
      await page.request.post("/api/webhooks/bank-transaction", {
        headers: { Authorization: "Apikey " + paymentSecret },
        data: {
          id: crypto.randomUUID(),
          transferType: "in",
          transferAmount: order.total,
          content: order.transferCode.toLowerCase().split("").join(" "),
          accountNumber: paymentAccountNo,
        },
      })
    ).status(),
  ).toBe(200);
  await expect(page).toHaveURL(/\/thu-vien$/, { timeout: 12000 });
  await expect(page.locator(".book-card")).toContainText(offer.title);
  await expect(
    page.getByRole("button", { name: "Giỏ hàng 0 sản phẩm", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".book-card")).toContainText(offer.title);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/library-paid-mobile.png",
    fullPage: true,
  });
});

test("VietQR cancel keeps ebook in cart and admin can confirm a verified payment", async ({
  page,
  browser,
}) => {
  const offer = await orderOffer(page, "digital");
  await ready(page);
  const buyer = await register(page);
  const response = await page.request.post("/api/digital-orders", {
    headers: { Authorization: "Bearer " + buyer.token },
    data: { listingIds: [offer.book.id] },
  });
  const order = (await response.json()).order;
  await ready(page, "/don-hang");
  await page
    .getByRole("button", { name: "Thanh toán ebook", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hủy thanh toán", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    (
      await page.request.get(`/api/digital-orders/${order._id}/status`, {
        headers: { Authorization: "Bearer " + buyer.token },
      })
    )
      .json()
      .then((data) => data.status),
  ).resolves.toBe("cancelled");
  const newResponse = await page.request.post("/api/digital-orders", {
    headers: { Authorization: "Bearer " + buyer.token },
    data: { listingIds: [offer.book.id] },
  });
  const next = (await newResponse.json()).order;
  const unmatchedId = "unmatched-" + crypto.randomUUID();
  await page.request.post("/api/webhooks/bank-transaction", {
    headers: { Authorization: "Apikey " + paymentSecret },
    data: {
      id: unmatchedId,
      transferType: "in",
      transferAmount: next.total,
      content: "Giao dịch chưa ghi mã đơn",
      accountNumber: paymentAccountNo,
    },
  });
  const admin = await userPage(browser, page, offer.admin.token);
  try {
    await ready(admin.page, "/quan-tri");
    await admin.page
      .getByRole("button", { name: "Đơn ebook", exact: true })
      .click();
    await expect(admin.page.locator(".unmatched-transactions")).toContainText(
      unmatchedId,
    );
    const row = admin.page
      .locator(".admin-digital-orders .order-card")
      .filter({ hasText: next.transferCode });
    await row
      .getByRole("button", { name: "Đánh dấu đã thanh toán", exact: true })
      .click();
    await row
      .getByLabel("Chọn giao dịch chưa khớp", { exact: true })
      .selectOption(unmatchedId);
    await expect(
      row.getByLabel("Mã giao dịch ngân hàng", { exact: true }),
    ).toHaveValue(unmatchedId);
    await expect(
      row.getByLabel("Số tiền thực nhận", { exact: true }),
    ).toHaveValue(String(next.total));
    await row
      .getByRole("button", { name: "Xác nhận đã nhận tiền", exact: true })
      .click();
    await expect(row).toHaveCount(0);
    await ready(page, "/thu-vien");
    await expect(page.locator(".book-card")).toContainText(offer.title);
  } finally {
    await admin.context.close();
  }
});

test("removed exchange links redirect home and search rejects exchange", async ({
  page,
}) => {
  await ready(page, "/trao-doi");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".commerce-header")).not.toContainText("Trao đổi");
  await ready(page, "/yeu-cau");
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get("/api/listings?type=exchange")).status()).toBe(
    400,
  );
});

test("invalid token is cleared, admin is denied and no refresh request is sent", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("bookmarket-v1-token", "invalid-token"),
  );
  let refreshes = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/auth/refresh")) refreshes++;
  });
  await ready(page, "/quan-tri");
  await expect(page.locator("main")).toContainText("Đăng nhập để tiếp tục");
  expect(
    await page.evaluate(() => localStorage.getItem("bookmarket-v1-token")),
  ).toBeNull();
  expect(refreshes).toBe(0);
});

test("API outage is shown without silently loading old localStorage listings", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Chưa kết nối được máy chủ",
  );
  await page.unroute("**/api/**");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "Tìm sách trên BookMarket" }),
  ).toBeVisible();
});

test("modal and boundary regressions still pass independently of API state", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/regression.html");
  await page.getByRole("button", { name: "Open outer" }).click();
  await page.getByRole("button", { name: "Change callback" }).click();
  await page.getByRole("button", { name: "Open inner" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("output")).toHaveText("fresh");
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await page.getByRole("button", { name: "Break render" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("server pagination and ISBN prefix filters are used by the catalogue", async ({
  page,
}) => {
  await ready(page, "/tim-kiem");
  await expect(
    page.getByRole("button", { name: "Trang sau", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".catalog-pagination")).toContainText("Trang 2");
  await page
    .getByRole("textbox", { name: "Tìm kiếm sách", exact: true })
    .fill("9");
  await expect(page.locator(".book-card")).toHaveCount(0);
  await expect(page).not.toHaveURL(/page=2/);
  await page
    .getByRole("textbox", { name: "Tìm kiếm sách", exact: true })
    .fill("9780000000026");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page
    .getByRole("group", { name: "Lọc sách mới hoặc cũ" })
    .getByRole("button", { name: "Sách cũ", exact: true })
    .click();
  await expect(page.locator(".book-card")).toHaveCount(1);
});

test("numeric price inputs validate bounds and preserve URL filters", async ({
  page,
}) => {
  await ready(page, "/tim-kiem-nang-cao?min=20000&max=250000&type=used");
  const lower = page.getByRole("spinbutton", { name: "Giá từ", exact: true });
  const upper = page.getByRole("spinbutton", { name: "Giá đến", exact: true });
  await expect(lower).toHaveValue("20000");
  await expect(upper).toHaveValue("250000");
  await lower.fill("20100");
  await upper.fill("249900");
  const result = page.waitForResponse(
    (r) =>
      r.url().includes("/api/listings?") &&
      r.url().includes("min=20100") &&
      r.url().includes("max=249900"),
  );
  await page.locator(".edition-search button[type=submit]").click();
  const data = await (await result).json();
  expect(data.total).toBeGreaterThan(0);
  expect(
    data.items.every(
      (book) =>
        book.type === "used" && book.price >= 20100 && book.price <= 249900,
    ),
  ).toBe(true);
  await expect(
    page.locator("#catalog-filters select, #catalog-filters input"),
  ).toHaveCount(0);
  await page
    .locator(".catalog-toolbar")
    .getByRole("link", { name: "Tìm kiếm nâng cao", exact: true })
    .click();
  await page.reload();
  await expect(lower).toHaveValue("20100");
  await expect(upper).toHaveValue("249900");
  await lower.fill("50000");
  await upper.fill("10000");
  await page.locator(".edition-search button[type=submit]").click();
  await expect(page).toHaveURL(/\/tim-kiem-nang-cao/);
  expect(await upper.evaluate((input) => input.validity.rangeUnderflow)).toBe(
    true,
  );
  await upper.fill("75000");
  expect(await upper.evaluate((input) => input.checkValidity())).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/price-inputs-mobile.png",
    fullPage: true,
  });
  await lower.fill("");
  await upper.fill("");
  await page.locator(".edition-search button[type=submit]").click();
  const search = new URL(page.url()).searchParams;
  expect(search.has("min")).toBe(false);
  expect(search.has("max")).toBe(false);
  // Không áp dụng mức giá trần cho ô nhập số.
  await ready(page, "/tim-kiem-nang-cao?min=1500000&max=2500000");
  await expect(lower).toHaveValue("1500000");
  await expect(upper).toHaveValue("2500000");
  await page.locator(".edition-search button[type=submit]").click();
  await expect(page).toHaveURL(/min=1500000&max=2500000/);
});

test("paper order: fast fee, seller confirms/ships, admin delivers, buyer completes with timeline", async ({
  page,
  browser,
}) => {
  const offer = await orderOffer(page);
  await ready(page);
  await register(page);
  await startPaperCheckout(page, offer);
  await page
    .getByLabel("Dịch vụ giao " + offer.name, { exact: true })
    .selectOption("fast");
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/orders") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Xác nhận đặt hàng (COD)", exact: true })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  const order = (await response.json()).order;
  expect(order.shippingTotal).toBe(40000);
  await page.getByRole("button", { name: "Xem đơn hàng", exact: true }).click();
  await expect(
    page.locator(".order-card").filter({ hasText: offer.title }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".order-card").filter({ hasText: offer.title }),
  ).toBeVisible();
  const seller = await userPage(browser, page, offer.seller.token);
  const admin = await userPage(browser, page, offer.admin.token);
  try {
    await ready(seller.page, "/nguoi-ban");
    await seller.page
      .getByRole("link", { name: "Đơn bán hàng", exact: true })
      .click();
    const sellerSub = seller.page
      .locator(".sub-order")
      .filter({ hasText: offer.title });
    await sellerSub
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(sellerSub).toContainText(/BM[A-F0-9]{8}/);
    await sellerSub
      .getByRole("button", { name: "Giao cho hãng", exact: true })
      .click();
    await expect(sellerSub.locator(".status")).toHaveText("Đang giao");
    await sellerSub.getByRole("link", { name: /Chi tiết đơn/ }).click();
    await expect(seller.page).toHaveURL(
      new RegExp("/nguoi-ban/don-hang/" + order._id),
    );
    await expect(seller.page.locator(".commerce-header")).toHaveCount(0);
    await expect(
      seller.page.getByRole("heading", {
        name: "Chi tiết đơn bán",
        exact: true,
      }),
    ).toBeVisible();
    await ready(admin.page, "/quan-tri");
    await admin.page
      .getByRole("button", { name: "Vận chuyển", exact: true })
      .click();
    const shipment = admin.page
      .locator(".sub-order")
      .filter({ hasText: offer.title });
    await shipment.getByLabel("Ghi chú vận chuyển").fill("Đã giao tận tay");
    await shipment
      .getByRole("button", { name: "Giao thành công", exact: true })
      .click();
    await expect(shipment).toHaveCount(0);
    await ready(page, "/don-hang/" + order._id);
    await page
      .getByRole("button", { name: "Đã nhận hàng", exact: true })
      .click();
    await expect(page.locator(".sub-order .status")).toHaveText("Hoàn thành");
    await expect(page.locator(".shipment-timeline li")).toHaveCount(5);
    await expect(page.locator(".shipment-timeline")).toContainText(
      "Đã giao tận tay",
    );
    await seller.page.setViewportSize({ width: 1440, height: 1000 });
    await seller.page.evaluate(() => window.scrollTo(0, 0));
    await seller.page.screenshot({
      path: "test-results/seller-order-detail-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await seller.page.setViewportSize({ width, height: 900 });
      expect(
        await seller.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await seller.page.evaluate(() => window.scrollTo(0, 0));
    await seller.page.screenshot({
      path: "test-results/seller-order-detail-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    await seller.context.close();
    await admin.context.close();
  }
});

test("buyer order tabs track mixed-shop states, counts and receipt without a refund tab", async ({
  page,
}) => {
  const first = await orderOffer(page);
  const second = await orderOffer(page);
  await ready(page);
  const buyer = await register(page);
  const headers = { Authorization: "Bearer " + buyer.token };
  const response = await page.request.post("/api/orders", {
    headers,
    data: {
      idempotencyKey: crypto.randomUUID(),
      receiverName: "Bạn đọc",
      receiverPhone: "0901234567",
      receiverAddress: "12 Đường Sách",
      items: [
        { listingId: first.book.id, quantity: 1 },
        { listingId: second.book.id, quantity: 1 },
      ],
    },
  });
  expect(response.status()).toBe(201);
  const order = (await response.json()).order;
  await ready(page, "/don-hang");
  const tabs = page.getByRole("navigation", { name: "Trạng thái đơn hàng" });
  const choose = (label) =>
    tabs.getByRole("button", { name: new RegExp("^" + label) }).click();
  await expect(tabs.getByRole("button")).toHaveCount(5);
  await expect(
    tabs.getByRole("button", { name: /^Hoàn thành|^Chờ nhận hàng/ }),
  ).toHaveCount(0);
  await expect(tabs).not.toContainText(/refund|hoàn tiền|trả hàng/i);
  await expect(page.locator(".order-card .sub-order")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Đánh giá sách", exact: true }),
  ).toHaveCount(0);
  await choose("Chờ xác nhận");
  await expect(page.locator(".order-card .sub-order")).toHaveCount(2);
  const cancelled = page.locator(".sub-order").filter({ hasText: first.title });
  await cancelled.getByRole("button", { name: "Hủy đơn", exact: true }).click();
  await cancelled
    .getByRole("button", { name: "Xác nhận hủy", exact: true })
    .click();
  await expect(page.locator(".order-card .sub-order")).toHaveCount(1);
  await expect(page.locator(".sub-order")).toContainText(second.title);
  await choose("Đã hủy");
  await expect(page.locator(".sub-order .status")).toHaveText("Đã hủy");
  await expect(page.locator(".order-card")).not.toContainText(second.title);
  await expect(page.locator(".order-card > .order-footer > strong")).toHaveText(
    "85.000₫",
  );
  const sub = order.subOrders.find(
    (item) => item.sellerId === second.seller.user.id,
  );
  const sellerHeaders = { Authorization: "Bearer " + second.seller.token };
  expect(
    (
      await page.request.patch("/api/sub-orders/" + sub._id + "/confirm", {
        headers: sellerHeaders,
      })
    ).status(),
  ).toBe(200);
  await choose("Chờ giao hàng");
  await expect(page.locator(".sub-order .status")).toHaveText("Đã xác nhận");
  expect(
    (
      await page.request.patch("/api/sub-orders/" + sub._id + "/ship", {
        headers: sellerHeaders,
      })
    ).status(),
  ).toBe(200);
  await choose("Nhận hàng");
  await expect(page.locator(".sub-order .status")).toHaveText("Đang giao");
  expect(
    (
      await page.request.patch(
        "/api/admin/sub-orders/" + sub._id + "/shipping",
        {
          headers: { Authorization: "Bearer " + second.admin.token },
          data: { status: "delivered" },
        },
      )
    ).status(),
  ).toBe(200);
  await expect(
    page.getByRole("button", { name: "Đã nhận hàng", exact: true }),
  ).toBeVisible({ timeout: 12000 });
  await expect(
    page.getByRole("button", { name: "Đánh giá sách", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Đã nhận hàng", exact: true }).click();
  await expect(page.locator(".sub-order .status")).toHaveText("Hoàn thành");
  await expect(
    tabs.getByRole("button", { name: /^Nhận hàng/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Đánh giá sách", exact: true }),
  ).toHaveCount(1);
  await expect(
    tabs
      .getByRole("button", { name: /^Nhận hàng/ })
      .locator(".order-tab-count"),
  ).toHaveText("1");
  await expect(page.locator(".order-card")).toContainText(second.title);
  await expect(page.locator(".order-card")).not.toContainText(first.title);
  await page.reload();
  await expect(page).toHaveURL(/tab=to-receive/);
  await ready(page, "/don-hang?tab=completed");
  await expect(page).toHaveURL(/tab=to-receive/);
  await expect(page.locator(".sub-order .status")).toHaveText("Hoàn thành");
  await page.screenshot({
    path: "test-results/order-tabs-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await choose("Đã hủy");
  await expect(page.locator(".sub-order .status")).toHaveText("Đã hủy");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/order-tabs-mobile.png",
    fullPage: true,
  });
});

test("buyer order tab pagination persists and slow responses cannot overwrite a new tab", async ({
  page,
}) => {
  const offer = await orderOffer(page);
  expect(
    (
      await page.request.patch("/api/listings/" + offer.book.id, {
        headers: { Authorization: "Bearer " + offer.seller.token },
        data: { stock: 30 },
      })
    ).status(),
  ).toBe(200);
  await ready(page);
  const buyer = await register(page);
  const headers = { Authorization: "Bearer " + buyer.token };
  for (let index = 0; index < 12; index++) {
    const response = await page.request.post("/api/orders", {
      headers,
      data: {
        idempotencyKey: crypto.randomUUID(),
        receiverName: "Bạn đọc",
        receiverPhone: "0901234567",
        receiverAddress: "12 Đường Sách",
        items: [{ listingId: offer.book.id, quantity: 1 }],
      },
    });
    expect(response.status()).toBe(201);
  }
  await ready(page, "/don-hang?tab=pending");
  const tabs = page.getByRole("navigation", { name: "Trạng thái đơn hàng" });
  await expect(
    tabs.getByRole("button", { name: /^Chờ xác nhận/ }),
  ).toContainText("12");
  await expect(page.locator(".order-card")).toHaveCount(10);
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(page.locator(".order-card")).toHaveCount(2);
  await expect(page).toHaveURL(/tab=pending&page=2/);
  await page.reload();
  await expect(page.locator(".order-card")).toHaveCount(2);
  await tabs.getByRole("button", { name: /^Tất cả/ }).click();
  await expect(page.locator(".order-card")).toHaveCount(10);
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.route("**/api/orders/mine?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("tab") !== "pending")
      return route.continue();
    const result = await route.fetch();
    held = true;
    await wait;
    await route.fulfill({ response: result });
  });
  await tabs.getByRole("button", { name: /^Chờ xác nhận/ }).click();
  await expect.poll(() => held).toBe(true);
  await tabs.getByRole("button", { name: /^Đã hủy/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Chưa có đơn hàng trong mục này",
      exact: true,
    }),
  ).toBeVisible();
  release();
  await expect(tabs.getByRole("button", { name: /^Đã hủy/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".order-card")).toHaveCount(0);
});

// Hoàn tất đơn qua API để chuẩn bị quyền đánh giá; giao diện gửi đánh giá vẫn được thử thật.
async function completedReviewOrder(page, offer, buyer) {
  const response = await page.request.post("/api/orders", {
    headers: { Authorization: "Bearer " + buyer.token },
    data: {
      idempotencyKey: crypto.randomUUID(),
      receiverName: "Bạn đọc",
      receiverPhone: "0901234567",
      receiverAddress: "12 Đường Sách",
      items: [{ listingId: offer.book.id, quantity: 1 }],
    },
  });
  expect(response.status()).toBe(201);
  const order = (await response.json()).order;
  const id = order.subOrders[0]._id;
  const sellerHeaders = { Authorization: "Bearer " + offer.seller.token };
  expect(
    (
      await page.request.patch(`/api/sub-orders/${id}/confirm`, {
        headers: sellerHeaders,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.patch(`/api/sub-orders/${id}/ship`, {
        headers: sellerHeaders,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.patch(`/api/admin/sub-orders/${id}/shipping`, {
        headers: { Authorization: "Bearer " + offer.admin.token },
        data: { status: "delivered" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.patch(`/api/sub-orders/${id}/received`, {
        headers: { Authorization: "Bearer " + buyer.token },
      })
    ).status(),
  ).toBe(200);
  return order;
}

test("verified reviews: completed sold book can be reviewed once from order history", async ({
  page,
}) => {
  const offer = await orderOffer(page, "used");
  await ready(page);
  const buyer = await register(page);
  await completedReviewOrder(page, offer, buyer);
  expect(
    (await page.request.get("/api/listings/" + offer.book.id)).status(),
  ).toBe(404);
  await ready(page, "/don-hang?tab=to-receive");
  await page
    .getByRole("button", { name: "Đánh giá sách", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "ĐÁNH GIÁ SÁCH",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Số sao", exact: true })
    .selectOption("4");
  await dialog
    .getByLabel("Nhận xét", { exact: true })
    .fill("Sách còn đẹp, người bán gói cẩn thận.");
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/reviews", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requests++;
    await wait;
    await route.continue();
  });
  await dialog
    .getByRole("button", { name: "Gửi đánh giá", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Đang gửi…", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(dialog).toContainText("Đã gửi đánh giá. Cảm ơn bạn!");
  await expect(dialog.locator(".review-item")).toHaveCount(1);
  await expect(dialog.locator(".review-summary")).toContainText(
    "4 / 5 · 1 đánh giá",
  );
  await expect(dialog.locator(".review-form")).toHaveCount(0);
  await expect(dialog.locator(".review-item")).toContainText("Đã mua hàng");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/verified-review-mobile.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Đánh giá sách", exact: true })
    .click();
  await expect(dialog).toContainText("Bạn đã đánh giá sách này rồi.");
  await expect(dialog.locator(".review-item")).toHaveCount(1);
  await expect(dialog.locator(".review-form")).toHaveCount(0);
});

test("verified reviews: guests see real reviews, customers without a purchase cannot submit", async ({
  page,
}) => {
  const offer = await orderOffer(page);
  const response = await page.request.post("/api/auth/register", {
    data: { name: "Người mua sách", email: unique(), password },
  });
  const buyer = await response.json();
  await completedReviewOrder(page, offer, buyer);
  expect(
    (
      await page.request.post("/api/reviews", {
        headers: { Authorization: "Bearer " + buyer.token },
        data: {
          listingId: offer.book.id,
          rating: 5,
          comment: "Nội dung hay và giao đúng sách.",
        },
      })
    ).status(),
  ).toBe(201);
  const path = "/mua-sach?q=" + encodeURIComponent(offer.title);
  await ready(page, path);
  await page.getByRole("button", { name: offer.title, exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "CHI TIẾT SÁCH",
    exact: true,
  });
  await expect(dialog.locator(".review-item")).toContainText("Người mua sách");
  await expect(dialog.locator(".review-summary")).toContainText(
    "5 / 5 · 1 đánh giá",
  );
  await expect(dialog.locator(".review-form")).toHaveCount(0);
  await expect(
    dialog
      .locator(".book-reviews")
      .getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  const outsider = await register(page);
  await page.getByRole("button", { name: offer.title, exact: true }).click();
  await expect(dialog).toContainText(
    "Bạn chỉ được đánh giá khi đã mua sách này và đơn hàng đã hoàn thành.",
  );
  await expect(dialog.locator(".review-form")).toHaveCount(0);
  expect(
    (
      await page.request.post("/api/reviews", {
        headers: { Authorization: "Bearer " + outsider.token },
        data: {
          listingId: offer.book.id,
          rating: 5,
          comment: "Đánh giá không mua hàng",
        },
      })
    ).status(),
  ).toBe(403);
  await page.screenshot({
    path: "test-results/verified-review-desktop.png",
    fullPage: true,
  });
});

test("verified reviews: backend rejects submission after a completed order is returned", async ({
  page,
}) => {
  const offer = await orderOffer(page);
  await ready(page);
  const buyer = await register(page);
  const order = await completedReviewOrder(page, offer, buyer);
  await ready(page, "/mua-sach?q=" + encodeURIComponent(offer.title));
  await page.getByRole("button", { name: offer.title, exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "CHI TIẾT SÁCH",
    exact: true,
  });
  await dialog
    .getByLabel("Nhận xét", { exact: true })
    .fill("Đánh giá sau khi đơn đã hoàn hàng.");
  expect(
    (
      await page.request.patch(
        `/api/admin/sub-orders/${order.subOrders[0]._id}/shipping`,
        {
          headers: { Authorization: "Bearer " + offer.admin.token },
          data: { status: "returned" },
        },
      )
    ).status(),
  ).toBe(200);
  await dialog
    .getByRole("button", { name: "Gửi đánh giá", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Bạn chỉ được đánh giá khi đã mua sách này và đơn hàng đã hoàn thành.",
  );
  await expect(dialog.locator(".review-form")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(dialog.locator(".book-reviews")).toContainText(
    "Bạn chỉ được đánh giá khi đã mua sách này và đơn hàng đã hoàn thành.",
  );
  await expect(dialog.locator(".review-item")).toHaveCount(0);
});

test("buyer cancellation and admin return restore stock and remain after reload", async ({
  page,
  browser,
}) => {
  const offer = await orderOffer(page, "used");
  await ready(page);
  const buyer = await register(page);
  await startPaperCheckout(page, offer);
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/orders") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Xác nhận đặt hàng (COD)", exact: true })
    .click();
  const first = (await (await created).json()).order;
  await page.getByRole("button", { name: "Xem đơn hàng", exact: true }).click();
  await page
    .locator(".sub-order")
    .filter({ hasText: offer.title })
    .getByRole("button", { name: "Hủy đơn", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận hủy", exact: true }).click();
  await expect(page.locator(".sub-order .status")).toHaveText("Đã hủy");
  expect(
    (await page.request.get("/api/listings/" + offer.book.id)).status(),
  ).toBe(200);
  const again = await page.request.post("/api/orders", {
    headers: { Authorization: "Bearer " + buyer.token },
    data: {
      idempotencyKey: crypto.randomUUID(),
      receiverName: "Bạn đọc",
      receiverPhone: "0901234567",
      receiverAddress: "Đường Sách",
      items: [{ listingId: offer.book.id, quantity: 1 }],
    },
  });
  expect(again.status()).toBe(201);
  const second = (await again.json()).order;
  expect(second._id).not.toBe(first._id);
  const subId = second.subOrders[0]._id;
  const headers = { Authorization: "Bearer " + offer.seller.token };
  expect(
    (
      await page.request.patch("/api/sub-orders/" + subId + "/confirm", {
        headers,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.patch("/api/sub-orders/" + subId + "/ship", {
        headers,
      })
    ).status(),
  ).toBe(200);
  const admin = await userPage(browser, page, offer.admin.token);
  try {
    await ready(admin.page, "/quan-tri");
    await admin.page
      .getByRole("button", { name: "Vận chuyển", exact: true })
      .click();
    await admin.page
      .locator(".sub-order")
      .filter({ hasText: offer.title })
      .getByRole("button", { name: "Hoàn hàng", exact: true })
      .click();
    await expect(
      admin.page.locator(".sub-order").filter({ hasText: offer.title }),
    ).toHaveCount(0);
    await ready(page, "/don-hang/" + second._id);
    await expect(page.locator(".sub-order .status")).toHaveText("Đã hoàn hàng");
    await page.reload();
    await expect(page.locator(".sub-order .status")).toHaveText("Đã hoàn hàng");
    expect(
      (await page.request.get("/api/listings/" + offer.book.id)).status(),
    ).toBe(200);
  } finally {
    await admin.context.close();
  }
});

test("checkout 409 keeps cart and offers an explicit refresh when another buyer wins", async ({
  page,
}) => {
  const offer = await orderOffer(page, "used");
  const rivalResponse = await page.request.post("/api/auth/register", {
    data: { name: "Người mua khác", email: unique(), password },
  });
  const rival = await rivalResponse.json();
  await ready(page);
  await register(page);
  await startPaperCheckout(page, offer);
  await page.route("**/api/orders", async (route) => {
    const winner = await page.request.post("/api/orders", {
      headers: { Authorization: "Bearer " + rival.token },
      data: {
        idempotencyKey: crypto.randomUUID(),
        receiverName: "Người mua khác",
        receiverPhone: "0901234567",
        receiverAddress: "Đường Sách",
        items: [{ listingId: offer.book.id, quantity: 1 }],
      },
    });
    expect(winner.status()).toBe(201);
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Xác nhận đặt hàng (COD)", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("cập nhật lại giỏ");
  await page
    .getByRole("button", { name: "Cập nhật lại giỏ", exact: true })
    .click();
  await expect(page.getByText("Không còn bán", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tiến hành đặt hàng", exact: true }),
  ).toBeDisabled();
});

test("seller cancels a confirmed order with a reason from shop UI", async ({
  page,
  browser,
}) => {
  const offer = await orderOffer(page);
  await ready(page);
  const buyer = await register(page);
  const response = await page.request.post("/api/orders", {
    headers: { Authorization: "Bearer " + buyer.token },
    data: {
      idempotencyKey: crypto.randomUUID(),
      receiverName: "Bạn đọc",
      receiverPhone: "0901234567",
      receiverAddress: "Đường Sách",
      items: [{ listingId: offer.book.id, quantity: 1 }],
    },
  });
  expect(response.status()).toBe(201);
  const order = (await response.json()).order;
  const seller = await userPage(browser, page, offer.seller.token);
  try {
    await ready(seller.page, "/nguoi-ban");
    await seller.page
      .getByRole("link", { name: "Đơn bán hàng", exact: true })
      .click();
    const sub = seller.page
      .locator(".sub-order")
      .filter({ hasText: offer.title });
    await sub.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(sub.locator(".status")).toHaveText("Đã xác nhận");
    await sub.getByRole("button", { name: "Hủy đơn", exact: true }).click();
    await sub
      .getByLabel("Lý do hủy", { exact: true })
      .fill("Sách bị hỏng trước khi gửi");
    await sub
      .getByRole("button", { name: "Xác nhận hủy", exact: true })
      .click();
    await expect(sub.locator(".status")).toHaveText("Đã hủy");
    await ready(page, "/don-hang/" + order._id);
    await expect(page.locator(".sub-order")).toContainText(
      "Sách bị hỏng trước khi gửi",
    );
    const restored = await page.request.get("/api/listings/" + offer.book.id);
    expect((await restored.json()).listing.stock).toBe(3);
  } finally {
    await seller.context.close();
  }
});

for (const reload of [false, true])
  test(`checkout lost response reuses key without duplicate, reload=${reload}`, async ({
    page,
  }) => {
    const offer = await orderOffer(page, "used");
    await ready(page);
    const buyer = await register(page);
    await startPaperCheckout(page, offer);
    let sent = 0;
    let firstBody;
    let release;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/orders", async (route) => {
      sent++;
      firstBody = route.request().postDataJSON();
      const saved = await route.fetch();
      expect(saved.status()).toBe(201);
      await waiting;
      await route.abort("failed");
    });
    await page
      .getByRole("button", { name: "Xác nhận đặt hàng (COD)", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Đang đặt hàng…", exact: true }),
    ).toBeDisabled();
    await expect.poll(() => sent).toBe(1);
    await page
      .locator(".form-stack")
      .filter({
        has: page.getByRole("button", { name: "Đang đặt hàng…", exact: true }),
      })
      .evaluate((form) => form.requestSubmit());
    expect(sent).toBe(1);
    release();
    await expect(page.getByRole("alert")).toContainText("Không kết nối");
    expect(firstBody.idempotencyKey).toBeTruthy();
    await page.unroute("**/api/orders");
    if (reload) await ready(page);
    const replay = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/orders") &&
        response.request().method() === "POST",
    );
    if (reload)
      await page
        .getByRole("button", { name: "Kiểm tra lần đặt trước", exact: true })
        .click();
    else
      await page
        .getByRole("button", { name: "Xác nhận đặt hàng (COD)", exact: true })
        .click();
    const response = await replay;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().idempotencyKey).toBe(
      firstBody.idempotencyKey,
    );
    await expect(
      page.getByRole("button", { name: "Xem đơn hàng", exact: true }),
    ).toBeVisible();
    const mine = await page.request.get("/api/orders/mine", {
      headers: { Authorization: "Bearer " + buyer.token },
    });
    expect((await mine.json()).total).toBe(1);
    expect(
      await page.evaluate(
        (id) => sessionStorage.getItem(`bookmarket-pending-checkout:${id}`),
        buyer.user.id,
      ),
    ).toBeNull();
  });

// Chat dùng tài khoản/tin thử riêng; không gửi tin vào database ứng dụng.
test("buyer and seller chat persists, updates, marks read and retries without duplicate messages", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const offer = await orderOffer(page);
  await ready(page);
  await register(page);
  await ready(page, "/mua-sach?q=" + encodeURIComponent(offer.title));
  await page.locator(".book-title").click();
  await page
    .getByRole("button", { name: "Chat với người bán", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tin-nhan\/[a-f0-9]{24}$/);
  await expect(page.locator(".chat-thread-heading h2")).toHaveText(offer.name);
  await expect(page.locator(".chat-book-context")).toContainText(offer.title);
  const first = "Chào shop, sách còn không?";
  await page
    .getByRole("textbox", { name: "Nội dung tin nhắn", exact: true })
    .fill(first);
  await page
    .getByRole("textbox", { name: "Nội dung tin nhắn", exact: true })
    .press("Enter");
  await expect(
    page.locator(".chat-message p").filter({ hasText: first }),
  ).toHaveCount(1);
  const seller = await userPage(browser, page, offer.seller.token);
  try {
    await ready(seller.page, "/nguoi-ban");
    await expect(
      seller.page.locator(
        '.seller-sidebar a[href="/nguoi-ban/tin-nhan"] .chat-badge',
      ),
    ).toHaveText("1", { timeout: 10000 });
    await seller.page
      .locator('.seller-sidebar a[href="/nguoi-ban/tin-nhan"]')
      .click();
    await seller.page.locator(".chat-conversation").first().click();
    await expect(
      seller.page.locator(".chat-message p").filter({ hasText: first }),
    ).toHaveCount(1);
    await expect(page.locator(".chat-message.mine small")).toContainText(
      "Đã xem",
      { timeout: 10000 },
    );
    const reply = "Shop còn sách nhé.\nMình có thể gửi vào ngày mai.";
    await seller.page
      .getByRole("textbox", { name: "Nội dung tin nhắn", exact: true })
      .fill(reply);
    await seller.page
      .getByRole("button", { name: "Gửi tin nhắn", exact: true })
      .click();
    await expect(page.locator(".chat-message.theirs p")).toHaveText(reply, {
      timeout: 10000,
    });
    await expect(seller.page.locator(".chat-message.mine small")).toContainText(
      "Đã xem",
      { timeout: 10000 },
    );
    await page.reload();
    await expect(page.locator(".chat-message")).toHaveCount(2);
    await page.screenshot({
      path: "test-results/chat-buyer-desktop.png",
      fullPage: true,
    });
    await seller.page.screenshot({
      path: "test-results/chat-seller-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".chat-inbox")).toBeHidden();
    await page.screenshot({
      path: "test-results/chat-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Về danh sách tin nhắn", exact: true })
      .click();
    await expect(page.locator(".chat-inbox")).toBeVisible();
    await page.locator(".chat-conversation").first().click();
    const retryText = "Tin nhắn thử gửi lại khi mất phản hồi.";
    const messages = /\/api\/conversations\/[^/]+\/messages(?:\?|$)/;
    await page.route(messages, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fetch(); // Server đã lưu nhưng phản hồi bị mất trên đường về.
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Mất kết nối thử nghiệm" }),
      });
    });
    await page
      .getByRole("textbox", { name: "Nội dung tin nhắn", exact: true })
      .fill(retryText);
    await page
      .getByRole("button", { name: "Gửi tin nhắn", exact: true })
      .click();
    await expect(page.locator('.chat-composer [role="alert"]')).toContainText(
      "Mất kết nối thử nghiệm",
    );
    await expect(
      page.getByRole("textbox", { name: "Nội dung tin nhắn", exact: true }),
    ).toHaveValue(retryText);
    await page.unroute(messages);
    await page
      .getByRole("button", { name: "Gửi lại tin nhắn", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Nội dung tin nhắn", exact: true }),
    ).toHaveValue("");
    await page.reload();
    await expect(
      page.locator(".chat-message p").filter({ hasText: retryText }),
    ).toHaveCount(1);
    await expect(page.locator(".chat-message")).toHaveCount(3);
    const conversationPath = new URL(page.url()).pathname;
    await ready(page, "/nha-ban/" + offer.book.sellerId);
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const button = await page
        .getByRole("button", { name: "Chat với người bán", exact: true })
        .boundingBox();
      expect(button.x).toBeGreaterThanOrEqual(0);
      expect(button.x + button.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({
      path: "test-results/chat-storefront-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Chat với người bán", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(conversationPath + "$"));
    await expect(page.locator(".chat-message")).toHaveCount(3);
  } finally {
    await seller.context.close();
  }
});

test("chat loads older history and protects guest/admin inbox routes", async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page, "/tin-nhan");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập để tiếp tục", exact: true }),
  ).toBeVisible();
  const offer = await orderOffer(page);
  const account = await register(page);
  const headers = { Authorization: "Bearer " + account.token };
  const started = await page.request.post("/api/conversations", {
    headers,
    data: { listingId: offer.book.id },
  });
  expect(started.status()).toBe(200);
  const id = (await started.json()).conversation.id;
  for (let i = 1; i <= 35; i++) {
    const sent = await page.request.post(`/api/conversations/${id}/messages`, {
      headers,
      data: { text: `Lịch sử tin nhắn ${i}`, clientId: crypto.randomUUID() },
    });
    expect(sent.status()).toBe(201);
  }
  await ready(page, "/tin-nhan/" + id);
  await expect(page.locator(".chat-message")).toHaveCount(30);
  await page
    .getByRole("button", { name: "Tin nhắn cũ hơn", exact: true })
    .click();
  await expect(page.locator(".chat-message")).toHaveCount(35);
  await expect(page.locator(".chat-message p").first()).toHaveText(
    "Lịch sử tin nhắn 1",
  );
  await page
    .getByRole("textbox", { name: "Nội dung tin nhắn", exact: true })
    .fill("Bản nháp chưa gửi");
  await page
    .getByRole("link", { name: "Hộp thư bán hàng", exact: true })
    .click();
  await expect(page.locator(".chat-inbox-empty")).toBeVisible();
  await expect(page.locator(".chat-composer")).toHaveCount(0);
  await ready(page, "/");
  await page.getByRole("button", { name: /Tài khoản của/ }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await login(page, "admin@bookmarket.local");
  await ready(page, "/tin-nhan");
  await expect(
    page.getByRole("heading", { name: "Tài khoản quản trị", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chat-workspace")).toHaveCount(0);
});

test("separate shop registration validates each step, preserves review and recovers a lost creation response", async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const account = await register(page);
  const headers = { Authorization: "Bearer " + account.token };
  expect(
    (
      await page.request.post("/api/shops", {
        headers,
        data: { name: "Bỏ qua hồ sơ", description: "Thiếu thông tin liên hệ" },
      })
    ).status(),
  ).toBe(400);
  await ready(page, "/nguoi-ban/gian-hang");
  await expect(page).toHaveURL(/\/dang-ky-rap-sach$/);
  await expect(page.locator(".commerce-header")).toBeVisible();
  await expect(page.locator(".seller-header, .seller-sidebar")).toHaveCount(0);
  await expect(
    page.locator('.shop-registration-steps [aria-current="step"]'),
  ).toContainText("Thông tin gian hàng");
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page.getByLabel("Tên gian hàng", { exact: true })).toBeVisible();
  await page
    .getByLabel("Tên gian hàng", { exact: true })
    .fill("Tiệm sách " + account.user.id.slice(-6));
  await page
    .getByLabel("Giới thiệu", { exact: true })
    .fill("Gian hàng được đăng ký qua luồng hồ sơ riêng.");
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page.getByLabel("Người liên hệ", { exact: true })).toHaveValue(
    "Bạn đọc thử",
  );
  await expect(page.getByLabel("Email liên hệ", { exact: true })).toHaveValue(
    account.email,
  );
  await page.getByLabel("Số điện thoại liên hệ", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(
    page.locator('.shop-registration-steps [aria-current="step"]'),
  ).toContainText("Liên hệ và địa chỉ");
  await page
    .getByLabel("Số điện thoại liên hệ", { exact: true })
    .fill("0901234567");
  await page
    .getByLabel("Tỉnh / thành phố", { exact: true })
    .fill("Thành phố Hồ Chí Minh");
  await page
    .getByLabel("Phường / xã", { exact: true })
    .fill("Phường Bến Thành");
  await page
    .getByLabel("Địa chỉ cụ thể", { exact: true })
    .fill("12 Đường Sách");
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Xác nhận đăng ký rạp sách",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Quay lại", exact: true }).click();
  await expect(
    page.getByLabel("Số điện thoại liên hệ", { exact: true }),
  ).toHaveValue("0901234567");
  await page
    .getByLabel("Địa chỉ cụ thể", { exact: true })
    .fill("24 Đường Sách");
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page.locator(".shop-registration-review")).toContainText(
    "24 Đường Sách",
  );
  await page.screenshot({
    path: "test-results/shop-registration-review-desktop.png",
    fullPage: true,
  });
  for (const width of [1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/shop-registration-review-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("checkbox", { name: /Tôi xác nhận thông tin chính xác/ })
    .check();
  await page.route("**/api/shops", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Mất phản hồi đăng ký thử nghiệm" }),
    });
  });
  await page
    .getByRole("button", { name: "Xác nhận đăng ký rạp sách", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Mất phản hồi đăng ký thử nghiệm",
  );
  await expect(page.locator(".shop-registration-review")).toContainText(
    "24 Đường Sách",
  );
  await expect(page.locator(".seller-sidebar")).toHaveCount(0);
  await page.unroute("**/api/shops");
  await page
    .getByRole("button", { name: "Xác nhận đăng ký rạp sách", exact: true })
    .click();
  await expect(page).toHaveURL(/\/nguoi-ban$/);
  await expect(page.locator(".seller-sidebar")).toBeVisible();
  await expect(page.locator(".shop-registration-ready")).toContainText(
    "đã sẵn sàng",
  );
  const owned = await (
    await page.request.get("/api/shops", { headers })
  ).json();
  expect(owned.items).toHaveLength(1);
  expect(owned.items[0].pickupAddress.detail).toBe("24 Đường Sách");
  expect(owned.items[0].isRegistrationComplete).toBe(true);
  await ready(page, "/dang-ky-rap-sach");
  await expect(page).toHaveURL(/\/nguoi-ban$/);
  await expect(
    page.getByRole("button", {
      name: "Xác nhận đăng ký rạp sách",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .locator(".seller-sidebar")
    .getByRole("link", { name: "Thông tin gian hàng", exact: true })
    .click();
  await expect(
    page.getByLabel("Số điện thoại liên hệ", { exact: true }),
  ).toHaveValue("0901234567");
  await page
    .getByLabel("Số điện thoại liên hệ", { exact: true })
    .fill("0912345678");
  await page
    .getByRole("button", { name: "Lưu thông tin", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Đã lưu thông tin gian hàng.",
  );
  await page.reload();
  await expect(
    page.getByLabel("Số điện thoại liên hệ", { exact: true }),
  ).toHaveValue("0912345678");
});
