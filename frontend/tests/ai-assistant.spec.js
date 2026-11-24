import { test, expect } from "@playwright/test";

test("trợ lý mở trên mobile, hỏi catalog và hiện sách gợi ý", async ({
  page,
}) => {
  await page.route("**/api/ai/chat", (route) => route.fulfill({
    json: {
      message: "Mình tìm được sách phù hợp. Bạn thích đọc ebook vào lúc nào?",
      source: "ai",
      provider: "ollama",
      recommendations: [{ id: "chat-test-book", title: "Sổ tay đọc sách", author: "BookMarket Studio", price: 19000, type: "digital", reason: "Dễ bắt đầu đọc ebook." }],
    },
  }));
  await page.route("**/api/listings/chat-test-book", (route) => route.fulfill({
    json: { listing: { id: "chat-test-book", title: "Sổ tay đọc sách", author: "BookMarket Studio", category: "Văn học", type: "digital", price: 19000, stock: 1, description: "Sách thử nghiệm giao diện.", shop: "BookMarket Studio", sellerId: "test-seller", imageIds: [] } },
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Mở trợ lý AI" }).click();
  await expect(
    page.getByRole("dialog", { name: "Trợ lý AI BookMarket" }),
  ).toBeVisible();

  await page
    .getByLabel("Câu hỏi cho trợ lý BookMarket")
    .fill("Tìm ebook cho tôi");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();

  await expect(page.locator(".ai-recommendations button").first()).toBeVisible();
  await page.locator(".ai-book-card button").first().click();
  await expect(page.getByText("CHI TIẾT SÁCH")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sổ tay đọc sách" })).toBeVisible();
  await page.getByRole("button", { name: /đóng/i }).first().click();
  await page.getByRole("button", { name: "Mở trợ lý AI" }).click();
  await expect(
    page.getByText(/Gợi ý sách đang bán|AI local · Qwen3|AI đang trả lời/),
  ).toBeVisible();
  await expect(page.locator(".ai-message-user").last()).toContainText(
    "Tìm ebook cho tôi",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);

  await page
    .getByRole("button", { name: "Bắt đầu lại cuộc trò chuyện" })
    .click();
  await expect(page.locator(".ai-message")).toHaveCount(1);
  await expect(page.locator(".ai-recommendations")).toHaveCount(0);
});

test("trợ lý báo lỗi mạng và vẫn cho gửi lại", async ({ page }) => {
  await page.route("**/api/ai/chat", (route) => route.abort("failed"));
  await page.goto("/");
  await page.getByRole("button", { name: "Mở trợ lý AI" }).click();
  await page.getByLabel("Câu hỏi cho trợ lý BookMarket").fill("Gợi ý sách");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(page.locator(".ai-message.is-error")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi câu hỏi" })).toBeDisabled();
  await page.getByLabel("Câu hỏi cho trợ lý BookMarket").fill("Tìm ebook");
  await expect(page.getByRole("button", { name: "Gửi câu hỏi" })).toBeEnabled();
});
