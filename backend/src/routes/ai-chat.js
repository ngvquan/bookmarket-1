import { Router } from "express";
import jwt from "jsonwebtoken";
import { Order, SubOrder, DigitalOrder, User } from "../models/index.js";
import { policies, policyForQuestion } from "../data/policies.js";
import { normalize } from "../utils/text.js";
import {
  answerChat,
  chatRecommendations,
  findChatCatalog,
  wantsCatalog,
  readChatMessages,
} from "../utils/ai-chat.js";

const router = Router();
const requests = new Map();
const windowMs = 5 * 60 * 1000;
const maximumRequests = 20;

async function optionalUser(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.accountType === "user" && /^[a-f0-9]{24}$/i.test(payload.id)) {
      req.user = await User.findById(payload.id);
    }
  } catch {
    // Token từ backend khác hoặc đã hết hạn không chặn câu hỏi công khai.
  }
  next();
}

function asksAboutOwnOrder(content) {
  return /(?:đơn hàng|đơn ebook|đơn của tôi|đơn mình|mã đơn|order)/i.test(content) &&
    /(?:của tôi|của mình|của em|đã đặt|đã mua|trạng thái|tra|kiểm tra|theo dõi|gần nhất)/i.test(content);
}

async function ownOrderAnswer(userId) {
  if (!userId) return "Bạn hãy đăng nhập để mình kiểm tra trạng thái đơn hàng của chính bạn. Mình không cần mật khẩu hay OTP trong cuộc trò chuyện.";
  const [paper, digital] = await Promise.all([
    Order.findOne({ buyerId: userId }).sort({ createdAt: -1 }).select("_id createdAt").lean(),
    DigitalOrder.findOne({ buyerId: userId }).sort({ createdAt: -1 }).select("_id status createdAt").lean(),
  ]);
  if (!paper && !digital) return "Mình chưa thấy đơn hàng nào trong tài khoản của bạn.";
  if (digital && (!paper || digital.createdAt > paper.createdAt)) return `Đơn ebook gần nhất (${String(digital._id).slice(-8)}) đang ở trạng thái ${digital.status}. Bạn có thể mở mục Đơn hàng để xem chi tiết.`;
  const subOrders = await SubOrder.find({ orderId: paper._id, buyerId: userId }).select("status").lean();
  return `Đơn sách giấy gần nhất (${String(paper._id).slice(-8)}) có trạng thái: ${[...new Set(subOrders.map((order) => order.status))].join(", ")}. Mở mục Đơn hàng để xem chi tiết.`;
}

async function remoteOwnOrderAnswer(authorization) {
  const base = process.env.AI_ACCOUNT_API_URL?.trim();
  if (!base || !authorization) return ownOrderAnswer(null);
  let origin;
  try {
    origin = new URL(base);
    if (origin.protocol !== "https:" && origin.hostname !== "127.0.0.1") return ownOrderAnswer(null);
  } catch { return ownOrderAnswer(null); }
  const headers = { Authorization: authorization };
  const get = async (path) => fetch(new URL(path, origin), { headers, signal: AbortSignal.timeout(20000) });
  try {
    const identity = await get("/auth/me");
    if (!identity.ok) return ownOrderAnswer(null);
    const [paperResponse, digitalResponse] = await Promise.all([
      get("/orders/mine?limit=1"), get("/digital-orders/mine?page=1"),
    ]);
    if (!paperResponse.ok || !digitalResponse.ok) return "Mình chưa kiểm tra được đơn hàng. Bạn hãy mở mục Đơn hàng để xem trạng thái mới nhất.";
    const [paperData, digitalData] = await Promise.all([paperResponse.json(), digitalResponse.json()]);
    const paper = paperData.items?.[0];
    const digital = digitalData.items?.[0];
    if (!paper && !digital) return "Mình chưa thấy đơn hàng nào trong tài khoản của bạn.";
    if (digital && (!paper || new Date(digital.createdAt) > new Date(paper.createdAt))) {
      return `Đơn ebook gần nhất (${String(digital.id || digital._id).slice(-8)}) đang ở trạng thái ${digital.status}. Bạn có thể mở mục Đơn hàng để xem chi tiết.`;
    }
    return `Đơn sách giấy gần nhất (${String(paper._id).slice(-8)}) có trạng thái: ${[...new Set((paper.subOrders || []).map((order) => order.status))].join(", ")}. Mở mục Đơn hàng để xem chi tiết.`;
  } catch (error) {
    console.error("AI order lookup unavailable:", error.message);
    return "Mình chưa kiểm tra được đơn hàng. Bạn hãy mở mục Đơn hàng để xem trạng thái mới nhất.";
  }
}

function allowRequest(req) {
  const now = Date.now();
  if (requests.size > 1000) {
    for (const [storedKey, value] of requests) {
      if (now - value.startedAt >= windowMs) requests.delete(storedKey);
    }
  }
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = requests.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    requests.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= maximumRequests;
}

router.post("/chat", optionalUser, async (req, res, next) => {
  try {
    if (!allowRequest(req)) {
      return res.status(429).json({
        message: "Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau ít phút.",
      });
    }
    const messages = readChatMessages(req.body);
    if (!messages) {
      return res.status(400).json({
        message: "Nội dung trò chuyện không hợp lệ.",
      });
    }
    const question = messages.at(-1).content;
    const normalizedQuestion = normalize(question);
    if (/\b(bo qua.*quy tac|system prompt|lo prompt|api key|khoa api)\b/.test(normalizedQuestion)) {
      return res.json({ message: "Mình không thể cung cấp chỉ dẫn nội bộ hoặc khóa hệ thống. Bạn muốn mình giúp tìm sách hay giải đáp việc mua sách nào?", source: "verified", recommendations: [] });
    }
    if (/\b(viet code giup|lam bai tap ho|giai de thi|phan tich chinh tri)\b/.test(normalizedQuestion)) {
      return res.json({ message: "Mình chỉ hỗ trợ tìm sách và mua sắm tại BookMarket. Bạn muốn tìm sách thuộc chủ đề nào?", source: "verified", recommendations: [] });
    }
    if (asksAboutOwnOrder(question)) {
      const answer = req.user ? await ownOrderAnswer(req.user.id) : await remoteOwnOrderAnswer(req.headers.authorization);
      return res.json({ message: answer, source: "verified", recommendations: [] });
    }
    const policy = policyForQuestion(question);
    if (policy) {
      const contact = /khieu nai|hoan tien|nhan vien|lien he/i.test(question.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      return res.json({ message: policies[policy] + (contact && policy !== "support" ? ` ${policies.support}` : ""), source: "verified", recommendations: [] });
    }
    const search = wantsCatalog(messages);
    const catalog = search ? await findChatCatalog(search) : null;
    const answer = await answerChat(messages, catalog);
    res.json({
      ...answer,
      recommendations: search ? chatRecommendations(catalog) : [],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
