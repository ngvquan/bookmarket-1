import { afterEach, describe, expect, it, vi } from "vitest";
import { Listing } from "../src/models/index.js";
import request from "supertest";
import app from "../src/app.js";
import { cosineSimilarity, rankBooksByMeaning } from "../src/utils/ai-embedding.js";
import {
  answerChat,
  chatRecommendations,
  cleanModelReply,
  detectPriceExtreme,
  detectMaximumPrice,
  findChatCatalog,
  wantsCatalog,
  readChatMessages,
  verifyChatCatalog,
} from "../src/utils/ai-chat.js";

const catalog = [
  {
    id: "book-1",
    title: "Nhà giả kim",
    author: "Paulo Coelho",
    category: "Văn học",
    type: "used",
    price: 42000,
    condition: "Còn tốt",
    stock: 1,
    shop: "Tủ sách An",
    description: "Một hành trình đi tìm kho báu.",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.AI_PROVIDER;
  delete process.env.OLLAMA_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OLLAMA_FALLBACK_MODEL;
  delete process.env.OLLAMA_CONTEXT_LENGTH;
  delete process.env.OLLAMA_NUM_GPU;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.AI_ACCOUNT_API_URL;
  delete process.env.AI_CATALOG_API_URL;
});

describe("chatbot BookMarket", () => {
  it("xếp hạng theo embedding của mô tả sách, giữ giá và tồn kho ngoài model", async () => {
    const books = [
      { id: "relevant", title: "Bạn nhỏ can đảm", author: "A", category: "Thiếu nhi", description: "Giúp trẻ tự tin kết bạn." },
      { id: "unrelated", title: "Quản lý chi tiêu", author: "B", category: "Kinh tế", description: "Lập ngân sách cá nhân." },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[1, 0], [0.9, 0.1], [0, 1]] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const ranked = await rankBooksByMeaning("sách giúp bé tự tin", books);
    expect(ranked.map(({ item }) => item.id)).toEqual(["relevant", "unrelated"]);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.model).toBe("qwen3-embedding:0.6b");
    expect(request.input[0]).toContain("Query: sách giúp bé tự tin");
    expect(request.input[1]).toContain("Giúp trẻ tự tin kết bạn");
  });
  it("token từ backend khác không chặn câu hỏi chính sách công khai", async () => {
    const response = await request(app).post("/ai/chat")
      .set("Authorization", "Bearer token-from-other-backend")
      .send({ messages: [{ role: "user", content: "Chính sách đổi trả" }] });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe("verified");
  });

  it("không tự bịa mã giảm giá khi chat chưa tra được voucher riêng", async () => {
    const response = await request(app).post("/ai/chat").send({
      messages: [{ role: "user", content: "Tôi có mã giảm giá nào?" }],
    });
    expect(response.status).toBe(200);
    expect(response.body.source).toBe("verified");
    expect(response.body.message).toContain("chưa tra cứu được mã giảm giá");
    expect(response.body.recommendations).toEqual([]);
  });

  it("tra đơn từ backend đăng nhập chỉ bằng token và API đọc đơn của chính khách", async () => {
    process.env.AI_ACCOUNT_API_URL = "https://account.example.test";
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      json: async () => String(url).includes("/orders/mine")
        ? { items: [{ _id: "paper-order-12345678", createdAt: "2026-11-20T10:00:00Z", subOrders: [{ status: "shipping" }] }] }
        : { items: [] },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await request(app).post("/ai/chat")
      .set("Authorization", "Bearer remote-user-token")
      .send({ messages: [{ role: "user", content: "Tra đơn hàng của tôi" }] });
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("shipping");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every(([, options]) => options.headers.Authorization === "Bearer remote-user-token")).toBe(true);
  });
  it("chỉ nhận lịch sử hợp lệ và bắt buộc kết thúc bằng câu hỏi", () => {
    expect(
      readChatMessages({
        messages: [{ role: "user", content: "Gợi ý sách cho mình" }],
      }),
    ).toEqual([{ role: "user", content: "Gợi ý sách cho mình" }]);
    expect(
      readChatMessages({
        messages: [{ role: "assistant", content: "Xin chào" }],
      }),
    ).toBeNull();
    expect(
      readChatMessages({
        messages: [{ role: "user", content: "x".repeat(1201) }],
      }),
    ).toBeNull();
  });

  it("chỉ tra catalog khi cuộc trò chuyện cần dữ liệu sách đang bán", () => {
    expect(wantsCatalog([{ role: "user", content: "Hãy hỏi tôi từng câu để hiểu sở thích" }])).toBeNull();
    expect(wantsCatalog([{ role: "user", content: "Giải thích AI là gì" }])).toBeNull();
    expect(wantsCatalog([{ role: "user", content: "Tìm ebook văn học" }])).toBe("Tìm ebook văn học");
    expect(wantsCatalog([{ role: "user", content: "Sách giấy dưới 100k" }])).toBe("Sách giấy dưới 100k");
    expect(wantsCatalog([{ role: "user", content: "Sách giúp bé tự tin" }])).toBe("Sách giúp bé tự tin");
    expect(wantsCatalog([{ role: "user", content: "Tóm tắt cuốn sách này" }])).toBe("Tóm tắt cuốn sách này");
  });

  it("trả lời sách đắt nhất từ catalog đang phục vụ web", async () => {
    process.env.AI_CATALOG_API_URL = "https://market.example";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{
        id: "expensive-book", title: "Nhà đầu tư thông minh",
        author: "Benjamin Graham", price: 265000, type: "new",
        category: "Kinh tế", imageIds: [],
      }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(detectPriceExtreme("Cuốn sách đắt nhất là gì?")).toBe("highest");
    const response = await request(app).post("/ai/chat").send({
      messages: [{ role: "user", content: "Cuốn sách đắt nhất là gì?" }],
    });
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("265.000₫");
    expect(response.body.message).toContain("Nhà đầu tư thông minh");
    expect(response.body.recommendations[0].id).toBe("expensive-book");
    const url = fetchMock.mock.calls[0][0];
    expect(url.searchParams.get("sort")).toBe("price-down");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("lọc ebook rẻ nhất trước khi trả lời", async () => {
    process.env.AI_CATALOG_API_URL = "https://market.example";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{
        id: "cheap-ebook", title: "Sách điện tử mẫu",
        author: "BookMarket", price: 2000, type: "digital",
      }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app).post("/ai/chat").send({
      messages: [{ role: "user", content: "Ebook rẻ nhất là cuốn nào?" }],
    });
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("2.000₫");
    const url = fetchMock.mock.calls[0][0];
    expect(url.searchParams.get("type")).toBe("digital");
    expect(url.searchParams.get("sort")).toBe("price-up");
  });

  it("hiểu ngân sách viết bằng nghìn hoặc k", () => {
    expect(detectMaximumPrice("Sách dưới 100 nghìn")).toBe(100000);
    expect(detectMaximumPrice("ebook dưới 100k")).toBe(100000);
    expect(detectMaximumPrice("Gợi ý sách thiếu nhi")).toBeNull();
  });

  it("lọc catalog theo giá và loại sách giấy mà không tìm nhầm 100k như tên sách", async () => {
    const find = vi.spyOn(Listing, "find").mockImplementation(() => ({
      sort: () => ({ limit: async () => [] }),
    }));
    expect(await findChatCatalog("Sách giấy dưới 100k")).toEqual([]);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      status: "approved",
      price: { $lte: 100000 },
      type: { $ne: "digital" },
    }));
  });

  it("xác minh tin sách với API web và lấy giá mới thay vì giá local cũ", async () => {
    process.env.AI_CATALOG_API_URL = "https://market.example";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ listing: {
        ...catalog[0], price: 45000, status: "approved", stock: 1,
      } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const verified = await verifyChatCatalog(catalog);
    expect(verified).toHaveLength(1);
    expect(verified[0].price).toBe(45000);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/listings/book-1");
  });

  it("không gợi ý tin đã biến mất khỏi API web", async () => {
    process.env.AI_CATALOG_API_URL = "https://market.example";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));
    expect(await verifyChatCatalog(catalog)).toEqual([]);
  });

  it("lọc lại giá và loại sách sau khi lấy tin mới từ API web", async () => {
    process.env.AI_CATALOG_API_URL = "https://market.example";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ listing: {
        ...catalog[0], price: 120000, status: "approved", stock: 1,
      } }),
    }));
    expect(await verifyChatCatalog(catalog, "Sách dưới 100k")).toEqual([]);
  });

  it("loại suy nghĩ ẩn và giá do model tự viết", () => {
    expect(cleanModelReply("<think>lý luận nội bộ</think>Mình sẽ tìm giúp bạn.", catalog)).toBe("Mình sẽ tìm giúp bạn.");
    expect(cleanModelReply("Cuốn này giá 99.000đ", catalog)).toBe("");
    expect(cleanModelReply("Thử đọc “Tên sách không có thật” nhé.", catalog)).toBe("");
  });

  it("thử lại Ollama một lần rồi báo lỗi khi AI không phản hồi", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.OLLAMA_MODEL = "qwen3:1.7b";
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    const result = await answerChat([{ role: "user", content: "Hỏi tôi từng câu để hiểu sở thích" }], null);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("catalog");
    expect(result.message).toContain("chưa trả lời được lúc này");
    errorSpy.mockRestore();
  });

  it("dùng model Ollama dự phòng khi model chính không tải được", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.OLLAMA_MODEL = "qwen3:8b";
    process.env.OLLAMA_FALLBACK_MODEL = "qwen3:4b";
    const fetchMock = vi.fn().mockImplementation(async (_url, options) => {
      const { model } = JSON.parse(options.body);
      if (model === "qwen3:8b") throw new Error("out of memory");
      return { ok: true, json: async () => ({ message: { content: "Mình gợi ý Nhà giả kim." } }) };
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerChat([{ role: "user", content: "Hỏi tôi từng câu để hiểu sở thích" }], null);

    expect(result.source).toBe("ai");
    expect(result.provider).toBe("ollama");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).model).toBe("qwen3:4b");
    errorSpy.mockRestore();
  });

  it("vẫn trả gợi ý catalog khi chưa cấu hình khóa AI", async () => {
    process.env.AI_PROVIDER = "openai";
    const result = await answerChat(
      [{ role: "user", content: "Có sách nào hay?" }],
      catalog,
    );
    expect(result.source).toBe("catalog");
    expect(result.message).toContain("Nhà giả kim");
    expect(chatRecommendations(catalog)).toEqual([
      expect.objectContaining({ id: "book-1", price: 42000 }),
    ]);
  });

  it("gọi Responses API ở backend và đọc output_text", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.OPENAI_MODEL = "test-model";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "Đây là câu trả lời AI." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerChat(
      [{ role: "user", content: "Hãy hỏi tôi về sở thích đọc sách" }],
      null,
    );

    expect(result).toEqual({
      message: "Đây là câu trả lời AI.",
      source: "ai",
      provider: "openai",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({ method: "POST" }),
    );
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.model).toBe("test-model");
    expect(request.store).toBe(false);
    expect(request.input.at(-1).content).toContain("Hãy hỏi tôi về sở thích đọc sách");
  });

  it("gọi Qwen3 qua Ollama local mà không cần API key", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.OLLAMA_MODEL = "qwen3:1.7b";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: "Mình gợi ý Nhà giả kim cho bạn." },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerChat(
      [{ role: "user", content: "Hãy hỏi tôi về sở thích đọc sách" }],
      null,
    );

    expect(result).toEqual({
      message: "Mình gợi ý Nhà giả kim cho bạn.",
      source: "ai",
      provider: "ollama",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:11434/api/chat");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toMatchObject({
      model: "qwen3:1.7b",
      stream: false,
      think: false,
      options: expect.objectContaining({ num_ctx: 1536, num_gpu: 0, temperature: 0 }),
    });
    expect(request.messages[0].content).toContain("đừng tự thêm câu hỏi");
    expect(request.messages.at(-1).content).toContain("Hãy hỏi tôi về sở thích đọc sách");
  });

  it("trả thông tin catalog đã xác minh mà không gọi mô hình hoặc thêm câu hỏi", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await answerChat([{ role: "user", content: "Sách dưới 100k" }], catalog);
    expect(result.source).toBe("catalog");
    expect(result.message).toContain("Nhà giả kim");
    expect(result.message).toContain("42.000₫");
    expect(result.message).not.toContain("?");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("diễn đạt gợi ý theo yêu cầu của khách và tránh từ kỹ thuật", async () => {
    const items = [catalog[0], { ...catalog[0], id: "book-2", title: "Hoàng tử bé", price: 28000 }];
    const result = await answerChat([{ role: "user", content: "Sách dưới 100k" }], items);
    expect(result.message).toContain("Trong tầm giá 100.000₫");
    expect(result.message).toContain("Hoàng tử bé");
    expect(result.message).not.toMatch(/catalog|lựa chọn trong BookMarket/i);
  });
});
