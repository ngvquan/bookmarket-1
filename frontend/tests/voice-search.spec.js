import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/voice/status", (route) => route.fulfill({ json: { local: true } }));
  await page.route("**/api/voice/transcribe**", (route) => route.fulfill({
    json: { text: "Tìm sách Nhà giả kim" },
  }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    } });
    window.MediaRecorder = class {
      constructor() { this.mimeType = "audio/webm"; this.state = "inactive"; }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob([new Uint8Array(700)], { type: this.mimeType }) });
        this.onstop?.();
      }
    };
  });
});

test("micro tự tìm theo nguyên văn lời nói", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const mic = page.locator(".header-search-form .voice-search-button");
  await expect(mic).toBeVisible({ timeout: 20_000 });
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".header-search-form .voice-search-message")).toContainText("Đang nghe...");
  await mic.click();
  await expect(page).toHaveURL(/\/tim-kiem\?q=T%C3%ACm%20s%C3%A1ch%20Nh%C3%A0%20gi%E1%BA%A3%20kim/);
  await expect(page.locator("#catalog-search")).toHaveValue("Tìm sách Nhà giả kim");
  await expect(page.getByText("Đã ghi lời nói. Kiểm tra chữ rồi bấm Tìm kiếm.")).toHaveCount(0);
});

test("câu lệnh tiếng Anh tìm theo tên sách", async ({ page }) => {
  await page.route("**/api/voice/transcribe**", (route) => route.fulfill({
    json: { text: "I want to find the book The Alchemist by Paulo Coelho", language: "en" },
  }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const mic = page.locator(".header-search-form .voice-search-button");
  await expect(mic).toBeVisible({ timeout: 20_000 });
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await mic.click();
  await expect(page).toHaveURL(/\/tim-kiem\?q=I%20want%20to%20find%20the%20book%20The%20Alchemist%20by%20Paulo%20Coelho/);
});

test("tự nhận diện từ tiếng Anh ngắn và tự tìm kiếm", async ({ page }) => {
  await page.route("**/api/voice/transcribe**", (route) => route.fulfill({
    json: { text: "marketing", language: "en" },
  }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const mic = page.locator(".header-search-form .voice-search-button");
  await mic.click();
  await expect(page.getByRole("combobox", { name: "Ngôn ngữ nhận diện giọng nói" })).toHaveCount(0);
  const request = page.waitForRequest((item) => item.url().endsWith("/api/voice/transcribe"));
  await mic.click();
  await request;
  await expect(page).toHaveURL(/\/tim-kiem\?q=marketing/);
});

test("catalog tự tìm theo câu nói", async ({ page }) => {
  await page.goto("/tim-kiem", { waitUntil: "domcontentloaded" });
  const mic = page.locator(".catalog-toolbar .voice-search-button");
  await expect(mic).toBeVisible({ timeout: 20_000 });
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await mic.click();
  await expect(page.locator("#catalog-search")).toHaveValue("Tìm sách Nhà giả kim");
  await expect(page).toHaveURL(/q=T%C3%ACm\+s%C3%A1ch\+Nh%C3%A0\+gi%E1%BA%A3\+kim/);
});

test("tìm kiếm nâng cao tự gửi câu nói", async ({ page }) => {
  await page.goto("/tim-kiem-nang-cao", { waitUntil: "domcontentloaded" });
  const mic = page.locator(".edition-search .voice-search-button");
  await expect(mic).toBeVisible({ timeout: 20_000 });
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await mic.click();
  await expect(page).toHaveURL(/\/tim-kiem\?q=T%C3%ACm\+s%C3%A1ch\+Nh%C3%A0\+gi%E1%BA%A3\+kim/);
});

test("micro hiện lỗi rõ khi backend local chưa chạy", async ({ page }) => {
  await page.route("**/api/voice/status", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const mic = page.locator(".header-search-form .voice-search-button");
  await expect(mic).toBeVisible({ timeout: 20_000 });
  await mic.click();
  await expect(page.getByRole("status")).toContainText("chưa chạy ở cổng 4001");
});
