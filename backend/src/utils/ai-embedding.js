// Cache theo nội dung, không lưu vector vào MongoDB và tự cập nhật khi tin sửa mô tả.
const cache = new Map();
const cacheLimit = 500;

function bookText(item) {
  return `Tên: ${item.title}. Tác giả: ${item.author}. Thể loại: ${item.category}. Mô tả: ${(item.description || "").slice(0, 900)}`;
}

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) return 0;
  let dot = 0, lengthLeft = 0, lengthRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    lengthLeft += left[index] ** 2;
    lengthRight += right[index] ** 2;
  }
  return lengthLeft && lengthRight ? dot / Math.sqrt(lengthLeft * lengthRight) : 0;
}

async function embed(input) {
  const baseUrl = (process.env.OLLAMA_URL?.trim() || "http://127.0.0.1:11434").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.AI_EMBEDDING_MODEL?.trim() || "qwen3-embedding:0.6b",
      input,
      truncate: true,
      keep_alive: "5m",
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Ollama embedding status ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== input.length || data.embeddings.some((vector) => !Array.isArray(vector) || !vector.length)) {
    throw new Error("Ollama embedding output invalid");
  }
  return data.embeddings;
}

export async function rankBooksByMeaning(question, items) {
  if (!items.length) return [];
  const key = `Instruct: Tìm sách có nội dung phù hợp nhất với nhu cầu người đọc.\nQuery: ${question.trim().slice(0, 500)}`;
  const texts = items.map(bookText);
  const missing = texts.filter((value) => !cache.has(value));
  const vectors = await embed([key, ...missing]);
  for (let index = 0; index < missing.length; index += 1) cache.set(missing[index], vectors[index + 1]);
  while (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
  return items.map((item, index) => ({
    item,
    score: cosineSimilarity(vectors[0], cache.get(texts[index])),
  })).sort((left, right) => right.score - left.score);
}
